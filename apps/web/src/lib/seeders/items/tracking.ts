/**
 * Seeder tracking — réutilise `runTrackingSeed()` du script CLI. Scanne
 * l'inventaire pages+components, upsert les event-definitions du catalogue,
 * relie composants aux pages selon les patterns, et déclare les providers.
 */
import { runTrackingSeed } from '../../../../scripts/seed-tracking';
import type { SeederContext, SeederResult } from '../types';

export async function trackingSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  const report = await runTrackingSeed({
    onProgress: (label, fraction) => ctx.onProgress?.(label, fraction),
  });
  return {
    stats: {
      pages: report.pages,
      components: report.components,
      events: report.events,
      providers: report.providers,
    },
    summary:
      `${report.events} events · ${report.pages} pages · ` +
      `${report.components} composants · ${report.providers} providers`,
  };
}
