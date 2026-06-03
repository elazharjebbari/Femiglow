/**
 * Réconciliation des migrations en retard de TRACKING (objets déjà présents en
 * base mais hash absent de drizzle.__drizzle_migrations à cause d'éditions de
 * fichiers SQL). Applique chaque migration en attente statement-par-statement
 * en TOLÉRANT uniquement les erreurs « objet déjà existant », puis enregistre
 * le hash. Crée aussi explicitement `visitor_attribution` (0073, idempotent)
 * dont la table manquait malgré un hash enregistré.
 *
 * Sûr : toute erreur NON bénigne (syntaxe, dépendance manquante) fait échouer
 * le script (rien n'est enregistré pour cette migration).
 *
 *   node --env-file=.env scripts/_reconcile-migrations.mjs [--dry]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const DRY = process.argv.includes('--dry');
const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations');

// Codes Postgres « objet déjà existant » → bénins en réconciliation.
const BENIGN = new Set(['42P07', '42710', '42701', '42P06', '42P16', '42723']);
const benign = (e) =>
  BENIGN.has(e.code) || /already exists|duplicate/i.test(String(e.message ?? ''));

function hashOf(content) {
  return createHash('sha256').update(content).digest('hex');
}
function splitStatements(sql) {
  // Contrat drizzle : un seul séparateur `--> statement-breakpoint`. NE PAS
  // re-découper sur `;` — cela casserait les blocs `DO $$ … END $$`.
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(--[^\n]*\s*)*$/.test(s));
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant');
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

try {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  );

  // 1) Fix explicite visitor_attribution (idempotent).
  const v0073 = readFileSync(resolve(MIGRATIONS_DIR, '0073_visitor_attribution.sql'), 'utf8');
  if (!DRY) {
    for (const s of splitStatements(v0073)) await sql.unsafe(s);
    console.log('✓ visitor_attribution assuré (0073, idempotent)');
  }

  // 2) Réconcilier les migrations en attente.
  const journal = JSON.parse(readFileSync(resolve(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8'));
  const applied = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const appliedSet = new Set(applied.map((r) => r.hash));

  const pending = [];
  for (const entry of journal.entries.sort((a, b) => a.idx - b.idx)) {
    const content = readFileSync(resolve(MIGRATIONS_DIR, `${entry.tag}.sql`), 'utf8');
    const h = hashOf(content);
    if (!appliedSet.has(h)) pending.push({ tag: entry.tag, when: entry.when, hash: h, content });
  }

  console.log(`Pending: ${pending.length}\n${pending.map((p) => '  → ' + p.tag).join('\n')}`);
  if (DRY) {
    await sql.end();
    process.exit(0);
  }

  for (const p of pending) {
    let appl003 = 0;
    let tolerated = 0;
    for (const s of splitStatements(p.content)) {
      try {
        await sql.unsafe(s);
        appl003 += 1;
      } catch (e) {
        if (benign(e)) {
          tolerated += 1;
        } else {
          console.error(`  ✗ ${p.tag} — erreur non bénigne: ${e.code} ${e.message}`);
          throw e;
        }
      }
    }
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${p.hash}, ${p.when})`;
    console.log(`✓ ${p.tag} (appliqués=${appl003}, tolérés=${tolerated})`);
  }

  console.log(`\n✓ Réconciliation terminée (${pending.length} migration(s)).`);
  await sql.end();
} catch (e) {
  console.error('FATAL :', e.message);
  await sql.end().catch(() => {});
  process.exit(1);
}
