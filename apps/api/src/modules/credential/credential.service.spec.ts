import { CredentialService } from './credential.service';

describe('CredentialService', () => {
  const service = new CredentialService();

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => service.generateToken().plaintext));
    expect(tokens.size).toBe(100);
  });

  it('generates tokens with TM prefix', () => {
    const { plaintext } = service.generateToken();
    expect(plaintext.startsWith('TM-')).toBe(true);
  });

  it('normalizes manual codes', () => {
    expect(service.normalizeCode(' tm-xxxx-yyyy-zzzz ')).toBe('TM-XXXX-YYYY-ZZZZ');
  });
});
