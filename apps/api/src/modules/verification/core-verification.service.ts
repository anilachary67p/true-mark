import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import {
  AiMode,
  LifecycleStatus,
  VerificationMethod,
  VerificationResult,
  LocationSource,
  FraudSignalType,
} from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { DomainService } from '../domain/domain.service';
import { CredentialService } from '../credential/credential.service';
import {
  SignalEvaluatorService,
  LocationInput,
  mapLifecycleToResult,
} from '../fraud/signal-evaluator.service';

export interface VerificationResponse {
  result: VerificationResult;
  riskLevel: string;
  verificationPublicId: string;
  product?: {
    name: string;
    category: string;
    productType: string;
    productCode?: string;
    batch?: string;
    serial?: string;
    tags?: string[];
  };
  message: string;
  aiAvailable: boolean;
  aiMode: AiMode;
  correlationId: string;
}

@Injectable()
export class CoreVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainService: DomainService,
    private readonly credentialService: CredentialService,
    private readonly signalEvaluator: SignalEvaluatorService,
  ) {}

  async getConsumerBranding(hostname: string) {
    const domainRecord = await this.domainService.resolveTenantByHostname(hostname);
    if (!domainRecord) {
      return { companyDisplayName: null };
    }

    const profile = await this.prisma.client.tenantProfile.findUnique({
      where: { tenantId: domainRecord.tenantId },
      select: { companyDisplayName: true },
    });

    return {
      companyDisplayName: profile?.companyDisplayName ?? domainRecord.tenant.name,
    };
  }

  async verifyByQr(
    url: string,
    hostname: string,
    location?: LocationInput,
    correlationId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<VerificationResponse> {
    const domainRecord = await this.domainService.resolveTenantByHostname(hostname);
    if (!domainRecord) {
      return this.unableResponse(correlationId ?? uuidv4());
    }

    const token = this.extractQrToken(url, hostname);
    if (!token) {
      return this.unableResponse(correlationId ?? uuidv4());
    }

    return this.verifyCredential({
      tenantId: domainRecord.tenantId,
      token,
      method: VerificationMethod.QR_SCAN,
      verificationDomainId: domainRecord.id,
      domainConfigVersion: domainRecord.version,
      location,
      correlationId: correlationId ?? uuidv4(),
      ipAddress,
      userAgent,
    });
  }

  async verifyByCode(
    code: string,
    hostname: string,
    location?: LocationInput,
    correlationId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<VerificationResponse> {
    const domainRecord = await this.domainService.resolveTenantByHostname(hostname);
    if (!domainRecord) {
      return this.unableResponse(correlationId ?? uuidv4());
    }

    const normalized = this.credentialService.normalizeCode(code);
    const prefix = normalized.slice(0, 8);

    const credentials = await this.prisma.client.verificationCredential.findMany({
      where: { tenantId: domainRecord.tenantId, tokenPrefix: prefix },
      include: {
        productUnit: {
          include: {
            batch: {
              include: {
                productVariant: {
                  include: {
                    productType: { include: { category: true } },
                    tags: { include: { tag: true } },
                  },
                },
              },
            },
            serial: true,
            qrCode: true,
          },
        },
      },
      take: 10,
    });

    let matched = null;
    for (const cred of credentials) {
      const valid = await argon2.verify(cred.tokenHash, normalized).catch(() => false);
      if (valid) {
        matched = cred;
        break;
      }
    }

    if (!matched) {
      return this.recordAndReturn({
        tenantId: domainRecord.tenantId,
        result: VerificationResult.UNKNOWN_QR,
        method: VerificationMethod.MANUAL_CODE,
        verificationDomainId: domainRecord.id,
        correlationId: correlationId ?? uuidv4(),
        ipAddress,
        userAgent,
        location,
        riskLevel: 'LOW',
      });
    }

    return this.verifyCredential({
      tenantId: domainRecord.tenantId,
      credential: matched,
      method: VerificationMethod.MANUAL_CODE,
      verificationDomainId: domainRecord.id,
      domainConfigVersion: domainRecord.version,
      location,
      correlationId: correlationId ?? uuidv4(),
      ipAddress,
      userAgent,
    });
  }

  private async verifyCredential(params: {
    tenantId: string;
    token?: string;
    credential?: {
      status: LifecycleStatus;
      productUnitId: string;
      productUnit: {
        id: string;
        batch: {
          batchCode: string;
          expiryDate: Date | null;
          status: LifecycleStatus;
          productVariant: {
            name: string;
            productCode: string;
            productType: {
              name: string;
              category: { name: string };
            };
            tags?: Array<{ tag: { name: string } }>;
          };
        };
        serial?: { serialNumber: string } | null;
        qrCode?: { id: string; status: LifecycleStatus } | null;
      };
    };
    method: VerificationMethod;
    verificationDomainId: string;
    domainConfigVersion: number;
    location?: LocationInput;
    correlationId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<VerificationResponse> {
    const credential =
      params.credential ??
      (params.token ? await this.loadCredentialByToken(params.tenantId, params.token) : null);

    if (!credential) {
      return this.recordAndReturn({
        tenantId: params.tenantId,
        result: VerificationResult.UNKNOWN_QR,
        method: params.method,
        verificationDomainId: params.verificationDomainId,
        correlationId: params.correlationId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        location: params.location,
        riskLevel: 'LOW',
      });
    }

    if (credential.status !== LifecycleStatus.ACTIVE) {
      return this.recordAndReturn({
        tenantId: params.tenantId,
        productUnitId: credential.productUnitId,
        qrCodeId: credential.productUnit.qrCode?.id,
        result: mapLifecycleToResult(credential.status),
        method: params.method,
        verificationDomainId: params.verificationDomainId,
        domainConfigVersion: params.domainConfigVersion,
        correlationId: params.correlationId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        location: params.location,
        productSnapshot: this.buildSnapshot(credential.productUnit),
        riskLevel: 'LOW',
      });
    }

    const qrRecord = credential.productUnit.qrCode;
    if (qrRecord && qrRecord.status !== LifecycleStatus.ACTIVE) {
      return this.recordAndReturn({
        tenantId: params.tenantId,
        productUnitId: credential.productUnitId,
        qrCodeId: qrRecord.id,
        result: mapLifecycleToResult(qrRecord.status),
        method: params.method,
        verificationDomainId: params.verificationDomainId,
        domainConfigVersion: params.domainConfigVersion,
        correlationId: params.correlationId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        location: params.location,
        productSnapshot: this.buildSnapshot(credential.productUnit),
        riskLevel: 'LOW',
      });
    }

    const unit = credential.productUnit;
    const batch = unit.batch;
    const now = new Date();

    if (batch.expiryDate && batch.expiryDate < now) {
      return this.recordAndReturn({
        tenantId: params.tenantId,
        productUnitId: unit.id,
        qrCodeId: unit.qrCode?.id,
        result: VerificationResult.EXPIRED,
        method: params.method,
        verificationDomainId: params.verificationDomainId,
        domainConfigVersion: params.domainConfigVersion,
        correlationId: params.correlationId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        location: params.location,
        productSnapshot: this.buildSnapshot(unit),
        riskLevel: 'LOW',
      });
    }

    if (batch.status === LifecycleStatus.RECALLED) {
      return this.recordAndReturn({
        tenantId: params.tenantId,
        productUnitId: unit.id,
        qrCodeId: unit.qrCode?.id,
        result: VerificationResult.RECALLED,
        method: params.method,
        verificationDomainId: params.verificationDomainId,
        domainConfigVersion: params.domainConfigVersion,
        correlationId: params.correlationId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        location: params.location,
        productSnapshot: this.buildSnapshot(unit),
        riskLevel: 'LOW',
      });
    }

    // Serialize verifications of the same unit so concurrent scans of a cloned code
    // observe each other's events instead of all being classified as first-scan VERIFIED.
    return this.withUnitLock(unit.id, async () => {
      const previousEvents = await this.prisma.client.verificationEvent.findMany({
        where: { productUnitId: unit.id, tenantId: params.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { location: true },
      });

      const fraudConfig = await this.prisma.client.fraudConfig.findUnique({
        where: { tenantId: params.tenantId },
      });

      const windowStart = new Date(
        Date.now() - (fraudConfig?.highScanWindowMinutes ?? 30) * 60 * 1000,
      );
      const recentScans = previousEvents.filter((e) => e.createdAt >= windowStart).length;

      const evaluation = this.signalEvaluator.evaluateReuse({
        previousCount: previousEvents.length,
        lastLocation: previousEvents[0]?.location
          ? {
              country: previousEvents[0].location.country ?? undefined,
              region: previousEvents[0].location.region ?? undefined,
              city: previousEvents[0].location.city ?? undefined,
              latitude: previousEvents[0].location.latitude ?? undefined,
              longitude: previousEvents[0].location.longitude ?? undefined,
              source: previousEvents[0].location.source,
            }
          : null,
        currentLocation: params.location,
        lastVerifiedAt: previousEvents[0]?.createdAt,
        config: fraudConfig ?? undefined,
        recentScansInWindow: recentScans,
      });

      let result: VerificationResult = VerificationResult.VERIFIED;
      if (previousEvents.length > 0) {
        result = evaluation.suggestedResult ?? VerificationResult.REVERIFIED;
      }
      if (evaluation.suggestedResult === VerificationResult.POSSIBLE_CLONE) {
        result = VerificationResult.POSSIBLE_CLONE;
      } else if (evaluation.suggestedResult === VerificationResult.SUSPICIOUS) {
        result = VerificationResult.SUSPICIOUS;
      }

      const aiConfig = await this.prisma.client.aiConfig.findUnique({
        where: { tenantId: params.tenantId },
      });
      const aiMode = aiConfig?.mode ?? AiMode.AI_DISABLED;

      const response = await this.recordAndReturn({
        tenantId: params.tenantId,
        productUnitId: unit.id,
        qrCodeId: unit.qrCode?.id,
        result,
        method: params.method,
        verificationDomainId: params.verificationDomainId,
        domainConfigVersion: params.domainConfigVersion,
        correlationId: params.correlationId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        location: params.location,
        productSnapshot: this.buildSnapshot(unit),
        riskLevel: evaluation.riskLevel,
        fraudSignals: evaluation.signals,
        aiMode,
      });

      return response;
    });
  }

  private async withUnitLock<T>(productUnitId: string, fn: () => Promise<T>): Promise<T> {
    return this.prisma.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${productUnitId}, 0))`;
        return fn();
      },
      { maxWait: 5_000, timeout: 15_000 },
    );
  }

  /**
   * Accepts a full HTTPS verification URL or a raw QR payload (the token printed in the barcode).
   * URL payloads must use HTTPS and match the request hostname.
   */
  private extractQrToken(payload: string, hostname: string): string | null {
    const trimmed = payload.trim();
    if (!trimmed) return null;

    try {
      const parsedUrl = new URL(trimmed);
      if (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.hostname.toLowerCase() !== hostname.toLowerCase()
      ) {
        return null;
      }
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 1] ?? null;
    } catch {
      return trimmed;
    }
  }

  private async loadCredentialByToken(tenantId: string, token: string) {
    const qr = await this.prisma.client.qrCode.findFirst({
      where: { tenantId, token },
      include: {
        productUnit: {
          include: {
            verificationCredential: true,
            batch: {
              include: {
                productVariant: {
                  include: {
                    productType: { include: { category: true } },
                    tags: { include: { tag: true } },
                  },
                },
              },
            },
            serial: true,
            qrCode: true,
          },
        },
      },
    });

    if (!qr?.productUnit?.verificationCredential) return null;

    return {
      ...qr.productUnit.verificationCredential,
      productUnit: qr.productUnit,
    };
  }

  private buildSnapshot(unit: {
    batch: {
      batchCode: string;
      productVariant: {
        name: string;
        productCode: string;
        productType: {
          name: string;
          category: { name: string };
        };
        tags?: Array<{ tag: { name: string } }>;
      };
    };
    serial?: { serialNumber: string } | null;
  }) {
    const pv = unit.batch.productVariant;
    return {
      productName: pv.name,
      variantName: pv.name,
      category: pv.productType.category.name,
      productType: pv.productType.name,
      productCode: pv.productCode,
      batch: unit.batch.batchCode,
      serial: unit.serial?.serialNumber,
      tags: pv.tags?.map((t) => t.tag.name) ?? [],
    };
  }

  private unableResponse(correlationId: string): VerificationResponse {
    return {
      result: VerificationResult.UNABLE_TO_VERIFY,
      riskLevel: 'LOW',
      verificationPublicId: '',
      message:
        'This QR/code could not be verified. Please check that you are using the official TrueMark verification page.',
      aiAvailable: false,
      aiMode: AiMode.AI_DISABLED,
      correlationId,
    };
  }

  private async recordAndReturn(params: {
    tenantId: string;
    productUnitId?: string;
    qrCodeId?: string;
    result: VerificationResult;
    method: VerificationMethod;
    verificationDomainId?: string;
    domainConfigVersion?: number;
    correlationId: string;
    ipAddress?: string;
    userAgent?: string;
    location?: LocationInput;
    productSnapshot?: object;
    riskLevel: string;
    fraudSignals?: Array<{
      type: FraudSignalType;
      severity: string;
      evidence: Record<string, unknown>;
    }>;
    aiMode?: AiMode;
  }): Promise<VerificationResponse> {
    const event = await this.prisma.client.verificationEvent.create({
      data: {
        tenantId: params.tenantId,
        productUnitId: params.productUnitId,
        qrCodeId: params.qrCodeId,
        verificationDomainId: params.verificationDomainId,
        method: params.method,
        result: params.result,
        riskLevel: params.riskLevel,
        correlationId: params.correlationId,
        domainConfigVersion: params.domainConfigVersion,
        productSnapshot: params.productSnapshot,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        location: params.location
          ? {
              create: {
                country: params.location.country,
                region: params.location.region,
                city: params.location.city,
                latitude: params.location.latitude,
                longitude: params.location.longitude,
                source: (params.location.source as LocationSource) ?? LocationSource.UNKNOWN,
              },
            }
          : undefined,
        fraudSignals: params.fraudSignals?.length
          ? {
              create: params.fraudSignals.map((s) => ({
                signalType: s.type,
                severity: s.severity,
                evidence: s.evidence as object,
              })),
            }
          : undefined,
      },
    });

    const snapshot = params.productSnapshot as
      | {
          productName?: string;
          category?: string;
          productType?: string;
          productCode?: string;
          batch?: string;
          serial?: string;
          tags?: string[];
        }
      | undefined;

    const aiMode = params.aiMode ?? AiMode.AI_DISABLED;
    const messages: Record<VerificationResult, string> = {
      [VerificationResult.VERIFIED]: 'This product is registered with TrueMark.',
      [VerificationResult.REVERIFIED]: 'This product has been verified again.',
      [VerificationResult.SUSPICIOUS]: 'This product identity has unusual verification activity.',
      [VerificationResult.POSSIBLE_CLONE]: 'This product identity has unusual geographic activity.',
      [VerificationResult.POSSIBLE_COUNTERFEIT]:
        'This product may not be genuine. Please contact the manufacturer.',
      [VerificationResult.CONFIRMED_COUNTERFEIT]: 'This product has been confirmed as counterfeit.',
      [VerificationResult.INVALID_QR]: 'This QR/code could not be verified.',
      [VerificationResult.UNKNOWN_QR]: 'This QR/code could not be verified.',
      [VerificationResult.REVOKED_QR]: 'This QR code has been revoked.',
      [VerificationResult.BLOCKED_QR]: 'This QR code has been blocked.',
      [VerificationResult.EXPIRED]: 'This product has expired.',
      [VerificationResult.RECALLED]: 'This product/batch has been recalled by the manufacturer.',
      [VerificationResult.SUSPENDED]: 'This product verification is suspended.',
      [VerificationResult.UNABLE_TO_VERIFY]: 'This QR/code could not be verified.',
    };

    return {
      result: params.result,
      riskLevel: params.riskLevel,
      verificationPublicId: event.publicId,
      product: snapshot
        ? {
            name: snapshot.productName ?? '',
            category: snapshot.category ?? '',
            productType: snapshot.productType ?? '',
            productCode: snapshot.productCode,
            batch: snapshot.batch,
            serial: snapshot.serial,
            tags: snapshot.tags,
          }
        : undefined,
      message: messages[params.result],
      aiAvailable: aiMode !== AiMode.AI_DISABLED,
      aiMode,
      correlationId: params.correlationId,
    };
  }
}
