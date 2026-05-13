/**
 * Phase wipe-media — supprime le contenu de .media-storage/.
 * Tolérant : un fichier non-supprimable produit un warning, pas un fatal.
 */
import { rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { PhaseContext, PhaseResult } from '../types';

export async function runWipeMedia(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run' };
  }
  if (!ctx.config.wipeMedia) {
    return { stats: { skipped: true, reason: 'config.wipeMedia=false' }, summary: 'wipeMedia désactivé' };
  }
  const target = process.env.MEDIA_LOCAL_DIR || '/var/www/femiglow/.media-storage';
  // On supprime aussi le legacy apps/web/.media-storage si présent
  const legacy = '/var/www/femiglow/apps/web/.media-storage';

  let removedDirs = 0;
  let freedBytes = 0;
  const warnings: string[] = [];

  for (const dir of [target, legacy]) {
    ctx.onProgress?.(`wipe ${dir}`, dir === target ? 0.3 : 0.7);
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        const p = path.join(dir, entry);
        try {
          const s = await stat(p);
          if (s.isDirectory() || s.isFile()) {
            freedBytes += s.size; // approximation (récursif non comptabilisé)
          }
          await rm(p, { recursive: true, force: true });
          removedDirs += 1;
        } catch (err) {
          warnings.push(`rm ${p} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch {
      // dir n'existe pas — pas grave
    }
  }

  return {
    stats: { removedDirs, freedBytes, targets: [target, legacy] },
    summary: `${removedDirs} entrées média supprimées`,
    warnings: warnings.length ? warnings : undefined,
  };
}
