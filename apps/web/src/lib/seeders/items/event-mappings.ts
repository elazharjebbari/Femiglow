/**
 * Seeder event-mappings — charge le factory mapping (70 events × 6 vendors)
 * dans event_mapping_versions.__default__ depuis
 * docs/event-mappings/20-data/default-mapping.json.
 *
 * Idempotent : UPSERT. Active __default__ si aucune autre version n'est active.
 */
import { runEventMappingsSeed } from '../../../../scripts/event-mappings/seed-event-mappings';
import type { SeederContext, SeederResult } from '../types';

export async function eventMappingsSeeder(ctx: SeederContext): Promise<SeederResult> {
  ctx.onProgress?.('loading default-mapping.json', 0.1);
  const report = await runEventMappingsSeed();
  ctx.onProgress?.('done', 1);
  return {
    stats: {
      eventsCount: report.eventsCount,
      activated: report.activated ? 1 : 0,
      alreadyActive: report.alreadyActive ? 1 : 0,
    },
    summary:
      `${report.eventsCount} events seedés${report.activated ? ' (activé)' : report.alreadyActive ? ' (autre version active)' : ''}`,
  };
}
