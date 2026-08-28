import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { CREDENTIAL_PREFIX, SERIAL_PREFIX, TOKEN_ENTROPY_BYTES } from '@truemark/shared';

@Injectable()
export class CredentialService {
  generateToken(): { plaintext: string; token: string; prefix: string } {
    const bytes = randomBytes(TOKEN_ENTROPY_BYTES);
    const hex = bytes.toString('hex').toUpperCase();
    const parts = hex.match(/.{1,4}/g) ?? [];
    const token = parts.slice(0, 3).join('-');
    const plaintext = `${CREDENTIAL_PREFIX}-${token}`;
    const prefix = plaintext.slice(0, 8);
    return { plaintext, token: bytes.toString('base64url'), prefix };
  }

  async hashToken(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, { type: argon2.argon2id });
  }

  normalizeCode(input: string): string {
    return input.trim().toUpperCase().replace(/\s+/g, '');
  }

  generateSerialNumber(tenantPrefix: string, index: number, year = new Date().getFullYear()): string {
    return `${SERIAL_PREFIX}-${tenantPrefix}-${year}-${String(index).padStart(6, '0')}`;
  }

  generateQrToken(): string {
    return randomBytes(TOKEN_ENTROPY_BYTES).toString('base64url');
  }
}
