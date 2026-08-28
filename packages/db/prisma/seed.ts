import { PrismaClient, UserRole, TenantStatus, DeploymentType, DomainStatus, LifecycleStatus, AiMode } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function hashToken(plaintext: string) {
  return argon2.hash(plaintext, { type: argon2.argon2id });
}

async function main() {
  const passwordHash = await argon2.hash('Admin123!@#');

  await prisma.user.upsert({
    where: { email: 'admin@truemark.local' },
    update: {},
    create: {
      email: 'admin@truemark.local',
      name: 'Platform Admin',
      passwordHash,
      tenantRoles: { create: { role: UserRole.PLATFORM_ADMIN, tenantId: null } },
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'ABC Pharmaceuticals',
      legalName: 'ABC Pharmaceuticals Ltd.',
      status: TenantStatus.ACTIVE,
      deploymentType: DeploymentType.SAAS,
      profile: { create: { contactEmail: 'contact@abcpharma.com', country: 'IN' } },
      fraudConfig: { create: {} },
      aiConfig: { create: { mode: AiMode.AI_OPTIONAL } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'tenant-admin@abcpharma.com' },
    update: {},
    create: {
      email: 'tenant-admin@abcpharma.com',
      name: 'ABC Tenant Admin',
      passwordHash,
      tenantRoles: { create: { role: UserRole.TENANT_ADMIN, tenantId: tenant.id } },
    },
  });

  await prisma.companyDomain.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: tenant.id,
      url: 'https://www.abcpharma.com',
      status: DomainStatus.ACTIVE,
    },
  });

  const verifyDomain = await prisma.verificationDomain.upsert({
    where: { hostname: 'verify.localhost' },
    update: { status: DomainStatus.ACTIVE, isPrimary: true },
    create: {
      tenantId: tenant.id,
      hostname: 'verify.localhost',
      verificationPath: '/v',
      status: DomainStatus.ACTIVE,
      isPrimary: true,
    },
  });

  const manufacturer = await prisma.manufacturer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000100' },
    update: { name: 'ABC Pharmaceuticals' },
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      tenantId: tenant.id,
      name: 'ABC Pharmaceuticals',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const brand = await prisma.brand.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: { name: 'ABC Pharma' },
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      tenantId: tenant.id,
      manufacturerId: manufacturer.id,
      name: 'ABC Pharma',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: { name: 'ABC Shampoo 500ml', sku: 'ABC-SHP-500' },
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      tenantId: tenant.id,
      brandId: brand.id,
      name: 'ABC Shampoo 500ml',
      sku: 'ABC-SHP-500',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000103' },
    update: { name: 'Standard' },
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      tenantId: tenant.id,
      productId: product.id,
      name: 'Standard',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const batch = await prisma.batch.upsert({
    where: { id: '00000000-0000-0000-0000-000000000104' },
    update: { batchCode: 'BATCH-2026-08' },
    create: {
      id: '00000000-0000-0000-0000-000000000104',
      tenantId: tenant.id,
      productVariantId: variant.id,
      batchCode: 'BATCH-2026-08',
      status: LifecycleStatus.ACTIVE,
      manufacturingDate: new Date('2026-01-01'),
      expiryDate: new Date('2028-01-01'),
    },
  });

  const existingUnits = await prisma.productUnit.count({ where: { batchId: batch.id } });
  if (existingUnits === 0) {
    for (let i = 1; i <= 3; i++) {
      const bytes = randomBytes(16);
      const hex = bytes.toString('hex').toUpperCase();
      const parts = hex.match(/.{1,4}/g) ?? [];
      const tokenPart = parts.slice(0, 3).join('-');
      const plaintext = `TM-${tokenPart}`;
      const tokenHash = await hashToken(plaintext);
      const prefix = plaintext.slice(0, 8);
      const qrToken = randomBytes(16).toString('base64url');
      const serialNumber = `SN-ABC-2026-${String(i).padStart(6, '0')}`;

      const unit = await prisma.productUnit.create({
        data: { tenantId: tenant.id, batchId: batch.id, status: LifecycleStatus.REGISTERED },
      });

      await prisma.serial.create({
        data: { tenantId: tenant.id, productUnitId: unit.id, serialNumber },
      });

      await prisma.verificationCredential.create({
        data: {
          tenantId: tenant.id,
          productUnitId: unit.id,
          tokenHash,
          tokenPrefix: prefix,
          status: LifecycleStatus.ACTIVE,
        },
      });

      await prisma.qrCode.create({
        data: {
          tenantId: tenant.id,
          productUnitId: unit.id,
          token: qrToken,
          url: `https://${verifyDomain.hostname}${verifyDomain.verificationPath}/${qrToken}`,
          status: LifecycleStatus.ACTIVE,
          domainVersion: verifyDomain.version,
        },
      });
    }
  }

  // Deterministic E2E / DR drill fixture (idempotent upsert)
  const e2eManualCode = 'TM-E2E0-FIXD-0001';
  const e2eQrToken = 'e2eFixedQrToken0001';
  const e2eUnitId = '00000000-0000-0000-0000-000000000200';
  const e2eCredentialHash = await hashToken(e2eManualCode);

  await prisma.productUnit.upsert({
    where: { id: e2eUnitId },
    update: { status: LifecycleStatus.REGISTERED },
    create: {
      id: e2eUnitId,
      tenantId: tenant.id,
      batchId: batch.id,
      status: LifecycleStatus.REGISTERED,
    },
  });

  await prisma.serial.upsert({
    where: { productUnitId: e2eUnitId },
    update: { serialNumber: 'SN-E2E-000001' },
    create: {
      tenantId: tenant.id,
      productUnitId: e2eUnitId,
      serialNumber: 'SN-E2E-000001',
    },
  });

  await prisma.verificationCredential.upsert({
    where: { productUnitId: e2eUnitId },
    update: {
      tokenHash: e2eCredentialHash,
      tokenPrefix: e2eManualCode.slice(0, 8),
      status: LifecycleStatus.ACTIVE,
    },
    create: {
      tenantId: tenant.id,
      productUnitId: e2eUnitId,
      tokenHash: e2eCredentialHash,
      tokenPrefix: e2eManualCode.slice(0, 8),
      status: LifecycleStatus.ACTIVE,
    },
  });

  await prisma.qrCode.upsert({
    where: { productUnitId: e2eUnitId },
    update: {
      token: e2eQrToken,
      url: `https://${verifyDomain.hostname}${verifyDomain.verificationPath}/${e2eQrToken}`,
      status: LifecycleStatus.ACTIVE,
    },
    create: {
      tenantId: tenant.id,
      productUnitId: e2eUnitId,
      token: e2eQrToken,
      url: `https://${verifyDomain.hostname}${verifyDomain.verificationPath}/${e2eQrToken}`,
      status: LifecycleStatus.ACTIVE,
      domainVersion: verifyDomain.version,
    },
  });

  console.log('Seed completed:', {
    tenant: tenant.name,
    verificationDomain: verifyDomain.hostname,
    batch: batch.batchCode,
    sampleUnits: await prisma.productUnit.count({ where: { batchId: batch.id } }),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
