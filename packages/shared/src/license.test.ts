import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LicenseCommercialModel,
  LicenseDeploymentModel,
  LicenseStatus,
  computeLicenseStatus,
  graceDaysRemaining,
} from './license';
import { generateLicenseKeyPair, signLicensePayload, verifySignedLicense } from './license-crypto';

describe('license status', () => {
  it('computes warning and grace states', () => {
    const now = new Date('2026-08-01T00:00:00.000Z');
    assert.equal(
      computeLicenseStatus(new Date('2026-08-20T00:00:00.000Z'), now),
      LicenseStatus.WARNING_15,
    );
    assert.equal(
      computeLicenseStatus(new Date('2026-07-20T00:00:00.000Z'), now),
      LicenseStatus.EXPIRED_GRACE,
    );
    assert.equal(
      computeLicenseStatus(new Date('2026-06-01T00:00:00.000Z'), now),
      LicenseStatus.BLOCKED,
    );
    assert.equal(graceDaysRemaining(new Date('2026-07-20T00:00:00.000Z'), now), 6);
  });
});

describe('license crypto', () => {
  it('signs and verifies license payload', () => {
    const keys = generateLicenseKeyPair();
    const payload = {
      version: 1 as const,
      licenseId: '11111111-1111-1111-1111-111111111111',
      organizationName: 'ABC Pharma',
      tenantId: '00000000-0000-0000-0000-000000000001',
      truemarkInstanceId: 'truemark-dev-instance',
      deploymentModel: LicenseDeploymentModel.SAAS_MULTI_TENANT,
      commercialModel: LicenseCommercialModel.FULL_PRODUCT,
      issuedAt: '2026-01-01T00:00:00.000Z',
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2027-01-01T00:00:00.000Z',
      productOwnerEmail: 'licensing@truemark.local',
    };
    const signed = signLicensePayload(payload, keys.privateKeyPem);
    const result = verifySignedLicense(signed, keys.publicKeyPem);
    assert.equal(result.valid, true);
    assert.equal(result.payload?.organizationName, 'ABC Pharma');
  });
});
