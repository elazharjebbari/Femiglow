/**
 * Seeder media — réutilise `runMediaSeed()` du script CLI. Lit
 * `docs/images/values/**`, crée les enregistrements media en mode
 * passthrough, et enqueue les jobs d'optimisation.
 *
 * Idempotent : un media déjà présent (slug) est ignoré.
 */
import { runMediaSeed } from '../../../../scripts/seed-media';
import type { SeederContext, SeederResult } from '../types';

export async function mediaSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  const report = await runMediaSeed({
    onProgress: (label, fraction) => ctx.onProgress?.(label, fraction),
  });
  return {
    stats: {
      created: report.created,
      skipped: report.skipped,
      scanned: report.scanned,
      errors: report.errors,
    },
    summary:
      `${report.created} créés · ${report.skipped} déjà présents · ` +
      `${report.scanned} scannés${report.errors ? ` · ⚠ ${report.errors} erreurs` : ''}`,
  };
}
