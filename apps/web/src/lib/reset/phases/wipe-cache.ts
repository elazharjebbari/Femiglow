/**
 * Phase wipe-cache — supprime apps/web/.next/ (cache build Next.js).
 * Non critique : si ça rate, le build suivant reconstruira.
 */
import { rm } from 'node:fs/promises';
import type { PhaseContext, PhaseResult } from '../types';

export async function runWipeCache(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run' };
  }
  if (!ctx.config.wipeNextCache) {
    return { stats: { skipped: true }, summary: 'wipeNextCache désactivé' };
  }
  const target = process.env.FEMIGLOW_ROOT
    ? `${process.env.FEMIGLOW_ROOT}/apps/web/.next`
    : '/var/www/femiglow/apps/web/.next';
  ctx.onProgress?.(`rm -rf ${target}`, 0.5);
  try {
    await rm(target, { recursive: true, force: true });
  } catch (err) {
    return {
      stats: { ok: false, target },
      summary: 'wipe cache échoué (non critique)',
      warnings: [err instanceof Error ? err.message : String(err)],
    };
  }
  return { stats: { ok: true, target }, summary: '.next supprimé' };
}
