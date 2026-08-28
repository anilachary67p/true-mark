export interface ObjectRef {
  key: string;
  bucket: string;
  etag?: string;
}

export interface ObjectMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified?: Date;
}

export interface ObjectStorageProvider {
  upload(
    key: string,
    data: Buffer,
    metadata: { contentType: string; tenantId: string },
  ): Promise<ObjectRef>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getMetadata(key: string): Promise<ObjectMetadata>;
  createSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}

export interface SecretProvider {
  getSecret(key: string): Promise<string>;
}

export interface AiProvider {
  analyzeImage(
    image: Buffer,
    context: { checkType: string; referenceMetadata?: Record<string, unknown> },
  ): Promise<{ confidence: number; passed: boolean; details: Record<string, unknown> }>;
  extractOcr(
    image: Buffer,
    fields: string[],
  ): Promise<Array<{ field: string; value: string; confidence: number }>>;
  checkImageQuality(image: Buffer): Promise<{ clear: boolean; score: number; reason?: string }>;
}
