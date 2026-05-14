/**
 * seed-event-mappings.ts — Charge default-mapping.json dans __default__ DB.
 *
 * Idempotent : si la version __default__ existe déjà, UPDATE mappings + checksum
 * meta. Sinon INSERT.
 *
 * Usage :
 *   pnpm --filter @femiglow/web exec tsx scripts/event-mappings/seed-event-mappings.ts
 *
 * Aussi exposé en tant que fonction réutilisable `runEventMappingsSeed()` pour
 * l'endpoint /api/admin/tracking/events/mappings/seed-defaults et le seeder
 * global /admin/settings/seeders.
 *
 * cf. ADR-002, 80-runbook/deployment.md §3
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const DEFAULT_JSON = join(REPO_ROOT, 'docs/event-mappings/20-data/default-mapping.json');

export type EventMappingsSeedReport = {
  eventsCount: number;
  checksum: string | null;
  activated: boolean;
  alreadyActive: boolean;
};

export async function runEventMappingsSeed(): Promise<EventMappingsSeedReport> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  const file = JSON.parse(readFileSync(DEFAULT_JSON, 'utf8'));
  if (!file.mappings || typeof file.mappings !== 'object') {
    throw new Error('default-mapping.json invalid (missing mappings)');
  }

  const sql = postgres(dbUrl, { max: 1 });
  try {
    await sql`
      INSERT INTO event_mapping_versions (id, name, status, is_active, is_default, mappings, created_by, notes)
      VALUES (
        '__default__',
        ${file._meta?.name ?? 'FemiGlow Factory Default'},
        'archived',
        false,
        true,
        ${JSON.stringify(file.mappings)}::jsonb,
        'system',
        ${file._meta?.checksum ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        mappings = EXCLUDED.mappings,
        notes = EXCLUDED.notes,
        name = EXCLUDED.name
    `;

    const eventsCount = Object.keys(file.mappings).length;

    const active = await sql<{ count: number }[]>`
      SELECT count(*)::int as count FROM event_mapping_versions WHERE is_active = true
    `;
    const alreadyActive = (active[0]?.count ?? 0) > 0;
    let activated = false;
    if (!alreadyActive) {
      await sql`
        UPDATE event_mapping_versions
        SET is_active = true, status = 'active', activated_at = now()
        WHERE id = '__default__'
      `;
      activated = true;
    }

    return {
      eventsCount,
      checksum: file._meta?.checksum ?? null,
      activated,
      alreadyActive,
    };
  } finally {
    await sql.end();
  }
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  runEventMappingsSeed()
    .then((r) => {
      console.log(`✓ Seeded __default__ with ${r.eventsCount} events`);
      console.log(`  Checksum: ${r.checksum ?? '(missing)'}`);
      if (r.activated) console.log(`✓ Activated __default__ (no active version was present)`);
      else if (r.alreadyActive) console.log(`  __default__ not activated (another version is already active)`);
    })
    .catch((err) => {
      console.error('FATAL:', err);
      process.exit(1);
    });
}
