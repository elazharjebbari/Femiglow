import { del, put } from '@vercel/blob';
import { env } from '@/lib/env';
import type { PutObjectInput, PutObjectResult, StorageAdapter } from './types';

export const vercelBlobAdapter: StorageAdapter = {
  driver: 'vercelBlob',
  async put({ key, body, contentType, cacheControl }: PutObjectInput): Promise<PutObjectResult> {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN required for vercelBlob driver');
    }
    const result = await put(key, body, {
      access: 'public',
      contentType,
      cacheControlMaxAge: cacheControl ? parseInt(cacheControl, 10) || undefined : undefined,
      addRandomSuffix: false,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return { key, url: result.url, sizeBytes: body.byteLength };
  },
  async delete(key: string): Promise<void> {
    if (!env.BLOB_READ_WRITE_TOKEN) return;
    await del(key, { token: env.BLOB_READ_WRITE_TOKEN });
  },
  publicUrl(key: string): string {
    return `https://blob.vercel-storage.com/${key}`;
  },
};
