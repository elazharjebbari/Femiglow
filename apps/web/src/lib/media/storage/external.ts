import { isPrivateHostname } from '@/lib/webhooks/anti-ssrf';
import type { PutObjectInput, PutObjectResult, StorageAdapter } from './types';

function assertSafeUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('invalid url');
  }
  if (parsed.protocol !== 'https:') throw new Error('https required');
  if (isPrivateHostname(parsed.hostname)) throw new Error('private host blocked');
}

/**
 * Passthrough adapter — the URL points at an externally hosted object and we
 * never upload anything. `key` IS the URL; `put` validates it.
 */
export const externalAdapter: StorageAdapter = {
  driver: 'external',
  async put({ key, body }: PutObjectInput): Promise<PutObjectResult> {
    assertSafeUrl(key);
    return { key, url: key, sizeBytes: body.byteLength };
  },
  async delete(_key: string): Promise<void> {
    /* no-op: external assets are not owned */
  },
  publicUrl(key: string): string {
    return key;
  },
};
