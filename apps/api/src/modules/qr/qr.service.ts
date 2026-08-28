import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import JSZip from 'jszip';
import { LifecycleStatus } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { DomainService } from '../domain/domain.service';
import { CredentialService } from '../credential/credential.service';
import { AuditService } from '../audit/audit.service';
import { assertLifecycleTransition } from '../product/product-lifecycle.util';
import { ObjectStorageProvider } from '../../providers/interfaces';
import { STORAGE_PROVIDER } from '../../providers/providers.module';

@Injectable()
export class QrRenderService {
  constructor(
    @Optional() @Inject(STORAGE_PROVIDER) private readonly storage?: ObjectStorageProvider,
  ) {}

  async render(data: string, config: Record<string, unknown>): Promise<Buffer> {
    const width = (config.width as number) ?? 300;
    const color = {
      dark: (config.foregroundColor as string) ?? '#000000',
      light: (config.backgroundColor as string) ?? '#FFFFFF',
    };
    const margin = (config.quietZone as number) ?? 4;
    const errorCorrectionLevel = ((config.errorCorrectionLevel as string) ?? 'M') as
      'L' | 'M' | 'Q' | 'H';

    const png = await QRCode.toBuffer(data, {
      width,
      color,
      margin,
      errorCorrectionLevel,
      type: 'png',
    });

    const logoKey = config.logoObjectKey as string | undefined;
    if (!logoKey || !this.storage) {
      return png;
    }

    try {
      const logoBuffer = await this.storage.download(logoKey);
      const ratio = typeof config.logoSizeRatio === 'number' ? config.logoSizeRatio : 0.2;
      const logoSize = Math.max(24, Math.floor(width * ratio));
      const logo = await sharp(logoBuffer)
        .resize(logoSize, logoSize, { fit: 'inside' })
        .png()
        .toBuffer();
      return sharp(png)
        .composite([{ input: logo, gravity: 'centre' }])
        .png()
        .toBuffer();
    } catch {
      return png;
    }
  }

  async renderSvg(data: string, config: Record<string, unknown>): Promise<string> {
    return QRCode.toString(data, {
      type: 'svg',
      width: (config.width as number) ?? 300,
      color: {
        dark: (config.foregroundColor as string) ?? '#000000',
        light: (config.backgroundColor as string) ?? '#FFFFFF',
      },
      margin: (config.quietZone as number) ?? 4,
      errorCorrectionLevel: ((config.errorCorrectionLevel as string) ?? 'M') as
        'L' | 'M' | 'Q' | 'H',
    });
  }
}

@Injectable()
export class QrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainService: DomainService,
    private readonly credentialService: CredentialService,
    private readonly renderService: QrRenderService,
    private readonly audit: AuditService,
  ) {}

  buildVerificationUrl(hostname: string, path: string, token: string): string {
    const basePath = path.endsWith('/') ? path.slice(0, -1) : path;
    return `https://${hostname}${basePath}/${token}`;
  }

  async createForUnit(
    tenantId: string,
    productUnitId: string,
    qrToken: string,
    domainHostname: string,
    verificationPath: string,
    domainVersion: number,
    configVersion: number,
  ) {
    const url = this.buildVerificationUrl(domainHostname, verificationPath, qrToken);
    const qr = await this.prisma.client.qrCode.create({
      data: {
        tenantId,
        productUnitId,
        token: qrToken,
        url,
        status: LifecycleStatus.ACTIVE,
        domainVersion,
        configVersion,
      },
    });
    await this.prisma.client.qrLifecycleEvent.create({
      data: { qrCodeId: qr.id, status: LifecycleStatus.ACTIVE, reason: 'Created' },
    });
    return qr;
  }

  async getCustomizationConfig(tenantId: string, scopeId?: string) {
    const config = await this.prisma.client.qrCustomizationConfig.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [{ scope: 'tenant', scopeId: null }, { scopeId }],
      },
      orderBy: { version: 'desc' },
    });
    return (
      (config?.config as Record<string, unknown>) ?? {
        width: 300,
        height: 300,
        foregroundColor: '#000000',
        backgroundColor: '#FFFFFF',
        quietZone: 4,
        errorCorrectionLevel: 'M',
      }
    );
  }

  async preview(tenantId: string, sampleToken = 'sample-token-preview') {
    const domain = await this.domainService.getActivePrimaryDomain(tenantId);
    const hostname = domain?.hostname ?? 'verify.example.com';
    const path = domain?.verificationPath ?? '/v';
    const url = this.buildVerificationUrl(hostname, path, sampleToken);
    const config = await this.getCustomizationConfig(tenantId);
    const png = await this.renderService.render(url, config);
    return { url, png: png.toString('base64'), config };
  }

  async exportQr(qrCodeId: string, tenantId: string, format: 'PNG' | 'SVG' = 'PNG') {
    const qr = await this.requireQr(tenantId, qrCodeId);
    const config = await this.getCustomizationConfig(tenantId);
    if (format === 'SVG') {
      const svg = await this.renderService.renderSvg(qr.url, config);
      return { format, data: svg, url: qr.url, serial: qr.productUnit?.serial?.serialNumber };
    }
    const png = await this.renderService.render(qr.url, config);
    return {
      format,
      data: png.toString('base64'),
      url: qr.url,
      serial: qr.productUnit?.serial?.serialNumber,
    };
  }

  async listByTenant(tenantId: string, limit = 100, offset = 0) {
    const [items, total] = await Promise.all([
      this.prisma.client.qrCode.findMany({
        where: { tenantId },
        include: { productUnit: { include: { serial: true, batch: true } } },
        take: Math.min(limit, 500),
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.qrCode.count({ where: { tenantId } }),
    ]);
    return { items, total, limit, offset };
  }

  async updateStatus(
    tenantId: string,
    qrCodeId: string,
    status: LifecycleStatus,
    userId: string,
    reason?: string,
  ) {
    const qr = await this.requireQr(tenantId, qrCodeId);
    assertLifecycleTransition('unit', qr.status, status);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const next = await tx.qrCode.update({
        where: { id: qrCodeId },
        data: { status, configVersion: { increment: 1 } },
      });

      await tx.qrLifecycleEvent.create({
        data: { qrCodeId, status, reason: reason ?? `Status changed to ${status}` },
      });

      if (status === LifecycleStatus.REVOKED || status === LifecycleStatus.BLOCKED) {
        await tx.verificationCredential.updateMany({
          where: { productUnitId: qr.productUnitId, tenantId },
          data: { status },
        });
        await tx.productUnit.update({
          where: { id: qr.productUnitId },
          data: { status },
        });
      }

      return next;
    });

    await this.audit.log({
      action: 'QR_STATUS_CHANGED',
      resourceType: 'qr_code',
      resourceId: qrCodeId,
      tenantId,
      userId,
      before: { status: qr.status },
      after: { status: updated.status, reason },
    });

    return updated;
  }

  async generateMissingForBatch(tenantId: string, batchId: string, userId: string) {
    const batch = await this.prisma.client.batch.findFirst({ where: { id: batchId, tenantId } });
    if (!batch) throw new NotFoundException('Batch not found');

    const domain = await this.domainService.getActivePrimaryDomain(tenantId);
    if (!domain) {
      throw new BadRequestException('No active primary verification domain configured');
    }

    const units = await this.prisma.client.productUnit.findMany({
      where: { batchId, tenantId, qrCode: null },
      take: 5000,
    });

    let created = 0;
    const customization = await this.getCustomizationConfig(tenantId);
    const configVersion = (customization.version as number) ?? 1;

    for (const unit of units) {
      const qrToken = this.credentialService.generateQrToken();
      await this.createForUnit(
        tenantId,
        unit.id,
        qrToken,
        domain.hostname,
        domain.verificationPath,
        domain.version,
        configVersion,
      );
      created++;
    }

    await this.audit.log({
      action: 'QR_BATCH_GENERATED',
      resourceType: 'batch',
      resourceId: batchId,
      tenantId,
      userId,
      after: { created },
    });

    return { batchId, created };
  }

  async exportBatch(
    tenantId: string,
    batchId: string,
    format: 'PNG' | 'SVG' | 'ZIP' = 'PNG',
    limit = 100,
  ) {
    const batch = await this.prisma.client.batch.findFirst({ where: { id: batchId, tenantId } });
    if (!batch) throw new NotFoundException('Batch not found');

    const qrCodes = await this.prisma.client.qrCode.findMany({
      where: { tenantId, productUnit: { batchId } },
      include: { productUnit: { include: { serial: true } } },
      take: Math.min(limit, 500),
      orderBy: { createdAt: 'asc' },
    });

    const config = await this.getCustomizationConfig(tenantId);

    if (format === 'ZIP') {
      const files: Array<{ name: string; buffer: Buffer }> = [];
      const manifest: Array<{ serial?: string; url: string; filename: string }> = [];

      for (const qr of qrCodes) {
        const serial = qr.productUnit.serial?.serialNumber ?? qr.id.slice(0, 8);
        const filename = `${serial}.png`;
        const png = await this.renderService.render(qr.url, config);
        files.push({ name: filename, buffer: png });
        manifest.push({ serial: qr.productUnit.serial?.serialNumber, url: qr.url, filename });
      }

      files.push({
        name: 'manifest.json',
        buffer: Buffer.from(
          JSON.stringify({ batchId, count: manifest.length, items: manifest }, null, 2),
        ),
      });

      const zipBuffer = await this.buildZip(files);
      return {
        batchId,
        count: qrCodes.length,
        format: 'ZIP' as const,
        data: zipBuffer.toString('base64'),
        manifest,
      };
    }

    const exports = await Promise.all(
      qrCodes.map(async (qr) => {
        if (format === 'SVG') {
          const svg = await this.renderService.renderSvg(qr.url, config);
          return {
            qrCodeId: qr.id,
            serial: qr.productUnit.serial?.serialNumber,
            url: qr.url,
            format,
            data: svg,
          };
        }
        const png = await this.renderService.render(qr.url, config);
        return {
          qrCodeId: qr.id,
          serial: qr.productUnit.serial?.serialNumber,
          url: qr.url,
          format,
          data: png.toString('base64'),
        };
      }),
    );

    return { batchId, count: exports.length, format, items: exports };
  }

  private async buildZip(files: Array<{ name: string; buffer: Buffer }>): Promise<Buffer> {
    const zip = new JSZip();
    for (const file of files) {
      zip.file(file.name, file.buffer);
    }
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  private async requireQr(tenantId: string, qrCodeId: string) {
    const qr = await this.prisma.client.qrCode.findFirst({
      where: { id: qrCodeId, tenantId },
      include: { productUnit: { include: { serial: true } } },
    });
    if (!qr) throw new NotFoundException('QR code not found');
    return qr;
  }
}
