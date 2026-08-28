import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'crypto';
import { LicensePayload, SignedLicenseFile, licensePayloadSchema } from './license';

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function generateLicenseKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

export function signLicensePayload(payload: LicensePayload, privateKeyPem: string): SignedLicenseFile {
  const parsed = licensePayloadSchema.parse(payload);
  const payloadJson = JSON.stringify(parsed);
  const payloadEncoded = toBase64Url(Buffer.from(payloadJson, 'utf8'));
  const signature = sign(null, Buffer.from(payloadEncoded, 'utf8'), createPrivateKey(privateKeyPem));
  return { payload: payloadEncoded, signature: toBase64Url(signature) };
}

export function verifySignedLicense(
  file: SignedLicenseFile,
  publicKeyPem: string,
): { valid: boolean; payload?: LicensePayload; error?: string } {
  try {
    const ok = verify(
      null,
      Buffer.from(file.payload, 'utf8'),
      createPublicKey(publicKeyPem),
      fromBase64Url(file.signature),
    );
    if (!ok) return { valid: false, error: 'Invalid license signature' };
    const json = Buffer.from(file.payload, 'base64url').toString('utf8');
    const payload = licensePayloadSchema.parse(JSON.parse(json));
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Invalid license file' };
  }
}

export function serializeLicenseFile(file: SignedLicenseFile): string {
  return JSON.stringify(file, null, 2);
}

export function parseLicenseFile(content: string): SignedLicenseFile {
  const parsed = JSON.parse(content) as SignedLicenseFile;
  if (!parsed?.payload || !parsed?.signature) {
    throw new Error('Malformed license file');
  }
  return parsed;
}

export function encryptLicenseBackup(content: string, backupKeyHex: string): string {
  const key = Buffer.from(backupKeyHex, 'hex');
  if (key.length !== 32) throw new Error('LICENSE_BACKUP_KEY must be 32 bytes (64 hex chars)');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  });
}

export function decryptLicenseBackup(encryptedJson: string, backupKeyHex: string): string {
  const key = Buffer.from(backupKeyHex, 'hex');
  const { iv, tag, data } = JSON.parse(encryptedJson) as {
    iv: string;
    tag: string;
    data: string;
  };
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}
