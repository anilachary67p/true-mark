import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeploymentType, TenantStatus, UserRole } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface UpdateTenantProfileInput {
  address?: string;
  country?: string;
  contactEmail?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    data: { name: string; legalName?: string; deploymentType?: DeploymentType },
    userId: string,
    correlationId?: string,
    ipAddress?: string,
  ) {
    const tenant = await this.prisma.client.tenant.create({
      data: {
        name: data.name,
        legalName: data.legalName,
        deploymentType: data.deploymentType ?? DeploymentType.SAAS,
        status: TenantStatus.PENDING,
        profile: { create: {} },
        fraudConfig: { create: {} },
        aiConfig: { create: {} },
      },
      include: { profile: true },
    });

    await this.audit.log({
      action: 'TENANT_CREATED',
      resourceType: 'tenant',
      resourceId: tenant.id,
      tenantId: tenant.id,
      userId,
      after: tenant,
      correlationId,
      ipAddress,
    });

    return tenant;
  }

  async findAll(userRoles: UserRole[], tenantIds: string[]) {
    if (userRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return this.prisma.client.tenant.findMany({
        include: {
          profile: true,
          companyDomains: true,
          verificationDomains: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.client.tenant.findMany({
      where: { id: { in: tenantIds } },
      include: {
        profile: true,
        companyDomains: true,
        verificationDomains: true,
      },
    });
  }

  async findOne(id: string, userRoles: UserRole[], tenantIds: string[]) {
    this.assertTenantAccess(id, userRoles, tenantIds);
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id },
      include: { profile: true, companyDomains: true, verificationDomains: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async getConfiguration(id: string, userRoles: UserRole[], tenantIds: string[]) {
    const tenant = await this.findOne(id, userRoles, tenantIds);
    return {
      id: tenant.id,
      name: tenant.name,
      legalName: tenant.legalName,
      status: tenant.status,
      deploymentType: tenant.deploymentType,
      configVersion: tenant.configVersion,
      profile: tenant.profile,
      companyDomains: tenant.companyDomains,
      verificationDomains: tenant.verificationDomains,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async update(
    id: string,
    data: Partial<{ name: string; legalName: string; status: TenantStatus; deploymentType: DeploymentType }>,
    userId: string,
    userRoles: UserRole[],
    tenantIds: string[],
    correlationId?: string,
    ipAddress?: string,
  ) {
    this.assertTenantAccess(id, userRoles, tenantIds);
    const before = await this.prisma.client.tenant.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Tenant not found');

    if (data.status && data.status !== before.status) {
      if (!userRoles.includes(UserRole.PLATFORM_ADMIN) && data.status !== TenantStatus.ACTIVE) {
        throw new ForbiddenException('Only platform administrators can change tenant status');
      }
    }

    if (data.deploymentType && !userRoles.includes(UserRole.PLATFORM_ADMIN)) {
      throw new ForbiddenException('Only platform administrators can change deployment type');
    }

    const tenant = await this.prisma.client.tenant.update({
      where: { id },
      data: {
        ...data,
        configVersion: { increment: 1 },
      },
    });

    const action =
      data.status && data.status !== before.status ? 'TENANT_STATUS_CHANGED' : 'TENANT_UPDATED';

    await this.audit.log({
      action,
      resourceType: 'tenant',
      resourceId: id,
      tenantId: id,
      userId,
      before,
      after: tenant,
      correlationId,
      ipAddress,
    });
    return tenant;
  }

  async updateProfile(
    tenantId: string,
    data: UpdateTenantProfileInput,
    userId: string,
    userRoles: UserRole[],
    tenantIds: string[],
    correlationId?: string,
    ipAddress?: string,
  ) {
    this.assertTenantAccess(tenantId, userRoles, tenantIds);
    const before = await this.prisma.client.tenantProfile.findUnique({ where: { tenantId } });

    const profile = await this.prisma.client.tenantProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        address: data.address,
        country: data.country,
        contactEmail: data.contactEmail,
        metadata: (data.metadata ?? {}) as object,
      },
      update: {
        address: data.address,
        country: data.country,
        contactEmail: data.contactEmail,
        metadata: data.metadata ? (data.metadata as object) : undefined,
      },
    });

    await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: { configVersion: { increment: 1 } },
    });

    await this.audit.log({
      action: 'TENANT_CONFIGURATION_CHANGED',
      resourceType: 'tenant_profile',
      resourceId: profile.id,
      tenantId,
      userId,
      before,
      after: profile,
      correlationId,
      ipAddress,
    });

    return profile;
  }

  private assertTenantAccess(tenantId: string, userRoles: UserRole[], tenantIds: string[]) {
    if (userRoles.includes(UserRole.PLATFORM_ADMIN)) return;
    if (!tenantIds.includes(tenantId)) {
      throw new NotFoundException('Tenant not found');
    }
  }
}
