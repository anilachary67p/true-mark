import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '@truemark/config';
import { ObjectMetadata, ObjectRef, ObjectStorageProvider } from '../interfaces';
import { assertSafeObjectKey } from './storage-key.util';

export class MinioStorageProvider implements ObjectStorageProvider {
  private client: Minio.Client;
  private bucket: string;

  constructor(config: ConfigService<EnvConfig>) {
    this.bucket = config.get('MINIO_BUCKET', { infer: true }) ?? 'truemark';
    this.client = new Minio.Client({
      endPoint: config.get('MINIO_ENDPOINT', { infer: true }) ?? 'localhost',
      port: config.get('MINIO_PORT', { infer: true }) ?? 9000,
      useSSL: config.get('MINIO_USE_SSL', { infer: true }) ?? false,
      accessKey: config.get('MINIO_ACCESS_KEY', { infer: true }) ?? 'minioadmin',
      secretKey: config.get('MINIO_SECRET_KEY', { infer: true }) ?? 'minioadmin',
    });
  }

  async upload(
    key: string,
    data: Buffer,
    metadata: { contentType: string; tenantId: string },
  ): Promise<ObjectRef> {
    const tenantKey = `tenants/${metadata.tenantId}/${key}`;
    assertSafeObjectKey(tenantKey);
    await this.client.putObject(this.bucket, tenantKey, data, data.length, {
      'Content-Type': metadata.contentType,
    });
    return { key: tenantKey, bucket: this.bucket };
  }

  async download(key: string): Promise<Buffer> {
    assertSafeObjectKey(key);
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    assertSafeObjectKey(key);
    await this.client.removeObject(this.bucket, key);
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    assertSafeObjectKey(key);
    const stat = await this.client.statObject(this.bucket, key);
    return {
      key,
      size: stat.size,
      contentType: stat.metaData?.['content-type'] ?? 'application/octet-stream',
      lastModified: stat.lastModified,
    };
  }

  async createSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    assertSafeObjectKey(key);
    return this.client.presignedGetObject(this.bucket, key, ttlSeconds);
  }
}
