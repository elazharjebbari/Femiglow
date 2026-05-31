/**
 * Seeder media — réutilise `runMediaSeed()` du script CLI. Lit
 * `docs/images/values/**`, crée les enregistrements media et **optimise
 * inline** (variantes AVIF/WebP/JPEG générées immédiatement). Heal
 * automatique : un media déjà présent dont les variantes physiques
 * manquent est ré-optimisé (sinon `skipped`).
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
      healed: report.healed,
      skipped: report.skipped,
      scanned: report.scanned,
      errors: report.errors,
    },
    summary:
      `${report.created} créés · ${report.healed} soignés · ${report.skipped} déjà présents · ` +
      `${report.scanned} scannés${report.errors ? ` · ⚠ ${report.errors} erreurs` : ''}`,
  };
}
