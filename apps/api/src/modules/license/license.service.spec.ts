import { computeLicenseStatus, LicenseStatus } from '@truemark/shared';

describe('LicenseService status integration', () => {
  it('maps expiry timeline to warning and blocked states', () => {
    const now = new Date('2026-08-01T00:00:00.000Z');
    expect(computeLicenseStatus(new Date('2026-08-25T00:00:00.000Z'), now)).toBe(
      LicenseStatus.WARNING_30,
    );
    expect(computeLicenseStatus(new Date('2026-07-20T00:00:00.000Z'), now)).toBe(
      LicenseStatus.EXPIRED_GRACE,
    );
    expect(computeLicenseStatus(new Date('2026-05-01T00:00:00.000Z'), now)).toBe(
      LicenseStatus.BLOCKED,
    );
  });
});
