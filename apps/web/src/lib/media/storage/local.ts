import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { env } from '@/lib/env';
import type { PutObjectInput, PutObjectResult, StorageAdapter } from './types';

/**
 * Localise la racine `.media-storage` indépendamment du cwd.
 *
 * En monorepo, `process.cwd()` peut être la racine du repo OU `apps/web`
 * selon comment le serveur a été démarré (next dev, pnpm --filter, tsx
 * scripts/...). Si plusieurs racines candidates existent, on choisit en
 * priorité celle qui existe déjà (pour rester compatible avec un store
 * historique), sinon on prend la première.
 */
function root(): string {
  const baseDir = env.MEDIA_LOCAL_DIR;
  if (isAbsolute(baseDir)) return baseDir;
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, baseDir),
    resolve(cwd, 'apps/web', baseDir),
    resolve(cwd, '..', baseDir),
    resolve(cwd, '../..', baseDir),
  ];
  const existing = candidates.find((p) => existsSync(p));
  return existing ?? candidates[0]!;
}

function safePath(key: string): string {
  if (key.includes('..')) throw new Error('invalid key');
  return join(root(), key);
}

export const localAdapter: StorageAdapter = {
  driver: 'local',
  async put({ key, body }: PutObjectInput): Promise<PutObjectResult> {
    const path = safePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return {
      key,
      url: `${env.MEDIA_PUBLIC_BASE_URL}/${key}`,
      sizeBytes: body.byteLength,
    };
  },
  async delete(key: string): Promise<void> {
    await rm(safePath(key), { force: true });
  },
  publicUrl(key: string): string {
    return `${env.MEDIA_PUBLIC_BASE_URL}/${key}`;
  },
  async get(key: string): Promise<Buffer> {
    return readFile(safePath(key));
  },
};
