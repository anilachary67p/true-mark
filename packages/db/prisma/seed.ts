import {
  PrismaClient,
  UserRole,
  TenantStatus,
  DeploymentType,
  DomainStatus,
  LifecycleStatus,
  AiMode,
  VerificationMethod,
  VerificationResult,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import {
  LicenseCommercialModel,
  LicenseDeploymentModel,
  encryptLicenseBackup,
  mapDeploymentTypeToLicenseModel,
  serializeLicenseFile,
  signLicensePayload,
} from '@truemark/shared';

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
      profile: {
        create: {
          contactEmail: 'contact@abcpharma.com',
          country: 'IN',
          companyDisplayName: 'ABC Manufacture',
        },
      },
      fraudConfig: { create: {} },
      aiConfig: { create: { mode: AiMode.AI_OPTIONAL } },
    },
  });

  await prisma.tenantProfile.upsert({
    where: { tenantId: tenant.id },
    update: { companyDisplayName: 'ABC Manufacture' },
    create: {
      tenantId: tenant.id,
      contactEmail: 'contact@abcpharma.com',
      country: 'IN',
      companyDisplayName: 'ABC Manufacture',
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

  const categoryPersonalCare = await prisma.category.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Personal Care' } },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      tenantId: tenant.id,
      name: 'Personal Care',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const productTypeShampooA = await prisma.productType.upsert({
    where: {
      tenantId_categoryId_name: {
        tenantId: tenant.id,
        categoryId: categoryPersonalCare.id,
        name: 'Shampoo A',
      },
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      tenantId: tenant.id,
      categoryId: categoryPersonalCare.id,
      name: 'Shampoo A',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const variant100 = await prisma.productVariant.upsert({
    where: { tenantId_productCode: { tenantId: tenant.id, productCode: 'TM-SEED100ML' } },
    update: { name: 'Shampoo A 100ml' },
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      tenantId: tenant.id,
      productTypeId: productTypeShampooA.id,
      name: 'Shampoo A 100ml',
      productCode: 'TM-SEED100ML',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const variant500 = await prisma.productVariant.upsert({
    where: { tenantId_productCode: { tenantId: tenant.id, productCode: 'TM-SEED500ML' } },
    update: { name: 'Shampoo A 500ml' },
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      tenantId: tenant.id,
      productTypeId: productTypeShampooA.id,
      name: 'Shampoo A 500ml',
      productCode: 'TM-SEED500ML',
      status: LifecycleStatus.ACTIVE,
    },
  });

  for (const [variantId, tagNames] of [
    [variant100.id, ['SH-A', 'SH-A-100']] as const,
    [variant500.id, ['SH-A', 'SH-A-500']] as const,
  ]) {
    for (const tagName of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: tagName } },
        create: { tenantId: tenant.id, name: tagName },
        update: {},
      });
      await prisma.productVariantTag.upsert({
        where: { productVariantId_tagId: { productVariantId: variantId, tagId: tag.id } },
        create: { productVariantId: variantId, tagId: tag.id },
        update: {},
      });
    }
  }

  const variant = variant500;

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

  const scanQrPayload = '1234512345123451234512345';
  const scanUnitId = '00000000-0000-0000-0000-000000000201';
  const scanManualCode = 'TM-SCAN-12345-0001';
  const scanCredentialHash = await hashToken(scanManualCode);

  await prisma.productUnit.upsert({
    where: { id: scanUnitId },
    update: { status: LifecycleStatus.REGISTERED },
    create: {
      id: scanUnitId,
      tenantId: tenant.id,
      batchId: batch.id,
      status: LifecycleStatus.REGISTERED,
    },
  });

  await prisma.serial.upsert({
    where: { productUnitId: scanUnitId },
    update: { serialNumber: 'SN-SCAN-12345' },
    create: {
      tenantId: tenant.id,
      productUnitId: scanUnitId,
      serialNumber: 'SN-SCAN-12345',
    },
  });

  await prisma.verificationCredential.upsert({
    where: { productUnitId: scanUnitId },
    update: {
      tokenHash: scanCredentialHash,
      tokenPrefix: scanManualCode.slice(0, 8),
      status: LifecycleStatus.ACTIVE,
    },
    create: {
      tenantId: tenant.id,
      productUnitId: scanUnitId,
      tokenHash: scanCredentialHash,
      tokenPrefix: scanManualCode.slice(0, 8),
      status: LifecycleStatus.ACTIVE,
    },
  });

  await prisma.qrCode.upsert({
    where: { productUnitId: scanUnitId },
    update: {
      token: scanQrPayload,
      url: `https://${verifyDomain.hostname}${verifyDomain.verificationPath}/${scanQrPayload}`,
      status: LifecycleStatus.ACTIVE,
    },
    create: {
      tenantId: tenant.id,
      productUnitId: scanUnitId,
      token: scanQrPayload,
      url: `https://${verifyDomain.hostname}${verifyDomain.verificationPath}/${scanQrPayload}`,
      status: LifecycleStatus.ACTIVE,
      domainVersion: verifyDomain.version,
    },
  });

  await seedVerificationAnalytics(tenant.id, verifyDomain.id);
  await seedTenantLicense(tenant);

  console.log('Seed completed:', {
    tenant: tenant.name,
    verificationDomain: verifyDomain.hostname,
    batch: batch.batchCode,
    sampleUnits: await prisma.productUnit.count({ where: { batchId: batch.id } }),
    scanQrPayload,
    scanQrHint: 'Encode this exact value in a QR barcode and scan it on /verify',
  });
}

async function seedTenantLicense(tenant: {
  id: string;
  name: string;
  deploymentType: DeploymentType;
}) {
  const privateKey = process.env.LICENSE_SIGNING_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const publicKey = process.env.LICENSE_SIGNING_PUBLIC_KEY?.replace(/\\n/g, '\n');
  const backupKey = process.env.LICENSE_BACKUP_KEY;
  if (!privateKey || !publicKey || !backupKey) {
    console.warn('License keys not configured — skipping license seed (run via pnpm db:seed with dev env)');
    return;
  }

  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  const deploymentModel = mapDeploymentTypeToLicenseModel(tenant.deploymentType);
  const instanceId = process.env.INSTALLATION_ID ?? 'truemark-dev-instance';
  const payload = {
    version: 1 as const,
    licenseId: randomUUID(),
    organizationName: tenant.name,
    tenantId: tenant.id,
    truemarkInstanceId: instanceId,
    deploymentModel,
    commercialModel: LicenseCommercialModel.FULL_PRODUCT,
    issuedAt: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validUntil: validUntil.toISOString(),
    productOwnerEmail: process.env.PRODUCT_OWNER_EMAIL ?? 'licensing@truemark.local',
    productOwnerPhone: process.env.PRODUCT_OWNER_PHONE,
  };

  const signed = signLicensePayload(payload, privateKey);
  const fileContent = serializeLicenseFile(signed);
  const root = process.env.LICENSE_DIR ?? path.resolve(__dirname, '../../..');
  const filePath =
    deploymentModel === LicenseDeploymentModel.DEDICATED
      ? path.join(root, 'license.truemark')
      : path.join(root, 'licenses', `${tenant.id}.truemark`);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, fileContent, 'utf8');

  await prisma.tenantLicense.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      licenseId: payload.licenseId,
      organizationName: payload.organizationName,
      deploymentModel: payload.deploymentModel,
      commercialModel: payload.commercialModel,
      instanceId: payload.truemarkInstanceId,
      validFrom: new Date(payload.validFrom),
      validUntil,
      issuedAt: new Date(payload.issuedAt),
      productOwnerEmail: payload.productOwnerEmail,
      productOwnerPhone: payload.productOwnerPhone,
      licenseFile: fileContent,
      encryptedBackup: encryptLicenseBackup(fileContent, backupKey),
    },
    update: {
      licenseId: payload.licenseId,
      validUntil,
      licenseFile: fileContent,
      encryptedBackup: encryptLicenseBackup(fileContent, backupKey),
    },
  });

  console.log('Seeded tenant license:', { tenantId: tenant.id, filePath, validUntil: validUntil.toISOString() });
}

const SEED_RESULTS: VerificationResult[] = [
  VerificationResult.VERIFIED,
  VerificationResult.VERIFIED,
  VerificationResult.VERIFIED,
  VerificationResult.VERIFIED,
  VerificationResult.REVERIFIED,
  VerificationResult.REVERIFIED,
  VerificationResult.SUSPICIOUS,
  VerificationResult.POSSIBLE_CLONE,
  VerificationResult.INVALID_QR,
  VerificationResult.UNKNOWN_QR,
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

async function seedVerificationAnalytics(tenantId: string, verificationDomainId: string) {
  const existing = await prisma.verificationEvent.count({
    where: { tenantId, correlationId: { startsWith: 'seed-' } },
  });
  if (existing >= 150) {
    console.log('Verification seed data already present:', existing);
    return;
  }

  const units = await prisma.productUnit.findMany({
    where: { tenantId },
    include: { qrCode: true },
    take: 20,
  });
  if (units.length === 0) return;

  const now = new Date();
  const events: Array<{
    tenantId: string;
    productUnitId: string;
    qrCodeId: string | null;
    verificationDomainId: string;
    method: VerificationMethod;
    result: VerificationResult;
    riskLevel: string;
    correlationId: string;
    createdAt: Date;
    ipAddress: string;
    userAgent: string;
  }> = [];

  for (let i = 0; i < 220; i++) {
    const unit = units[i % units.length];
    const daysAgo = Math.floor(seededRandom(i + 1) * 90);
    const hour = Math.floor(seededRandom(i + 11) * 24);
    const minute = Math.floor(seededRandom(i + 21) * 60);
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(hour, minute, 0, 0);

    const result = SEED_RESULTS[Math.floor(seededRandom(i + 31) * SEED_RESULTS.length)];
    const method =
      seededRandom(i + 41) > 0.25 ? VerificationMethod.QR_SCAN : VerificationMethod.MANUAL_CODE;

    events.push({
      tenantId,
      productUnitId: unit.id,
      qrCodeId: unit.qrCode?.id ?? null,
      verificationDomainId,
      method,
      result,
      riskLevel:
        result === VerificationResult.SUSPICIOUS || result === VerificationResult.POSSIBLE_CLONE
          ? 'HIGH'
          : result === VerificationResult.REVERIFIED
            ? 'LOW'
            : 'NONE',
      correlationId: `seed-${tenantId.slice(0, 8)}-${String(i).padStart(4, '0')}`,
      createdAt,
      ipAddress: `203.0.${Math.floor(seededRandom(i + 51) * 255)}.${Math.floor(seededRandom(i + 61) * 255)}`,
      userAgent: 'TrueMark-Seed/1.0',
    });
  }

  await prisma.verificationEvent.createMany({ data: events, skipDuplicates: true });

  const dayCounts = new Map<string, { total: number; byResult: Record<string, number> }>();
  for (const event of events) {
    const key = event.createdAt.toISOString().slice(0, 10);
    const bucket = dayCounts.get(key) ?? { total: 0, byResult: {} };
    bucket.total += 1;
    bucket.byResult[event.result] = (bucket.byResult[event.result] ?? 0) + 1;
    dayCounts.set(key, bucket);
  }

  for (const [dateKey, metrics] of dayCounts.entries()) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    await prisma.analyticsDaily.upsert({
      where: { tenantId_date: { tenantId, date } },
      create: { tenantId, date, metrics },
      update: { metrics },
    });
  }

  console.log('Seeded verification analytics:', {
    events: events.length,
    dailyRollups: dayCounts.size,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
