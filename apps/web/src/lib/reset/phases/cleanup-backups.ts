/**
 * Phase cleanup-backups — prune les vieux backups (garde les N plus récents).
 */
import { readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import type { PhaseContext, PhaseResult } from '../types';

const BACKUP_ROOT = process.env.RESET_BACKUP_ROOT || '/var/backups/femiglow';

export async function runCleanupBackups(ctx: PhaseContext): Promise<PhaseResult> {
  const keep = Math.max(0, ctx.config.keepBackups);

  let entries: string[] = [];
  try {
    entries = await readdir(BACKUP_ROOT);
  } catch {
    return { stats: { skipped: true, reason: 'backup dir absent' }, summary: 'rien à nettoyer' };
  }

  const dirsWithMtime: Array<{ name: string; mtimeMs: number }> = [];
  for (const e of entries) {
    if (!e.startsWith('bkp_')) continue;
    const p = path.join(BACKUP_ROOT, e);
    try {
      const s = await stat(p);
      if (s.isDirectory()) dirsWithMtime.push({ name: e, mtimeMs: s.mtimeMs });
    } catch {
      // ignore
    }
  }

  dirsWithMtime.sort((a, b) => b.mtimeMs - a.mtimeMs); // récents d'abord
  const toRemove = dirsWithMtime.slice(keep);

  let pruned = 0;
  for (const d of toRemove) {
    ctx.onProgress?.(`rm ${d.name}`, pruned / Math.max(1, toRemove.length));
    try {
      await rm(path.join(BACKUP_ROOT, d.name), { recursive: true, force: true });
      pruned += 1;
    } catch {
      // ignore (non critique)
    }
  }

  return {
    stats: { pruned, kept: dirsWithMtime.length - pruned, keepConfig: keep },
    summary: `${pruned} backup(s) supprimé(s) · ${dirsWithMtime.length - pruned} conservé(s)`,
  };
}
