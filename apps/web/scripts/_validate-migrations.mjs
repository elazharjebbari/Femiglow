#!/usr/bin/env node
/**
 * Migration validator — vérifie l'intégrité du dossier drizzle/migrations
 * avant tout deploy.
 *
 * Détecte :
 *  - Fichiers .sql présents sans entrée dans le journal
 *  - Entrées du journal sans fichier .sql correspondant
 *  - Tags dupliqués dans le journal
 *  - idx non séquentiel
 *  - `when` régressif (cause skipage silencieux par drizzle-kit)
 *  - Opérations non-transactionnelles sans marker `-- @no-transaction:true`
 *    (CREATE INDEX CONCURRENTLY, ALTER TYPE ADD VALUE, VACUUM, REINDEX)
 *
 * Codes :
 *  - 0 = OK
 *  - 1 = warnings (`when` non strictement croissant, autres soft errors)
 *  - 2 = errors (refuse de déployer)
 *
 * Usage :
 *   node scripts/_validate-migrations.mjs
 *   node scripts/_validate-migrations.mjs --strict     (warnings → errors)
 *   node scripts/_validate-migrations.mjs --json       (output JSON)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = resolve(ROOT, 'drizzle/migrations');
const JOURNAL = resolve(MIGRATIONS_DIR, 'meta/_journal.json');

const strict = process.argv.includes('--strict');
const asJson = process.argv.includes('--json');

const errors = [];
const warnings = [];

// ── Load ──────────────────────────────────────────────────────────────────
let journal;
try {
  journal = JSON.parse(readFileSync(JOURNAL, 'utf8'));
} catch (e) {
  errors.push(`Cannot read journal at ${JOURNAL}: ${e.message}`);
  finish();
}

const sqlFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/\.sql$/, ''));

const journalTags = journal.entries.map((e) => e.tag);

// ── Check 1 : fichier sans journal entry ─────────────────────────────────
const journalSet = new Set(journalTags);
for (const f of sqlFiles) {
  if (!journalSet.has(f)) {
    errors.push(`File ${f}.sql exists but has no journal entry → drizzle will not apply it`);
  }
}

// ── Check 2 : journal entry sans fichier (ghost) ─────────────────────────
const fileSet = new Set(sqlFiles);
for (const tag of journalTags) {
  if (!fileSet.has(tag)) {
    errors.push(`Journal entry "${tag}" has no corresponding .sql file → migrate will fail`);
  }
}

// ── Check 3 : tags dupliqués ─────────────────────────────────────────────
const seen = new Map();
for (const e of journal.entries) {
  if (seen.has(e.tag)) {
    errors.push(`Duplicate journal tag "${e.tag}" at idx ${e.idx} and idx ${seen.get(e.tag)}`);
  } else {
    seen.set(e.tag, e.idx);
  }
}

// ── Check 4 : idx séquentiel à partir de 0 ───────────────────────────────
const sortedByIdx = [...journal.entries].sort((a, b) => a.idx - b.idx);
sortedByIdx.forEach((e, i) => {
  if (e.idx !== i) {
    errors.push(`Non-sequential idx : expected ${i}, got ${e.idx} for tag "${e.tag}"`);
  }
});

// ── Check 5 : `when` strictement croissant (cause drizzle skip) ──────────
for (let i = 1; i < sortedByIdx.length; i++) {
  const prev = sortedByIdx[i - 1];
  const cur = sortedByIdx[i];
  if (cur.when < prev.when) {
    warnings.push(
      `\`when\` regression : idx ${cur.idx} (${cur.tag}, when=${cur.when}) < idx ${prev.idx} (${prev.tag}, when=${prev.when}). ` +
        `drizzle-kit migrate may skip this migration silently.`,
    );
  }
}

// ── Check 6 : operations non-transactionnelles sans marker ──────────────
const NO_TX_PATTERNS = [
  { re: /\bCREATE\s+INDEX\s+CONCURRENTLY\b/i, name: 'CREATE INDEX CONCURRENTLY' },
  { re: /\bALTER\s+TYPE\s+\S+\s+ADD\s+VALUE\b/i, name: 'ALTER TYPE ... ADD VALUE' },
  { re: /\bVACUUM\b/i, name: 'VACUUM' },
  { re: /\bREINDEX\s+(SCHEMA|DATABASE|SYSTEM)\b/i, name: 'REINDEX (global)' },
  { re: /\bCLUSTER\s+VERBOSE\b/i, name: 'CLUSTER VERBOSE' },
];
function stripComments(sql) {
  // strip line comments (--) but preserve string literals naively
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' '); // strip block comments
}
for (const tag of journalTags) {
  if (!fileSet.has(tag)) continue;
  const sql = readFileSync(resolve(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
  const hasMarker = /^--\s*@no-transaction\s*:\s*true\b/im.test(sql);
  const stripped = stripComments(sql);
  for (const { re, name } of NO_TX_PATTERNS) {
    if (re.test(stripped) && !hasMarker) {
      errors.push(
        `${tag}.sql contains \`${name}\` which is incompatible with drizzle transactions. ` +
          `Add \`-- @no-transaction:true\` as the first line OR refactor to a transactional alternative.`,
      );
    }
  }
}

// ── Output ────────────────────────────────────────────────────────────────
function finish() {
  if (asJson) {
    console.log(JSON.stringify({ errors, warnings, ok: errors.length === 0 }, null, 2));
  } else {
    const out = [];
    out.push(`Journal: ${journalTags.length} entries`);
    out.push(`SQL files: ${sqlFiles.length}`);
    if (errors.length === 0 && warnings.length === 0) {
      out.push('✓ All checks passed.');
    }
    for (const w of warnings) out.push(`  ⚠ ${w}`);
    for (const e of errors) out.push(`  ✗ ${e}`);
    console.log(out.join('\n'));
  }
  const finalErrors = strict ? errors.length + warnings.length : errors.length;
  process.exit(finalErrors > 0 ? 2 : warnings.length > 0 ? 1 : 0);
}
finish();
