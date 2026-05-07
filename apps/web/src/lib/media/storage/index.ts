import { env } from '@/lib/env';
import { externalAdapter } from './external';
import { localAdapter } from './local';
import type { StorageAdapter } from './types';
import { vercelBlobAdapter } from './vercel-blob';

export type { PutObjectInput, PutObjectResult, StorageAdapter } from './types';
export { externalAdapter, localAdapter, vercelBlobAdapter };

export function getStorage(): StorageAdapter {
  switch (env.MEDIA_STORAGE_DRIVER) {
    case 'vercelBlob':
      return vercelBlobAdapter;
    case 'external':
      return externalAdapter;
    case 'local':
    default:
      return localAdapter;
  }
}
