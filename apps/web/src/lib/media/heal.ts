/**
 * Helper de réconciliation media : détecte si les variantes physiques d'un
 * media existent encore sur disque (driver `local` uniquement). Utilisé par
 * les seeders pour décider entre "skip car déjà ready" et "régénérer car
 * fichiers absents".
 *
 * Pour les drivers non-local (Vercel Blob, external), on suppose les
 * variantes présentes (un GET pour vérifier déclencherait des coûts inutiles
 * et nécessiterait une API list que le storage adapter n'expose pas).
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { listVariants } from '@/lib/db/queries/media-variants';

function urlToFsPath(url: string): string | null {
  const baseUrl = env.MEDIA_PUBLIC_BASE_URL;
  if (!url.startsWith(baseUrl)) return null;
  const relKey = url.slice(baseUrl.length).replace(/^\//, '');
  const root = path.isAbsolute(env.MEDIA_LOCAL_DIR)
    ? env.MEDIA_LOCAL_DIR
    : path.resolve(process.cwd(), env.MEDIA_LOCAL_DIR);
  return path.join(root, relKey);
}

/**
 * `true` si le media a au moins une variante DB ET la première variante
 * existe physiquement sur disque (local driver). Pour les drivers
 * non-local, on retourne `true` dès qu'il y a une variante DB.
 */
export async function mediaVariantsHealthy(mediaId: string): Promise<boolean> {
  const variants = await listVariants(mediaId);
  if (variants.length === 0) return false;
  if (env.MEDIA_STORAGE_DRIVER !== 'local') return true;
  const fsPath = urlToFsPath(variants[0]!.url);
  if (!fsPath) return true; // URL externe, on présume OK
  try {
    await access(fsPath);
    return true;
  } catch {
    return false;
  }
}
