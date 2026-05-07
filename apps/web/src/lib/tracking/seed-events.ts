import { logger } from '@/lib/logging/logger';
import {
  countEventDefinitions,
  upsertEventDefinition,
} from '@/lib/db/queries/tracking/event-definitions';
import { EVENT_CATALOG } from './event-catalog';

export interface SeedEventsResult {
  alreadySeeded: boolean;
  total: number;
  upserted: number;
}

/**
 * Seed (ou re-seed) la table `trackingEventDefinitions` à partir de
 * `EVENT_CATALOG`. Idempotent — utilise `upsertEventDefinition`.
 *
 * @param force Si true, écrit même si la table contient déjà des entrées.
 */
export async function seedEventDefinitionsFromCatalog(
  options: { force?: boolean } = {},
): Promise<SeedEventsResult> {
  const existing = await countEventDefinitions();
  if (existing > 0 && !options.force) {
    return { alreadySeeded: true, total: existing, upserted: 0 };
  }
  let upserted = 0;
  for (const def of EVENT_CATALOG) {
    await upsertEventDefinition({
      name: def.name,
      category: def.category,
      scope: def.scope,
      description: def.description,
      isConversion: def.isConversion,
      paramsSchema: def.paramsSchema,
      applicableCategories: def.applicableCategories,
      defaultProviders: def.defaultProviders,
    });
    upserted += 1;
  }
  logger.info('tracking.events.seeded', {
    upserted,
    force: Boolean(options.force),
  });
  return { alreadySeeded: false, total: upserted, upserted };
}

/**
 * Auto-seed lazy : ne fait rien si la BDD contient déjà des events.
 * À appeler dans les routes admin pour garantir un catalogue minimum.
 */
export async function ensureEventDefinitionsSeeded(): Promise<SeedEventsResult> {
  return seedEventDefinitionsFromCatalog({ force: false });
}
