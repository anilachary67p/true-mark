import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '@truemark/config';
import {
  LicenseCommercialModel,
  LicenseDeploymentModel,
  LicensePayload,
  LicenseStatus,
  SignedLicenseFile,
  computeLicenseStatus,
  daysUntilExpiry,
  encryptLicenseBackup,
  graceDaysRemaining,
  mapDeploymentTypeToLicenseModel,
  parseLicenseFile,
  serializeLicenseFile,
  signLicensePayload,
  verifySignedLicense,
} from '@truemark/shared';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../providers/prisma.service';

export type TenantLicenseStatusView = {
  tenantId: string;
  licenseId?: string;
  organizationName?: string;
  deploymentModel?: LicenseDeploymentModel;
  commercialModel?: LicenseCommercialModel;
  status: LicenseStatus;
  validFrom?: string;
  validUntil?: string;
  daysUntilExpiry?: number;
  graceDaysRemaining?: number;
  productOwnerEmail?: string;
  productOwnerPhone?: string;
  message?: string;
};

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private readonly statusCache = new Map<string, TenantLicenseStatusView>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async onModuleInit() {
    if (this.config.get('SKIP_LICENSE_CHECK', { infer: true })) {
      this.logger.warn('License checks are disabled (SKIP_LICENSE_CHECK=true)');
      return;
    }
    await this.validateAllTenants('startup');
  }

  getLicenseRootDir(): string {
    const configured = this.config.get('LICENSE_DIR', { infer: true });
    if (configured) return configured;
    return path.resolve(process.cwd(), '../..');
  }

  getLicenseFilePath(tenantId: string, deploymentModel: LicenseDeploymentModel): string {
    const root = this.getLicenseRootDir();
    if (deploymentModel === LicenseDeploymentModel.DEDICATED) {
      return path.join(root, 'license.truemark');
    }
    return path.join(root, 'licenses', `${tenantId}.truemark`);
  }

  async issueLicense(params: {
    tenantId: string;
    organizationName: string;
    deploymentType: string;
    commercialModel: LicenseCommercialModel;
    validUntil: Date;
    validFrom?: Date;
    productOwnerEmail?: string;
    productOwnerPhone?: string;
  }) {
    const privateKey = this.requirePrivateKey();
    const publicKey = this.requirePublicKey();
    const backupKey = this.requireBackupKey();
    const tenant = await this.prisma.client.tenant.findUnique({ where: { id: params.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const deploymentModel = mapDeploymentTypeToLicenseModel(params.deploymentType);
    const validFrom = params.validFrom ?? new Date();
    const payload: LicensePayload = {
      version: 1,
      licenseId: randomUUID(),
      organizationName: params.organizationName,
      tenantId: params.tenantId,
      truemarkInstanceId: this.config.get('INSTALLATION_ID', { infer: true })!,
      deploymentModel,
      commercialModel: params.commercialModel,
      issuedAt: new Date().toISOString(),
      validFrom: validFrom.toISOString(),
      validUntil: params.validUntil.toISOString(),
      productOwnerEmail:
        params.productOwnerEmail ?? this.config.get('PRODUCT_OWNER_EMAIL', { infer: true })!,
      productOwnerPhone:
        params.productOwnerPhone ?? this.config.get('PRODUCT_OWNER_PHONE', { infer: true }),
    };

    const signed = signLicensePayload(payload, privateKey);
    const verified = verifySignedLicense(signed, publicKey);
    if (!verified.valid || !verified.payload) {
      throw new BadRequestException(verified.error ?? 'Failed to sign license');
    }

    const fileContent = serializeLicenseFile(signed);
    const filePath = this.getLicenseFilePath(params.tenantId, deploymentModel);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, fileContent, 'utf8');

    const encryptedBackup = encryptLicenseBackup(fileContent, backupKey);
    const record = await this.prisma.client.tenantLicense.upsert({
      where: { tenantId: params.tenantId },
      create: {
        tenantId: params.tenantId,
        licenseId: payload.licenseId,
        organizationName: payload.organizationName,
        deploymentModel: payload.deploymentModel,
        commercialModel: payload.commercialModel,
        instanceId: payload.truemarkInstanceId,
        validFrom,
        validUntil: params.validUntil,
        issuedAt: new Date(payload.issuedAt),
        productOwnerEmail: payload.productOwnerEmail,
        productOwnerPhone: payload.productOwnerPhone,
        licenseFile: fileContent,
        encryptedBackup,
      },
      update: {
        licenseId: payload.licenseId,
        organizationName: payload.organizationName,
        deploymentModel: payload.deploymentModel,
        commercialModel: payload.commercialModel,
        instanceId: payload.truemarkInstanceId,
        validFrom,
        validUntil: params.validUntil,
        issuedAt: new Date(payload.issuedAt),
        productOwnerEmail: payload.productOwnerEmail,
        productOwnerPhone: payload.productOwnerPhone,
        licenseFile: fileContent,
        encryptedBackup,
      },
    });

    const status = this.buildStatusView(verified.payload);
    this.statusCache.set(params.tenantId, status);
    this.logger.log(`License issued for tenant ${params.tenantId} → ${filePath}`);
    return { record, filePath, status };
  }

  async renewLicense(tenantId: string, validUntil: Date) {
    const existing = await this.prisma.client.tenantLicense.findUnique({ where: { tenantId } });
    if (!existing) throw new NotFoundException('No license found for tenant');

    const tenant = await this.prisma.client.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.issueLicense({
      tenantId,
      organizationName: existing.organizationName,
      deploymentType: tenant.deploymentType,
      commercialModel: existing.commercialModel as LicenseCommercialModel,
      validUntil,
      productOwnerEmail: existing.productOwnerEmail,
      productOwnerPhone: existing.productOwnerPhone ?? undefined,
    });
  }

  async installLicenseFile(content: string) {
    const publicKey = this.requirePublicKey();
    const backupKey = this.requireBackupKey();
    const file = parseLicenseFile(content);
    const verified = verifySignedLicense(file, publicKey);
    if (!verified.valid || !verified.payload) {
      throw new BadRequestException(verified.error ?? 'Invalid license file');
    }

    const instanceId = this.config.get('INSTALLATION_ID', { infer: true })!;
    if (verified.payload.truemarkInstanceId !== instanceId) {
      throw new ForbiddenException('License is not issued for this deployment instance');
    }

    const filePath = this.getLicenseFilePath(
      verified.payload.tenantId,
      verified.payload.deploymentModel,
    );
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');

    const encryptedBackup = encryptLicenseBackup(content, backupKey);
    await this.prisma.client.tenantLicense.upsert({
      where: { tenantId: verified.payload.tenantId },
      create: {
        tenantId: verified.payload.tenantId,
        licenseId: verified.payload.licenseId,
        organizationName: verified.payload.organizationName,
        deploymentModel: verified.payload.deploymentModel,
        commercialModel: verified.payload.commercialModel,
        instanceId: verified.payload.truemarkInstanceId,
        validFrom: new Date(verified.payload.validFrom),
        validUntil: new Date(verified.payload.validUntil),
        issuedAt: new Date(verified.payload.issuedAt),
        productOwnerEmail: verified.payload.productOwnerEmail,
        productOwnerPhone: verified.payload.productOwnerPhone,
        licenseFile: content,
        encryptedBackup,
      },
      update: {
        licenseId: verified.payload.licenseId,
        organizationName: verified.payload.organizationName,
        deploymentModel: verified.payload.deploymentModel,
        commercialModel: verified.payload.commercialModel,
        instanceId: verified.payload.truemarkInstanceId,
        validFrom: new Date(verified.payload.validFrom),
        validUntil: new Date(verified.payload.validUntil),
        issuedAt: new Date(verified.payload.issuedAt),
        productOwnerEmail: verified.payload.productOwnerEmail,
        productOwnerPhone: verified.payload.productOwnerPhone,
        licenseFile: content,
        encryptedBackup,
      },
    });

    const status = this.buildStatusView(verified.payload);
    this.statusCache.set(verified.payload.tenantId, status);
    return { filePath, status };
  }

  async getTenantLicenseStatus(tenantId: string): Promise<TenantLicenseStatusView> {
    if (this.config.get('SKIP_LICENSE_CHECK', { infer: true })) {
      return {
        tenantId,
        status: LicenseStatus.ACTIVE,
        daysUntilExpiry: 365,
      };
    }

    const cached = this.statusCache.get(tenantId);
    if (cached) return cached;

    const status = await this.validateTenantLicense(tenantId);
    this.statusCache.set(tenantId, status);
    return status;
  }

  async validateAllTenants(trigger: string) {
    const tenants = await this.prisma.client.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      const status = await this.validateTenantLicense(tenant.id);
      this.statusCache.set(tenant.id, status);
      if (
        status.status === LicenseStatus.BLOCKED ||
        status.status === LicenseStatus.EXPIRED_GRACE
      ) {
        this.logger.warn(
          `License ${status.status} for tenant ${tenant.id} (trigger=${trigger})`,
        );
      }
    }
    return { tenants: tenants.length, trigger };
  }

  listLicenses() {
    return this.prisma.client.tenantLicense.findMany({
      orderBy: { validUntil: 'asc' },
      select: {
        tenantId: true,
        licenseId: true,
        organizationName: true,
        deploymentModel: true,
        commercialModel: true,
        validUntil: true,
        productOwnerEmail: true,
      },
    });
  }

  async issueLicenseForTenant(dto: {
    tenantId: string;
    commercialModel: LicenseCommercialModel;
    validUntil: string;
    productOwnerEmail?: string;
    productOwnerPhone?: string;
  }) {
    const tenant = await this.prisma.client.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.issueLicense({
      tenantId: dto.tenantId,
      organizationName: tenant.name,
      deploymentType: tenant.deploymentType,
      commercialModel: dto.commercialModel,
      validUntil: new Date(dto.validUntil),
      productOwnerEmail: dto.productOwnerEmail,
      productOwnerPhone: dto.productOwnerPhone,
    });
  }

  private async validateTenantLicense(tenantId: string): Promise<TenantLicenseStatusView> {
    const publicKey = this.requirePublicKey();
    const record = await this.prisma.client.tenantLicense.findUnique({ where: { tenantId } });
    if (!record) {
      return {
        tenantId,
        status: LicenseStatus.MISSING,
        message: 'No license found for this tenant',
        productOwnerEmail: this.config.get('PRODUCT_OWNER_EMAIL', { infer: true }),
        productOwnerPhone: this.config.get('PRODUCT_OWNER_PHONE', { infer: true }),
      };
    }

    let fileContent = record.licenseFile;
    try {
      const filePath = this.getLicenseFilePath(
        tenantId,
        record.deploymentModel as LicenseDeploymentModel,
      );
      fileContent = await readFile(filePath, 'utf8');
    } catch {
      // fall back to DB copy
    }

    try {
      const verified = verifySignedLicense(parseLicenseFile(fileContent), publicKey);
      if (!verified.valid || !verified.payload) {
        return {
          tenantId,
          status: LicenseStatus.INVALID,
          message: verified.error ?? 'License verification failed',
          productOwnerEmail: record.productOwnerEmail,
          productOwnerPhone: record.productOwnerPhone ?? undefined,
        };
      }

      const instanceId = this.config.get('INSTALLATION_ID', { infer: true })!;
      if (verified.payload.tenantId !== tenantId) {
        return {
          tenantId,
          status: LicenseStatus.INVALID,
          message: 'License tenant mismatch',
          productOwnerEmail: record.productOwnerEmail,
        };
      }
      if (verified.payload.truemarkInstanceId !== instanceId) {
        return {
          tenantId,
          status: LicenseStatus.INVALID,
          message: 'License deployment instance mismatch',
          productOwnerEmail: record.productOwnerEmail,
        };
      }

      return this.buildStatusView(verified.payload);
    } catch (err) {
      return {
        tenantId,
        status: LicenseStatus.INVALID,
        message: err instanceof Error ? err.message : 'Invalid license',
        productOwnerEmail: record.productOwnerEmail,
      };
    }
  }

  private buildStatusView(payload: LicensePayload): TenantLicenseStatusView {
    const validUntil = new Date(payload.validUntil);
    const graceDays = this.config.get('LICENSE_GRACE_DAYS', { infer: true }) ?? 15;
    const status = computeLicenseStatus(validUntil, new Date(), graceDays);
    return {
      tenantId: payload.tenantId,
      licenseId: payload.licenseId,
      organizationName: payload.organizationName,
      deploymentModel: payload.deploymentModel,
      commercialModel: payload.commercialModel,
      status,
      validFrom: payload.validFrom,
      validUntil: payload.validUntil,
      daysUntilExpiry: daysUntilExpiry(validUntil),
      graceDaysRemaining:
        status === LicenseStatus.EXPIRED_GRACE ? graceDaysRemaining(validUntil, new Date(), graceDays) : 0,
      productOwnerEmail: payload.productOwnerEmail,
      productOwnerPhone: payload.productOwnerPhone,
    };
  }

  private requirePublicKey(): string {
    const key = this.config.get('LICENSE_SIGNING_PUBLIC_KEY', { infer: true });
    if (!key) throw new BadRequestException('LICENSE_SIGNING_PUBLIC_KEY is not configured');
    return key.replace(/\\n/g, '\n');
  }

  private requirePrivateKey(): string {
    const key = this.config.get('LICENSE_SIGNING_PRIVATE_KEY', { infer: true });
    if (!key) {
      throw new ForbiddenException(
        'License signing key is not available on this deployment. Only the product owner can generate licenses.',
      );
    }
    return key.replace(/\\n/g, '\n');
  }

  private requireBackupKey(): string {
    const key = this.config.get('LICENSE_BACKUP_KEY', { infer: true });
    if (!key) throw new BadRequestException('LICENSE_BACKUP_KEY is not configured');
    return key;
  }
}
