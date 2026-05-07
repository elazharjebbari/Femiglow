export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export interface PutObjectResult {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface StorageAdapter {
  readonly driver: 'local' | 'vercelBlob' | 'external';
  put(input: PutObjectInput): Promise<PutObjectResult>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
  /** Optional: returns the buffer for in-process pipelines / poster extraction. */
  get?(key: string): Promise<Buffer>;
}
