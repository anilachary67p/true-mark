#!/usr/bin/env tsx
/**
 * Product-owner CLI to generate or renew a signed TrueMark license.
 * Usage:
 *   LICENSE_SIGNING_PRIVATE_KEY=... LICENSE_SIGNING_PUBLIC_KEY=... LICENSE_BACKUP_KEY=... \
 *   pnpm tsx scripts/generate-license.ts --tenant-id <uuid> --org "ABC Pharma" --deployment SAAS --commercial FULL_PRODUCT --valid-until 2027-12-31
 */
import { writeFile, mkdir } from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  LicenseCommercialModel,
  LicenseDeploymentModel,
  mapDeploymentTypeToLicenseModel,
  serializeLicenseFile,
  signLicensePayload,
} from '@truemark/shared';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const tenantId = arg('tenant-id');
  const organizationName = arg('org');
  const deploymentType = arg('deployment') ?? 'SAAS';
  const commercial = (arg('commercial') ?? 'FULL_PRODUCT') as LicenseCommercialModel;
  const validUntil = arg('valid-until');
  const instanceId = arg('instance') ?? process.env.INSTALLATION_ID ?? 'truemark-dev-instance';
  const out = arg('out');

  if (!tenantId || !organizationName || !validUntil) {
    console.error(
      'Required: --tenant-id --org --valid-until (optional: --deployment --commercial --instance --out)',
    );
    process.exit(1);
  }

  const privateKey = process.env.LICENSE_SIGNING_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKey) {
    console.error('LICENSE_SIGNING_PRIVATE_KEY is required');
    process.exit(1);
  }

  const deploymentModel = mapDeploymentTypeToLicenseModel(deploymentType);
  const payload = {
    version: 1 as const,
    licenseId: randomUUID(),
    organizationName,
    tenantId,
    truemarkInstanceId: instanceId,
    deploymentModel,
    commercialModel: commercial,
    issuedAt: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validUntil: new Date(validUntil).toISOString(),
    productOwnerEmail: process.env.PRODUCT_OWNER_EMAIL ?? 'licensing@truemark.local',
    productOwnerPhone: process.env.PRODUCT_OWNER_PHONE,
  };

  const signed = signLicensePayload(payload, privateKey);
  const content = serializeLicenseFile(signed);
  const filePath =
    out ??
    (deploymentModel === LicenseDeploymentModel.DEDICATED
      ? path.join(process.cwd(), 'license.truemark')
      : path.join(process.cwd(), 'licenses', `${tenantId}.truemark`));

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  console.log(JSON.stringify({ filePath, licenseId: payload.licenseId, validUntil: payload.validUntil }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
