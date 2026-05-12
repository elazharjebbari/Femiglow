/**
 * Seeder delivery-cities — réutilise `runDeliveryCitiesSeed()` du script CLI.
 * **Préserve les éditions admin par défaut** (source !== 'sendit' jamais
 * écrasé sans force=true).
 */
import { runDeliveryCitiesSeed } from '../../../../scripts/seed-delivery-cities';
import type { SeederContext, SeederResult } from '../types';

export async function deliveryCitiesSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Lecture fixture sendit (~430 villes)', 0.1);
  const report = await runDeliveryCitiesSeed({
    actorId: ctx.actorId ?? null,
    force: false,
  });
  ctx.onProgress?.('Upsert delivery_cities', 0.7);

  return {
    stats: {
      inserted: report.database.inserted,
      updated: report.database.updated,
      preserved: report.database.skipped,
    },
    summary:
      `${report.database.inserted} nouvelles · ` +
      `${report.database.updated} maj · ` +
      `${report.database.skipped} conservées (édits admin)`,
  };
}
