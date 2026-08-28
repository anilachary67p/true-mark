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

type DemoCatalogVariant = {
  id: string;
  name: string;
  productCode: string;
  tags: string[];
};

type DemoCatalogProductType = {
  id: string;
  name: string;
  variants: DemoCatalogVariant[];
};

type DemoCatalogCategory = {
  id: string;
  name: string;
  productTypes: DemoCatalogProductType[];
};

type DemoTenantConfig = {
  id: string;
  name: string;
  legalName: string;
  status: TenantStatus;
  deploymentType: DeploymentType;
  commercialModel?: LicenseCommercialModel;
  profile: {
    contactEmail: string;
    country: string;
    companyDisplayName: string;
  };
  adminEmail: string;
  adminName: string;
  companyDomainId: string;
  companyDomainUrl: string;
  catalog: DemoCatalogCategory[];
  verificationEventCount?: number;
};

async function seedDemoTenant(passwordHash: string, config: DemoTenantConfig) {
  const tenant = await prisma.tenant.upsert({
    where: { id: config.id },
    update: {
      name: config.name,
      legalName: config.legalName,
      status: config.status,
      deploymentType: config.deploymentType,
    },
    create: {
      id: config.id,
      name: config.name,
      legalName: config.legalName,
      status: config.status,
      deploymentType: config.deploymentType,
      profile: { create: config.profile },
      fraudConfig: { create: {} },
      aiConfig: { create: { mode: AiMode.AI_OPTIONAL } },
    },
  });

  await prisma.tenantProfile.upsert({
    where: { tenantId: tenant.id },
    update: config.profile,
    create: { tenantId: tenant.id, ...config.profile },
  });

  await prisma.user.upsert({
    where: { email: config.adminEmail },
    update: { name: config.adminName },
    create: {
      email: config.adminEmail,
      name: config.adminName,
      passwordHash,
      tenantRoles: { create: { role: UserRole.TENANT_ADMIN, tenantId: tenant.id } },
    },
  });

  await prisma.companyDomain.upsert({
    where: { id: config.companyDomainId },
    update: { url: config.companyDomainUrl },
    create: {
      id: config.companyDomainId,
      tenantId: tenant.id,
      url: config.companyDomainUrl,
      status: DomainStatus.ACTIVE,
    },
  });

  let firstVariantId: string | null = null;

  for (const categoryDef of config.catalog) {
    const category = await prisma.category.upsert({
      where: { id: categoryDef.id },
      update: { name: categoryDef.name },
      create: {
        id: categoryDef.id,
        tenantId: tenant.id,
        name: categoryDef.name,
        status: LifecycleStatus.ACTIVE,
      },
    });

    for (const productTypeDef of categoryDef.productTypes) {
      const productType = await prisma.productType.upsert({
        where: { id: productTypeDef.id },
        update: { name: productTypeDef.name, categoryId: category.id },
        create: {
          id: productTypeDef.id,
          tenantId: tenant.id,
          categoryId: category.id,
          name: productTypeDef.name,
          status: LifecycleStatus.ACTIVE,
        },
      });

      for (const variantDef of productTypeDef.variants) {
        const variant = await prisma.productVariant.upsert({
          where: { id: variantDef.id },
          update: { name: variantDef.name, productCode: variantDef.productCode },
          create: {
            id: variantDef.id,
            tenantId: tenant.id,
            productTypeId: productType.id,
            name: variantDef.name,
            productCode: variantDef.productCode,
            status: LifecycleStatus.ACTIVE,
          },
        });

        if (!firstVariantId) firstVariantId = variant.id;

        for (const tagName of variantDef.tags) {
          const tag = await prisma.tag.upsert({
            where: { tenantId_name: { tenantId: tenant.id, name: tagName } },
            create: { tenantId: tenant.id, name: tagName },
            update: {},
          });
          await prisma.productVariantTag.upsert({
            where: { productVariantId_tagId: { productVariantId: variant.id, tagId: tag.id } },
            create: { productVariantId: variant.id, tagId: tag.id },
            update: {},
          });
        }
      }
    }
  }

  if (firstVariantId) {
    const batchId = config.companyDomainId.replace(/0$/, '1');
    const batch = await prisma.batch.upsert({
      where: { id: batchId },
      update: {},
      create: {
        id: batchId,
        tenantId: tenant.id,
        productVariantId: firstVariantId,
        batchCode: `BATCH-${config.name.split(' ')[0].toUpperCase()}-2026`,
        status: LifecycleStatus.ACTIVE,
        manufacturingDate: new Date('2026-02-01'),
        expiryDate: new Date('2028-02-01'),
      },
    });

    const unitCount = await prisma.productUnit.count({ where: { batchId: batch.id } });
    if (unitCount === 0) {
      for (let i = 1; i <= 2; i++) {
        const bytes = randomBytes(16);
        const hex = bytes.toString('hex').toUpperCase();
        const parts = hex.match(/.{1,4}/g) ?? [];
        const tokenPart = parts.slice(0, 3).join('-');
        const plaintext = `TM-${tokenPart}`;
        const tokenHash = await hashToken(plaintext);
        const prefix = plaintext.slice(0, 8);
        const qrToken = randomBytes(16).toString('base64url');

        const unit = await prisma.productUnit.create({
          data: { tenantId: tenant.id, batchId: batch.id, status: LifecycleStatus.REGISTERED },
        });

        await prisma.serial.create({
          data: {
            tenantId: tenant.id,
            productUnitId: unit.id,
            serialNumber: `SN-${config.id.slice(-4)}-${String(i).padStart(4, '0')}`,
          },
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
            url: `https://verify.localhost/v/${qrToken}`,
            status: LifecycleStatus.ACTIVE,
          },
        });
      }
    }
  }

  await seedVerificationAnalytics(
    tenant.id,
    null,
    config.verificationEventCount ?? 80,
    config.id.slice(-4),
  );
  await seedTenantLicense(tenant, config.commercialModel);

  return tenant;
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
    update: {
      name: 'PureGlow Personal Care',
      legalName: 'PureGlow Personal Care Pvt. Ltd.',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'PureGlow Personal Care',
      legalName: 'PureGlow Personal Care Pvt. Ltd.',
      status: TenantStatus.ACTIVE,
      deploymentType: DeploymentType.SAAS,
      profile: {
        create: {
          contactEmail: 'contact@pureglow.com',
          country: 'IN',
          companyDisplayName: 'PureGlow',
        },
      },
      fraudConfig: { create: {} },
      aiConfig: { create: { mode: AiMode.AI_OPTIONAL } },
    },
  });

  await prisma.tenantProfile.upsert({
    where: { tenantId: tenant.id },
    update: {
      companyDisplayName: 'PureGlow',
      contactEmail: 'contact@pureglow.com',
    },
    create: {
      tenantId: tenant.id,
      contactEmail: 'contact@pureglow.com',
      country: 'IN',
      companyDisplayName: 'PureGlow',
    },
  });

  await prisma.user.deleteMany({ where: { email: 'tenant-admin@abcpharma.com' } });

  await prisma.user.upsert({
    where: { email: 'tenant-admin@pureglow.com' },
    update: { name: 'PureGlow Tenant Admin' },
    create: {
      email: 'tenant-admin@pureglow.com',
      name: 'PureGlow Tenant Admin',
      passwordHash,
      tenantRoles: { create: { role: UserRole.TENANT_ADMIN, tenantId: tenant.id } },
    },
  });

  await prisma.companyDomain.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: { url: 'https://www.pureglow.com' },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: tenant.id,
      url: 'https://www.pureglow.com',
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
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: { name: 'Daily Repair Shampoo' },
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      tenantId: tenant.id,
      categoryId: categoryPersonalCare.id,
      name: 'Daily Repair Shampoo',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const variant100 = await prisma.productVariant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: { name: 'Daily Repair Shampoo 100ml', productCode: 'TM-PG100ML' },
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      tenantId: tenant.id,
      productTypeId: productTypeShampooA.id,
      name: 'Daily Repair Shampoo 100ml',
      productCode: 'TM-PG100ML',
      status: LifecycleStatus.ACTIVE,
    },
  });

  const variant500 = await prisma.productVariant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000103' },
    update: { name: 'Daily Repair Shampoo 500ml', productCode: 'TM-PG500ML' },
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      tenantId: tenant.id,
      productTypeId: productTypeShampooA.id,
      name: 'Daily Repair Shampoo 500ml',
      productCode: 'TM-PG500ML',
      status: LifecycleStatus.ACTIVE,
    },
  });

  for (const [variantId, tagNames] of [
    [variant100.id, ['PG-SH', 'PG-SH-100']] as const,
    [variant500.id, ['PG-SH', 'PG-SH-500']] as const,
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
      const serialNumber = `SN-PG-2026-${String(i).padStart(6, '0')}`;

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

  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['tenant-admin@xyzmanufacturing.com'],
      },
    },
  });

  const extraTenants = await Promise.all([
    seedDemoTenant(passwordHash, {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Lumina Home Essentials',
      legalName: 'Lumina Home Essentials Pvt. Ltd.',
      status: TenantStatus.ACTIVE,
      deploymentType: DeploymentType.DEDICATED_CLOUD,
      commercialModel: LicenseCommercialModel.FULL_PRODUCT,
      profile: {
        contactEmail: 'contact@luminaessentials.com',
        country: 'IN',
        companyDisplayName: 'Lumina Home Essentials',
      },
      adminEmail: 'tenant-admin@luminaessentials.com',
      adminName: 'Lumina Tenant Admin',
      companyDomainId: '00000000-0000-0000-0000-000000000020',
      companyDomainUrl: 'https://www.luminaessentials.com',
      verificationEventCount: 120,
      catalog: [
        {
          id: '00000000-0000-0000-0000-000000000200',
          name: 'Personal Care',
          productTypes: [
            {
              id: '00000000-0000-0000-0000-000000000201',
              name: 'Citrus Fresh Shampoo',
              variants: [
                {
                  id: '00000000-0000-0000-0000-000000000202',
                  name: 'Citrus Fresh Shampoo 100ml',
                  productCode: 'TM-LM100ML',
                  tags: ['LM-SH', 'LM-SH-100'],
                },
                {
                  id: '00000000-0000-0000-0000-000000000203',
                  name: 'Citrus Fresh Shampoo 500ml',
                  productCode: 'TM-LM500ML',
                  tags: ['LM-SH', 'LM-SH-500'],
                },
              ],
            },
          ],
        },
        {
          id: '00000000-0000-0000-0000-000000000204',
          name: 'Home Care',
          productTypes: [
            {
              id: '00000000-0000-0000-0000-000000000205',
              name: 'Gentle Hand Soap',
              variants: [
                {
                  id: '00000000-0000-0000-0000-000000000206',
                  name: 'Gentle Hand Soap 250ml',
                  productCode: 'TM-LMSOAP25',
                  tags: ['SOAP', 'SOAP-250'],
                },
              ],
            },
          ],
        },
      ],
    }),
    seedDemoTenant(passwordHash, {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'GreenLeaf Organics',
      legalName: 'GreenLeaf Organics LLC',
      status: TenantStatus.ACTIVE,
      deploymentType: DeploymentType.SAAS,
      commercialModel: LicenseCommercialModel.MANAGED_SERVICE,
      profile: {
        contactEmail: 'hello@greenleaf.com',
        country: 'US',
        companyDisplayName: 'GreenLeaf Organics',
      },
      adminEmail: 'tenant-admin@greenleaf.com',
      adminName: 'GreenLeaf Tenant Admin',
      companyDomainId: '00000000-0000-0000-0000-000000000030',
      companyDomainUrl: 'https://www.greenleaf.com',
      verificationEventCount: 95,
      catalog: [
        {
          id: '00000000-0000-0000-0000-000000000300',
          name: 'Food & Beverage',
          productTypes: [
            {
              id: '00000000-0000-0000-0000-000000000301',
              name: 'Organic Honey',
              variants: [
                {
                  id: '00000000-0000-0000-0000-000000000302',
                  name: 'Honey 250g',
                  productCode: 'TM-GLHNY250',
                  tags: ['HONEY', 'HONEY-250'],
                },
                {
                  id: '00000000-0000-0000-0000-000000000303',
                  name: 'Honey 500g',
                  productCode: 'TM-GLHNY500',
                  tags: ['HONEY', 'HONEY-500'],
                },
              ],
            },
          ],
        },
      ],
    }),
    seedDemoTenant(passwordHash, {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Nova Electronics',
      legalName: 'Nova Electronics Inc.',
      status: TenantStatus.ACTIVE,
      deploymentType: DeploymentType.CUSTOMER_CLOUD,
      commercialModel: LicenseCommercialModel.FULL_PRODUCT,
      profile: {
        contactEmail: 'support@novaelectronics.com',
        country: 'US',
        companyDisplayName: 'Nova Electronics',
      },
      adminEmail: 'tenant-admin@novaelectronics.com',
      adminName: 'Nova Tenant Admin',
      companyDomainId: '00000000-0000-0000-0000-000000000040',
      companyDomainUrl: 'https://www.novaelectronics.com',
      verificationEventCount: 150,
      catalog: [
        {
          id: '00000000-0000-0000-0000-000000000400',
          name: 'Digital',
          productTypes: [
            {
              id: '00000000-0000-0000-0000-000000000401',
              name: 'TV',
              variants: [
                {
                  id: '00000000-0000-0000-0000-000000000402',
                  name: 'TV Model 1',
                  productCode: 'TM-NVATV01',
                  tags: ['TV', 'TV-M1'],
                },
                {
                  id: '00000000-0000-0000-0000-000000000403',
                  name: 'TV Model 2',
                  productCode: 'TM-NVATV02',
                  tags: ['TV', 'TV-M2'],
                },
              ],
            },
            {
              id: '00000000-0000-0000-0000-000000000404',
              name: 'Mobile',
              variants: [
                {
                  id: '00000000-0000-0000-0000-000000000405',
                  name: 'Mobile Model 1',
                  productCode: 'TM-NVAMOB1',
                  tags: ['MOB', 'MOB-M1'],
                },
              ],
            },
          ],
        },
      ],
    }),
    seedDemoTenant(passwordHash, {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Metro Health Supplies',
      legalName: 'Metro Health Supplies GmbH',
      status: TenantStatus.PENDING,
      deploymentType: DeploymentType.ON_PREM,
      commercialModel: LicenseCommercialModel.MANAGED_SERVICE,
      profile: {
        contactEmail: 'info@metrohealth.com',
        country: 'DE',
        companyDisplayName: 'Metro Health',
      },
      adminEmail: 'tenant-admin@metrohealth.com',
      adminName: 'Metro Tenant Admin',
      companyDomainId: '00000000-0000-0000-0000-000000000050',
      companyDomainUrl: 'https://www.metrohealth.com',
      verificationEventCount: 45,
      catalog: [
        {
          id: '00000000-0000-0000-0000-000000000500',
          name: 'Medical Supplies',
          productTypes: [
            {
              id: '00000000-0000-0000-0000-000000000501',
              name: 'Surgical Mask',
              variants: [
                {
                  id: '00000000-0000-0000-0000-000000000502',
                  name: 'Mask Box 50',
                  productCode: 'TM-MHMMASK50',
                  tags: ['MASK', 'MASK-50'],
                },
              ],
            },
          ],
        },
      ],
    }),
  ]);

  console.log('Seed completed:', {
    tenants: [tenant.name, ...extraTenants.map((t) => t.name)],
    verificationDomain: verifyDomain.hostname,
    batch: batch.batchCode,
    sampleUnits: await prisma.productUnit.count({ where: { batchId: batch.id } }),
    scanQrPayload,
    scanQrHint: 'Encode this exact value in a QR barcode and scan it on /verify',
    demoCredentials: [
      { role: 'Super Admin', email: 'admin@truemark.local', password: 'Admin123!@#' },
      { role: 'PureGlow Tenant Admin', email: 'tenant-admin@pureglow.com', password: 'Admin123!@#' },
      {
        role: 'Lumina Tenant Admin',
        email: 'tenant-admin@luminaessentials.com',
        password: 'Admin123!@#',
      },
      {
        role: 'GreenLeaf Tenant Admin',
        email: 'tenant-admin@greenleaf.com',
        password: 'Admin123!@#',
      },
      {
        role: 'Nova Tenant Admin',
        email: 'tenant-admin@novaelectronics.com',
        password: 'Admin123!@#',
      },
      {
        role: 'Metro Tenant Admin',
        email: 'tenant-admin@metrohealth.com',
        password: 'Admin123!@#',
      },
    ],
  });
}

async function seedTenantLicense(
  tenant: {
    id: string;
    name: string;
    deploymentType: DeploymentType;
  },
  commercialModel: LicenseCommercialModel = LicenseCommercialModel.FULL_PRODUCT,
) {
  const privateKey = process.env.LICENSE_SIGNING_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const publicKey = process.env.LICENSE_SIGNING_PUBLIC_KEY?.replace(/\\n/g, '\n');
  const backupKey = process.env.LICENSE_BACKUP_KEY;
  if (!privateKey || !publicKey || !backupKey) {
    console.warn(
      'License keys not configured — skipping license seed (run via pnpm db:seed with dev env)',
    );
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
    commercialModel,
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

  console.log('Seeded tenant license:', {
    tenantId: tenant.id,
    filePath,
    validUntil: validUntil.toISOString(),
  });
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

async function seedVerificationAnalytics(
  tenantId: string,
  verificationDomainId: string | null,
  targetCount = 220,
  seedSuffix = tenantId.slice(0, 8),
) {
  const existing = await prisma.verificationEvent.count({
    where: { tenantId, correlationId: { startsWith: `seed-${seedSuffix}-` } },
  });
  if (existing >= targetCount) {
    console.log('Verification seed data already present:', existing, 'for', tenantId);
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

  for (let i = 0; i < targetCount; i++) {
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
      correlationId: `seed-${seedSuffix}-${String(i).padStart(4, '0')}`,
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
