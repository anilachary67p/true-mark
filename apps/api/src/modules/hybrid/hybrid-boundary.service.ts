import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentType } from '@truemark/db';
import { EnvConfig } from '@truemark/config';
import { DataClassification, HybridTenantConfig, hybridTenantConfigSchema } from '@truemark/shared';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class HybridBoundaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  isHybridRuntime(): boolean {
    return this.config.get('HYBRID_MODE', { infer: true }) === 'CORE_ONPREM_AI_CLOUD';
  }

  async getTenantHybridConfig(tenantId: string): Promise<{
    deploymentType: DeploymentType;
    hybrid: HybridTenantConfig;
  }> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      include: { profile: true },
    });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const metadata = (tenant.profile?.metadata ?? {}) as Record<string, unknown>;
    const parsed = hybridTenantConfigSchema.safeParse(metadata.hybrid ?? {});
    return {
      deploymentType: tenant.deploymentType,
      hybrid: parsed.success ? parsed.data : {},
    };
  }

  async canTransferConsumerImages(
    tenantId: string,
  ): Promise<{ allowed: boolean; reason?: string; classification: DataClassification }> {
    const runtime = this.config.get('DEPLOYMENT_RUNTIME', { infer: true }) ?? 'cloud';
    const hybridMode = this.config.get('HYBRID_MODE', { infer: true });

    if (runtime !== 'on_prem' || hybridMode !== 'CORE_ONPREM_AI_CLOUD') {
      return { allowed: true, classification: 'TRANSIENT' };
    }

    const { deploymentType, hybrid } = await this.getTenantHybridConfig(tenantId);
    const consumerImages = hybrid.dataBoundary?.consumerImages;

    if (deploymentType === DeploymentType.HYBRID && consumerImages === 'cloud') {
      return { allowed: true, classification: 'TRANSIENT' };
    }

    if (deploymentType === DeploymentType.ON_PREM && consumerImages === 'cloud') {
      return { allowed: true, classification: 'TRANSIENT' };
    }

    return {
      allowed: false,
      classification: 'ON_PREM_ONLY',
      reason:
        'Consumer images cannot leave on-premises without explicit hybrid opt-in (dataBoundary.consumerImages=cloud).',
    };
  }

  async recordCrossBoundaryTransfer(params: {
    tenantId: string;
    resourceType: string;
    resourceId: string;
    classification: DataClassification;
    direction: 'outbound' | 'inbound';
  }) {
    if (!this.isHybridRuntime()) return;

    await this.audit.log({
      action: 'HYBRID_DATA_TRANSFER',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      tenantId: params.tenantId,
      after: {
        classification: params.classification,
        direction: params.direction,
        hybridMode: this.config.get('HYBRID_MODE', { infer: true }),
      },
    });
  }

  async checkGatewayReachable(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const gatewayUrl = this.config.get('AI_GATEWAY_URL', { infer: true });
    if (!this.isHybridRuntime() || !gatewayUrl) {
      return { ok: true };
    }

    const start = Date.now();
    try {
      const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}
