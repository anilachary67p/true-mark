import {
  normalizeCompanyDomainUrl,
  normalizeVerificationHostname,
  normalizeVerificationPath,
  assertDomainStatusTransition,
  assertVerificationHostnameAllowed,
  BLOCKED_VERIFICATION_HOSTNAMES,
} from './domain-validation.util';

describe('domain-validation.util', () => {
  describe('normalizeCompanyDomainUrl', () => {
    it('accepts valid HTTPS company domain', () => {
      const result = normalizeCompanyDomainUrl('https://www.abcpharma.com');
      expect(result.url).toBe('https://www.abcpharma.com');
      expect(result.hostname).toBe('www.abcpharma.com');
    });

    it('rejects HTTP protocol', () => {
      expect(() => normalizeCompanyDomainUrl('http://www.abcpharma.com')).toThrow(
        'Company domain must use HTTPS',
      );
    });

    it('rejects malformed URL', () => {
      expect(() => normalizeCompanyDomainUrl('not-a-url')).toThrow('Invalid company domain URL');
    });

    it('rejects URL with path (open redirect risk)', () => {
      expect(() => normalizeCompanyDomainUrl('https://abc.com/redirect')).toThrow(
        'must not include a path',
      );
    });

    it('rejects URL with query string', () => {
      expect(() => normalizeCompanyDomainUrl('https://abc.com?next=evil')).toThrow(
        'must not include query',
      );
    });

    it('rejects IP address hostname', () => {
      expect(() => normalizeCompanyDomainUrl('https://127.0.0.1')).toThrow(
        'must not be an IP address',
      );
    });
  });

  describe('normalizeVerificationHostname', () => {
    it('normalizes hostname to lowercase', () => {
      expect(normalizeVerificationHostname('VERIFY.ABCPHARMA.COM')).toBe('verify.abcpharma.com');
    });

    it('extracts hostname from HTTPS URL', () => {
      expect(normalizeVerificationHostname('https://verify.abcpharma.com')).toBe(
        'verify.abcpharma.com',
      );
    });

    it('rejects invalid hostname', () => {
      expect(() => normalizeVerificationHostname('-bad')).toThrow('Invalid verification domain');
    });

    it('rejects localhost', () => {
      expect(() => normalizeVerificationHostname('localhost')).toThrow('not permitted');
    });

    it('rejects example.com per domain policy', () => {
      expect(BLOCKED_VERIFICATION_HOSTNAMES.has('example.com')).toBe(true);
      expect(() => normalizeVerificationHostname('example.com')).toThrow('domain policy');
    });
  });

  describe('normalizeVerificationPath', () => {
    it('defaults to /v', () => {
      expect(normalizeVerificationPath()).toBe('/v');
    });

    it('normalizes trailing slash', () => {
      expect(normalizeVerificationPath('/v/')).toBe('/v');
    });

    it('rejects path traversal', () => {
      expect(() => normalizeVerificationPath('/v/../admin')).toThrow('invalid');
    });
  });

  describe('assertDomainStatusTransition', () => {
    it('allows PENDING to ACTIVE', () => {
      expect(() => assertDomainStatusTransition('PENDING', 'ACTIVE', 'domain')).not.toThrow();
    });

    it('allows ACTIVE to SUSPENDED', () => {
      expect(() => assertDomainStatusTransition('ACTIVE', 'SUSPENDED', 'domain')).not.toThrow();
    });

    it('rejects DISABLED to ACTIVE', () => {
      expect(() => assertDomainStatusTransition('DISABLED', 'ACTIVE', 'domain')).toThrow(
        'Cannot transition',
      );
    });
  });
});
