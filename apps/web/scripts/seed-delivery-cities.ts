/**
 * Seed delivery cities — alimente `delivery_cities` depuis le fixture sendit.
 *
 * Idempotent : ré-applique les valeurs seed à chaque exécution. **Préserve
 * les éditions admin** : une ligne dont `source !== 'sendit'` n'est jamais
 * écrasée (sauf si appelé avec `--force` côté CLI / `force: true` côté API).
 *
 * Usages
 * ──────
 *   pnpm --filter @femiglow/web seed:delivery-cities
 *   pnpm --filter @femiglow/web seed:delivery-cities -- --force
 *
 * Appelé aussi :
 *   - depuis `src/lib/boot/seed-on-boot.ts` au démarrage du process (dev /
 *     AUTO_SEED=1) pour garantir une DB amorcée sans `pnpm db:migrate` manuel.
 *   - depuis l'endpoint admin `POST /api/admin/delivery-cities/seed` pour
 *     déclencher un re-seed manuel via l'UI.
 */
import './_load-env.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  bulkUpsertDeliveryCities,
  type BulkUpsertResult,
} from '@/lib/db/queries/delivery-cities';
import {
  parseSenditFixture,
  type ImportResult,
} from '@/lib/checkout/delivery/cities-importer';

/**
 * Chemin par défaut du fixture sendit. Override possible via `SEED_DELIVERY_CITIES_PATH`
 * (utile en tests pour pointer vers un fichier réduit).
 */
function defaultFixturePath(): string {
  const env = process.env.SEED_DELIVERY_CITIES_PATH;
  if (env) return path.resolve(env);
  // `apps/web/scripts/seed-delivery-cities.ts` → `apps/web/data/seeds/...`
  return path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'data',
    'seeds',
    'delivery-cities-sendit.json',
  );
}

export interface SeedOptions {
  /** Force l'écrasement des lignes éditées par l'admin (source !== 'sendit'). */
  force?: boolean;
  /** Actor id pour `updated_by` / `created_by` (audit). */
  actorId?: string | null;
  /** Override le chemin du fixture. */
  fixturePath?: string;
}

export interface SeedReport {
  fixturePath: string;
  importer: ImportResult['summary'];
  database: BulkUpsertResult;
}

export async function runDeliveryCitiesSeed(
  opts: SeedOptions = {},
): Promise<SeedReport> {
  const fixturePath = opts.fixturePath ?? defaultFixturePath();
  const raw = await readFile(fixturePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[seed-delivery-cities] fixture JSON invalide (${fixturePath}): ${
        (err as Error).message
      }`,
    );
  }
  const result = parseSenditFixture(parsed);
  const dbResult = await bulkUpsertDeliveryCities(result.cities, {
    actorId: opts.actorId ?? null,
    force: opts.force ?? false,
  });
  return {
    fixturePath,
    importer: result.summary,
    database: dbResult,
  };
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const report = await runDeliveryCitiesSeed({ force });
  console.log(
    `[seed-delivery-cities] fixture: ${path.basename(report.fixturePath)}`,
  );
  console.log(
    `[seed-delivery-cities] parsed=${report.importer.parsed} unique=${report.importer.unique} ` +
      `dropped=${report.importer.dropped} reasons=${JSON.stringify(
        report.importer.droppedReasons,
      )}`,
  );
  console.log(
    `[seed-delivery-cities] db: inserted=${report.database.inserted} updated=${report.database.updated} ` +
      `skipped=${report.database.skipped} (preserved admin edits)`,
  );
  if (report.database.preservedSlugs.length > 0) {
    console.log(
      `[seed-delivery-cities] preserved slugs (${report.database.preservedSlugs.length}): ` +
        report.database.preservedSlugs.slice(0, 10).join(', ') +
        (report.database.preservedSlugs.length > 10 ? ', ...' : ''),
    );
  }
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[seed-delivery-cities] erreur:', err);
    process.exit(1);
  });
}
