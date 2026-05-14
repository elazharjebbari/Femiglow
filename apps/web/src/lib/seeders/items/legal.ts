/**
 * Seeder legal — réutilise `seedLegalPages()` du script CLI. Insère les 9
 * pages légales préconfigurées + leurs placements + variables défaut.
 *
 * Idempotent : préserve les éditions admin (ne touche pas si status != draft
 * ou body_md modifié), sauf si appelé avec --force.
 */
import { seedLegalPages } from '../../../../scripts/seed-legal';
import type { SeederContext, SeederResult } from '../types';

export async function legalSeeder(ctx: SeederContext): Promise<SeederResult> {
  ctx.onProgress?.('seeding legal pages', 0.1);
  const report = await seedLegalPages({ force: false });
  ctx.onProgress?.('done', 1);
  return {
    stats: {
      pagesInserted: report.pagesInserted,
      pagesSkipped: report.pagesSkipped,
      placementsInserted: report.placementsInserted,
      varsCount: report.varsCount,
      zonesCount: report.zonesCount,
    },
    summary:
      `${report.pagesInserted} pages nouvelles · ${report.pagesSkipped} préservées · ` +
      `${report.placementsInserted} placements · ${report.varsCount} variables · ${report.zonesCount} zones`,
  };
}
