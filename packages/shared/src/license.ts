import { z } from 'zod';

export const LICENSE_VERSION = 1;
export const LICENSE_GRACE_DAYS = 15;
export const LICENSE_WARNING_DAYS = [30, 15, 7] as const;

export enum LicenseDeploymentModel {
  SAAS_MULTI_TENANT = 'SAAS_MULTI_TENANT',
  DEDICATED = 'DEDICATED',
}

export enum LicenseCommercialModel {
  FULL_PRODUCT = 'FULL_PRODUCT',
  MANAGED_SERVICE = 'MANAGED_SERVICE',
}

export enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  WARNING_30 = 'WARNING_30',
  WARNING_15 = 'WARNING_15',
  WARNING_7 = 'WARNING_7',
  EXPIRED_GRACE = 'EXPIRED_GRACE',
  BLOCKED = 'BLOCKED',
  MISSING = 'MISSING',
  INVALID = 'INVALID',
}

export const licensePayloadSchema = z.object({
  version: z.literal(LICENSE_VERSION),
  licenseId: z.string().uuid(),
  organizationName: z.string().min(1),
  tenantId: z.string().uuid(),
  truemarkInstanceId: z.string().min(8),
  deploymentModel: z.nativeEnum(LicenseDeploymentModel),
  commercialModel: z.nativeEnum(LicenseCommercialModel),
  issuedAt: z.string().datetime(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  productOwnerEmail: z.string().email(),
  productOwnerPhone: z.string().optional(),
});

export type LicensePayload = z.infer<typeof licensePayloadSchema>;

export type SignedLicenseFile = {
  payload: string;
  signature: string;
};

export function mapDeploymentTypeToLicenseModel(deploymentType: string): LicenseDeploymentModel {
  return deploymentType === 'SAAS'
    ? LicenseDeploymentModel.SAAS_MULTI_TENANT
    : LicenseDeploymentModel.DEDICATED;
}

export function computeLicenseStatus(
  validUntil: Date,
  now = new Date(),
  graceDays = LICENSE_GRACE_DAYS,
): LicenseStatus {
  const end = validUntil.getTime();
  const current = now.getTime();
  const msPerDay = 86_400_000;

  if (current <= end) {
    const daysLeft = Math.ceil((end - current) / msPerDay);
    if (daysLeft <= 7) return LicenseStatus.WARNING_7;
    if (daysLeft <= 15) return LicenseStatus.WARNING_15;
    if (daysLeft <= 30) return LicenseStatus.WARNING_30;
    return LicenseStatus.ACTIVE;
  }

  const graceEnd = end + graceDays * msPerDay;
  if (current <= graceEnd) return LicenseStatus.EXPIRED_GRACE;
  return LicenseStatus.BLOCKED;
}

export function daysUntilExpiry(validUntil: Date, now = new Date()): number {
  return Math.ceil((validUntil.getTime() - now.getTime()) / 86_400_000);
}

export function graceDaysRemaining(validUntil: Date, now = new Date(), graceDays = LICENSE_GRACE_DAYS): number {
  const graceEnd = validUntil.getTime() + graceDays * 86_400_000;
  return Math.max(0, Math.ceil((graceEnd - now.getTime()) / 86_400_000));
}
