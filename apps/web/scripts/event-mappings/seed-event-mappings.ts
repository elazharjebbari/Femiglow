/**
 * seed-event-mappings.ts — Charge default-mapping.json dans __default__ DB.
 *
 * Idempotent : si la version __default__ existe déjà, UPDATE mappings + checksum
 * meta. Sinon INSERT.
 *
 * Usage :
 *   pnpm --filter @femiglow/web exec tsx scripts/event-mappings/seed-event-mappings.ts
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

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(2);
  }

  const file = JSON.parse(readFileSync(DEFAULT_JSON, 'utf8'));
  if (!file.mappings || typeof file.mappings !== 'object') {
    console.error('ERROR: default-mapping.json invalid (missing mappings)');
    process.exit(3);
  }

  const sql = postgres(dbUrl, { max: 1 });

  try {
    // Upsert __default__
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
    console.log(`✓ Seeded __default__ with ${eventsCount} events`);
    console.log(`  Checksum: ${file._meta?.checksum ?? '(missing)'}`);

    // Si aucune version active, activer __default__ (cas 1re install)
    const active = await sql<{ count: number }[]>`
      SELECT count(*)::int as count FROM event_mapping_versions WHERE is_active = true
    `;
    if (active[0]?.count === 0) {
      await sql`
        UPDATE event_mapping_versions
        SET is_active = true, status = 'active', activated_at = now()
        WHERE id = '__default__'
      `;
      console.log(`✓ Activated __default__ (no active version was present)`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
