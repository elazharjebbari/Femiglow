/**
 * Seeder rituals — réutilise `runRitualsSeed()` du script CLI. Insère les
 * témoignages éditoriaux FemiGlow (idempotent : repérage par hash body).
 */
import { runRitualsSeed } from '../../../../scripts/seed-rituals';
import type { SeederContext, SeederResult } from '../types';

export async function ritualsSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  const report = await runRitualsSeed({
    onProgress: (label, fraction) => ctx.onProgress?.(label, fraction),
  });
  return {
    stats: {
      inserted: report.inserted,
      skipped: report.skipped,
      total: report.total,
    },
    summary:
      `${report.inserted} insérés · ${report.skipped} déjà présents (sur ${report.total})`,
  };
}
