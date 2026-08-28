import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as dns from 'dns/promises';
import { DomainStatus, TenantStatus } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  normalizeCompanyDomainUrl,
  normalizeVerificationHostname,
  normalizeVerificationPath,
  assertDomainStatusTransition,
  assertTenantResourceAccess,
  duplicateDomain,
} from './domain-validation.util';

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class DomainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getTenantDomainConfiguration(tenantId: string) {
    const [tenant, companyDomains, verificationDomains] = await Promise.all([
      this.prisma.client.tenant.findUnique({
        where: { id: tenantId },
        include: { profile: true },
      }),
      this.listCompanyDomains(tenantId),
      this.listVerificationDomains(tenantId),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        legalName: tenant.legalName,
        status: tenant.status,
        deploymentType: tenant.deploymentType,
        configVersion: tenant.configVersion,
        profile: tenant.profile,
      },
      companyDomains,
      verificationDomains,
    };
  }

  async createCompanyDomain(
    tenantId: string,
    url: string,
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    const { url: normalizedUrl } = normalizeCompanyDomainUrl(url);

    const existing = await this.prisma.client.companyDomain.findFirst({
      where: { tenantId, url: normalizedUrl },
    });
    if (existing) {
      duplicateDomain('Company domain already configured for this tenant');
    }

    const domain = await this.prisma.client.companyDomain.create({
      data: { tenantId, url: normalizedUrl, status: DomainStatus.PENDING },
    });

    await this.bumpTenantConfigVersion(tenantId);
    await this.audit.log({
      action: 'COMPANY_DOMAIN_CREATED',
      resourceType: 'company_domain',
      resourceId: domain.id,
      tenantId,
      userId,
      after: domain,
      correlationId,
      ipAddress,
    });
    return domain;
  }

  async updateCompanyDomainStatus(
    tenantId: string,
    domainId: string,
    status: DomainStatus,
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    const domain = await this.getCompanyDomainForTenant(tenantId, domainId);
    assertDomainStatusTransition(domain.status, status, 'company domain');

    const updated = await this.prisma.client.companyDomain.update({
      where: { id: domainId },
      data: { status, version: { increment: 1 } },
    });

    await this.bumpTenantConfigVersion(tenantId);
    await this.audit.log({
      action: 'DOMAIN_STATUS_CHANGED',
      resourceType: 'company_domain',
      resourceId: domainId,
      tenantId,
      userId,
      before: { status: domain.status, version: domain.version },
      after: { status: updated.status, version: updated.version },
      correlationId,
      ipAddress,
    });
    return updated;
  }

  async activateCompanyDomain(
    tenantId: string,
    domainId: string,
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    return this.updateCompanyDomainStatus(
      tenantId,
      domainId,
      DomainStatus.ACTIVE,
      userId,
      correlationId,
      ipAddress,
    );
  }

  async createVerificationDomain(
    tenantId: string,
    hostnameInput: string,
    verificationPathInput = '/v',
    userId?: string,
    correlationId?: string,
    ipAddress?: string,
    setPrimary = false,
  ) {
    const hostname = normalizeVerificationHostname(hostnameInput);
    const verificationPath = normalizeVerificationPath(verificationPathInput);

    const taken = await this.prisma.client.verificationDomain.findUnique({
      where: { hostname },
    });
    if (taken && taken.tenantId !== tenantId) {
      duplicateDomain('Verification domain is already registered to another tenant');
    }
    if (taken) {
      duplicateDomain('Verification domain already exists for this tenant');
    }

    const txtRecord = `truemark-verify=${randomBytes(16).toString('hex')}`;

    const domain = await this.prisma.client.$transaction(async (tx) => {
      if (setPrimary) {
        await tx.verificationDomain.updateMany({
          where: { tenantId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.verificationDomain.create({
        data: {
          tenantId,
          hostname,
          verificationPath,
          status: DomainStatus.PENDING,
          isPrimary: setPrimary,
          challenges: {
            create: {
              txtRecord,
              expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
            },
          },
        },
        include: { challenges: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
    });

    await this.bumpTenantConfigVersion(tenantId);
    if (userId) {
      await this.audit.log({
        action: 'VERIFICATION_DOMAIN_CREATED',
        resourceType: 'verification_domain',
        resourceId: domain.id,
        tenantId,
        userId,
        after: { id: domain.id, hostname, verificationPath, status: domain.status },
        correlationId,
        ipAddress,
      });
    }

    return this.withDnsInstructions(domain);
  }

  async getVerificationChallenge(tenantId: string, domainId: string) {
    const domain = await this.getVerificationDomainForTenant(tenantId, domainId);
    const challenge = domain.challenges[0];
    if (!challenge) throw new BadRequestException('No verification challenge found');

    return {
      domainId: domain.id,
      hostname: domain.hostname,
      status: domain.status,
      challenge: {
        type: 'TXT',
        host: `_truemark.${domain.hostname}`,
        value: challenge.txtRecord,
        expiresAt: challenge.expiresAt,
        verifiedAt: challenge.verifiedAt,
      },
    };
  }

  async verifyDomain(
    tenantId: string,
    domainId: string,
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    const domain = await this.getVerificationDomainForTenant(tenantId, domainId);
    const challenge = domain.challenges[0];
    if (!challenge) throw new BadRequestException('No verification challenge found');

    if (challenge.expiresAt < new Date()) {
      throw new BadRequestException('Verification challenge has expired. Request a new challenge.');
    }

    const verified = await this.checkDnsTxtRecord(domain.hostname, challenge.txtRecord);

    if (!verified) {
      throw new BadRequestException('DNS verification failed. TXT record not found.');
    }

    const before = { status: domain.status, version: domain.version };
    const [, updated] = await this.prisma.client.$transaction([
      this.prisma.client.domainVerificationChallenge.update({
        where: { id: challenge.id },
        data: { verifiedAt: new Date() },
      }),
      this.prisma.client.verificationDomain.update({
        where: { id: domainId },
        data: { status: DomainStatus.ACTIVE, version: { increment: 1 } },
      }),
    ]);

    await this.bumpTenantConfigVersion(tenantId);
    await this.maybePromoteTenant(tenantId);

    await this.audit.log({
      action: 'VERIFICATION_DOMAIN_VERIFIED',
      resourceType: 'verification_domain',
      resourceId: domainId,
      tenantId,
      userId,
      before,
      after: { status: updated.status, version: updated.version },
      correlationId,
      ipAddress,
    });

    return updated;
  }

  async refreshVerificationChallenge(
    tenantId: string,
    domainId: string,
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    const domain = await this.getVerificationDomainForTenant(tenantId, domainId);
    if (domain.status === DomainStatus.ACTIVE) {
      throw new BadRequestException('Cannot refresh challenge for an active domain');
    }

    const txtRecord = `truemark-verify=${randomBytes(16).toString('hex')}`;
    const challenge = await this.prisma.client.domainVerificationChallenge.create({
      data: {
        verificationDomainId: domainId,
        txtRecord,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    await this.audit.log({
      action: 'VERIFICATION_DOMAIN_UPDATED',
      resourceType: 'verification_domain',
      resourceId: domainId,
      tenantId,
      userId,
      after: { challengeId: challenge.id, expiresAt: challenge.expiresAt },
      correlationId,
      ipAddress,
    });

    return {
      domainId,
      hostname: domain.hostname,
      challenge: {
        type: 'TXT',
        host: `_truemark.${domain.hostname}`,
        value: txtRecord,
        expiresAt: challenge.expiresAt,
      },
    };
  }

  async updateVerificationDomainStatus(
    tenantId: string,
    domainId: string,
    status: DomainStatus,
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    const domain = await this.getVerificationDomainForTenant(tenantId, domainId);
    assertDomainStatusTransition(domain.status, status, 'verification domain');

    const updated = await this.prisma.client.verificationDomain.update({
      where: { id: domainId },
      data: { status, version: { increment: 1 } },
    });

    await this.bumpTenantConfigVersion(tenantId);
    await this.audit.log({
      action: 'DOMAIN_STATUS_CHANGED',
      resourceType: 'verification_domain',
      resourceId: domainId,
      tenantId,
      userId,
      before: { status: domain.status, version: domain.version },
      after: { status: updated.status, version: updated.version },
      correlationId,
      ipAddress,
    });
    return updated;
  }

  async setPrimaryVerificationDomain(
    tenantId: string,
    domainId: string,
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    const domain = await this.getVerificationDomainForTenant(tenantId, domainId);
    if (domain.status !== DomainStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE verification domains can be set as primary');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.verificationDomain.updateMany({
        where: { tenantId, isPrimary: true },
        data: { isPrimary: false },
      }),
      this.prisma.client.verificationDomain.update({
        where: { id: domainId },
        data: { isPrimary: true, version: { increment: 1 } },
      }),
    ]);

    await this.bumpTenantConfigVersion(tenantId);
    await this.audit.log({
      action: 'VERIFICATION_DOMAIN_UPDATED',
      resourceType: 'verification_domain',
      resourceId: domainId,
      tenantId,
      userId,
      after: { isPrimary: true },
      correlationId,
      ipAddress,
    });

    return this.getVerificationDomainForTenant(tenantId, domainId);
  }

  async resolveTenantByHostname(hostname: string) {
    const normalized = hostname.toLowerCase().split(':')[0];
    return this.prisma.client.verificationDomain.findFirst({
      where: { hostname: normalized, status: DomainStatus.ACTIVE },
      include: { tenant: true },
    });
  }

  async getActivePrimaryDomain(tenantId: string) {
    return this.prisma.client.verificationDomain.findFirst({
      where: { tenantId, status: DomainStatus.ACTIVE, isPrimary: true },
    });
  }

  async listCompanyDomains(tenantId: string) {
    return this.prisma.client.companyDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listVerificationDomains(tenantId: string) {
    const domains = await this.prisma.client.verificationDomain.findMany({
      where: { tenantId },
      include: { challenges: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map((d) => this.withDnsInstructions(d));
  }

  private async getCompanyDomainForTenant(tenantId: string, domainId: string) {
    const domain = await this.prisma.client.companyDomain.findUnique({ where: { id: domainId } });
    if (!domain) throw new NotFoundException('Domain not found');
    assertTenantResourceAccess(domain.tenantId, tenantId);
    return domain;
  }

  private async getVerificationDomainForTenant(tenantId: string, domainId: string) {
    const domain = await this.prisma.client.verificationDomain.findUnique({
      where: { id: domainId },
      include: { challenges: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!domain) throw new NotFoundException('Domain not found');
    assertTenantResourceAccess(domain.tenantId, tenantId);
    return domain;
  }

  private withDnsInstructions(domain: {
    id: string;
    hostname: string;
    verificationPath: string;
    status: DomainStatus;
    version: number;
    isPrimary: boolean;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
    challenges?: Array<{ txtRecord: string; expiresAt: Date; verifiedAt: Date | null }>;
  }) {
    const challenge = domain.challenges?.[0];
    return {
      ...domain,
      challenges: undefined,
      dnsInstructions: challenge
        ? {
            type: 'TXT',
            host: `_truemark.${domain.hostname}`,
            value: challenge.txtRecord,
            expiresAt: challenge.expiresAt,
            verifiedAt: challenge.verifiedAt,
          }
        : null,
      verificationUrlExample: `https://${domain.hostname}${domain.verificationPath}/<token>`,
    };
  }

  private async checkDnsTxtRecord(hostname: string, expected: string): Promise<boolean> {
    try {
      const records = await dns.resolveTxt(`_truemark.${hostname}`);
      const flat = records.map((r) => r.join(''));
      return flat.some((r) => r === expected);
    } catch {
      if (process.env.NODE_ENV === 'development' && process.env.DNS_VERIFY_BYPASS === 'true') {
        return true;
      }
      return false;
    }
  }

  private async bumpTenantConfigVersion(tenantId: string) {
    await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: { configVersion: { increment: 1 } },
    });
  }

  private async maybePromoteTenant(tenantId: string) {
    const activeVerification = await this.prisma.client.verificationDomain.count({
      where: { tenantId, status: DomainStatus.ACTIVE },
    });
    if (activeVerification > 0) {
      await this.prisma.client.tenant.updateMany({
        where: { id: tenantId, status: TenantStatus.PENDING },
        data: { status: TenantStatus.ACTIVE },
      });
    }
  }
}
