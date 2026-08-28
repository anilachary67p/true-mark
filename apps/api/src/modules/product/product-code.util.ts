import { randomBytes } from 'crypto';

/** System-generated unique product code for individual variants (e.g. TM-A1B2C3D4). */
export function generateProductCode(): string {
  return `TM-${randomBytes(4).toString('hex').toUpperCase()}`;
}
