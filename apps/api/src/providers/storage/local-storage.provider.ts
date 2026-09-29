import * as fs from 'fs/promises';
import * as path from 'path';
import { ObjectMetadata, ObjectRef, ObjectStorageProvider } from '../interfaces';
import { assertSafeObjectKey } from './storage-key.util';

export class LocalStorageProvider implements ObjectStorageProvider {
  private basePath = path.resolve(process.cwd(), '.storage');

  private resolveKey(key: string): string {
    assertSafeObjectKey(key);
    const resolved = path.resolve(this.basePath, key);
    if (!resolved.startsWith(this.basePath + path.sep)) {
      throw new Error('Object key escapes storage root');
    }
    return resolved;
  }

  async upload(
    key: string,
    data: Buffer,
    metadata: { contentType: string; tenantId: string },
  ): Promise<ObjectRef> {
    const tenantKey = `tenants/${metadata.tenantId}/${key}`;
    const filePath = this.resolveKey(tenantKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return { key: tenantKey, bucket: 'local' };
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.resolveKey(key)).catch(() => undefined);
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    const stat = await fs.stat(this.resolveKey(key));
    return {
      key,
      size: stat.size,
      contentType: 'application/octet-stream',
      lastModified: stat.mtime,
    };
  }

  async createSignedUrl(key: string, _ttlSeconds: number): Promise<string> {
    return `/storage/${key}`;
  }
}
