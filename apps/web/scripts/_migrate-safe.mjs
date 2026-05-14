#!/usr/bin/env node
/**
 * Hash-based migration runner (remplacement de `drizzle-kit migrate`).
 *
 * Pourquoi un runner custom :
 *  - drizzle-kit ignore les migrations dont le `when` est antérieur à la
 *    dernière migration appliquée → fail silencieux quand on rebase /
 *    backporte une migration.
 *  - drizzle-kit exécute chaque migration dans une transaction → impossible
 *    de lancer CREATE INDEX CONCURRENTLY, ALTER TYPE ADD VALUE, VACUUM, etc.
 *
 * Comportement de ce runner :
 *  - Parcourt le journal et applique TOUTE migration dont le hash n'est pas
 *    déjà dans `drizzle.__drizzle_migrations`.
 *  - Si le fichier .sql commence par `-- @no-transaction:true` (sur l'une des
 *    5 premières lignes), exécute le SQL DIRECTEMENT (statement-par-statement
 *    via `--> statement-breakpoint`) sans transaction wrapper.
 *  - Sinon, wrap dans BEGIN/COMMIT classique.
 *
 * Usage :
 *   node scripts/_migrate-safe.mjs            # appliquer
 *   node scripts/_migrate-safe.mjs --plan     # afficher ce qui serait appliqué
 *   node scripts/_migrate-safe.mjs --json     # output JSON
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';

const ROOT = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = resolve(ROOT, 'drizzle/migrations');
const JOURNAL = resolve(MIGRATIONS_DIR, 'meta/_journal.json');

const planOnly = process.argv.includes('--plan');
const asJson = process.argv.includes('--json');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing. Try : node --env-file=.env scripts/_migrate-safe.mjs');
  process.exit(2);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

// ── Helpers ───────────────────────────────────────────────────────────────
function hashOf(content) {
  return createHash('sha256').update(content).digest('hex');
}

function isNoTransaction(content) {
  // Marker must appear in the first 5 lines.
  return content
    .split('\n', 5)
    .some((l) => /^--\s*@no-transaction\s*:\s*true\b/i.test(l));
}

function splitStatements(content) {
  // Drizzle uses `--> statement-breakpoint` as separator.
  return content
    .split(/^\s*-->\s*statement-breakpoint\s*$/im)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ── Main ──────────────────────────────────────────────────────────────────
try {
  const journal = JSON.parse(readFileSync(JOURNAL, 'utf8'));

  // Ensure drizzle schema + migration table exists.
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  // Load applied hashes.
  const applied = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const appliedSet = new Set(applied.map((r) => r.hash));

  // Compute the plan.
  const plan = [];
  for (const entry of journal.entries.sort((a, b) => a.idx - b.idx)) {
    const file = resolve(MIGRATIONS_DIR, `${entry.tag}.sql`);
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      throw new Error(`Missing migration file : ${entry.tag}.sql`);
    }
    const h = hashOf(content);
    if (appliedSet.has(h)) continue;
    plan.push({
      idx: entry.idx,
      tag: entry.tag,
      when: entry.when,
      hash: h,
      content,
      noTransaction: isNoTransaction(content),
    });
  }

  if (asJson) {
    console.log(JSON.stringify({ pending: plan.length, plan: plan.map(({ content, ...rest }) => rest) }, null, 2));
  } else {
    console.log(`Applied: ${appliedSet.size}`);
    console.log(`Pending: ${plan.length}`);
    for (const p of plan) {
      console.log(`  → ${p.tag}${p.noTransaction ? '  [@no-transaction]' : ''}`);
    }
  }

  if (planOnly || plan.length === 0) {
    await sql.end();
    process.exit(0);
  }

  // Apply.
  for (const p of plan) {
    console.log(`Applying ${p.tag}…`);
    try {
      if (p.noTransaction) {
        // Run each statement standalone, NOT wrapped in a BEGIN.
        const stmts = splitStatements(p.content);
        for (const s of stmts) await sql.unsafe(s);
      } else {
        await sql.begin(async (tx) => {
          const stmts = splitStatements(p.content);
          for (const s of stmts) await tx.unsafe(s);
        });
      }
      await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${p.hash}, ${p.when})`;
      console.log(`  ✓ ${p.tag}`);
    } catch (e) {
      console.error(`  ✗ FAIL ${p.tag} : ${e.message}`);
      console.error(`    code=${e.code || ''}  detail=${e.detail || ''}  where=${e.where || ''}`);
      if (!p.noTransaction && /cannot run inside a transaction block/i.test(e.message ?? '')) {
        console.error(
          `    → This error typically means the migration needs \`-- @no-transaction:true\` ` +
            `as its first line. Edit ${p.tag}.sql and re-run.`,
        );
      }
      throw e;
    }
  }

  console.log(`\n✓ ${plan.length} migration(s) applied.`);
  await sql.end();
} catch (e) {
  console.error('FATAL :', e.message);
  await sql.end().catch(() => {});
  process.exit(1);
}
