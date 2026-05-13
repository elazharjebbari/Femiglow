/**
 * migrate-baseline.ts — Aligne `drizzle.__drizzle_migrations` avec l'état
 * réel de la DB en insérant les hashes des migrations déjà appliquées.
 *
 * Cas d'usage : la prod (ou un staging restauré) a été créée historiquement
 * via `drizzle-kit push` qui ne peuple pas le journal. Le journal est donc
 * vide, alors que toutes les colonnes/tables 0000-NNNN existent en DB.
 * Lancer `drizzle-kit migrate` dans cet état tenterait de ré-appliquer
 * 0000_initial.sql sur des tables existantes → échec.
 *
 * Stratégie :
 *   1. Lit `drizzle/migrations/meta/_journal.json`
 *   2. Pour chaque entry dont `idx <= MAX_BASELINE_IDX`, calcule sha256(sql)
 *   3. Si le hash n'est pas dans `__drizzle_migrations`, l'insère avec
 *      `created_at = entry.when` (ms epoch — préserve l'ordre)
 *   4. Les migrations > MAX_BASELINE_IDX restent à appliquer par drizzle-kit
 *
 * Mode opérationnel :
 *   - `--dry-run` : liste les inserts sans toucher la DB
 *   - `--max-tag=<tag>` : override le tag de coupure (default 0027)
 *   - Sans flag : applique en transaction
 *
 * Le sha256 du contenu UTF-8 du .sql est la convention drizzle-orm —
 * voir node_modules/drizzle-orm/.../migrator.js.
 *
 * Cf. docs/tracking-improvement/80-runbook/deployment.md §3.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'drizzle', 'migrations');
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta', '_journal.json');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

function parseArgs(): { dryRun: boolean; maxTag: string } {
  const args = process.argv.slice(2);
  const maxTagArg = args.find((a) => a.startsWith('--max-tag='));
  return {
    dryRun: args.includes('--dry-run'),
    maxTag: maxTagArg ? maxTagArg.slice('--max-tag='.length) : '0027',
  };
}

function readJournal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as Journal;
}

function sha256OfFile(filename: string): string {
  const content = readFileSync(join(MIGRATIONS_DIR, `${filename}.sql`), 'utf8');
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  const { dryRun, maxTag } = parseArgs();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set.');
    process.exit(2);
  }
  if (dbUrl.includes('localhost') && !process.env.ALLOW_LOCAL_BASELINE) {
    console.error(
      'ERROR: DATABASE_URL points to localhost. Refusing to baseline a local DB ' +
        'unless ALLOW_LOCAL_BASELINE=1 is set. The baseline is intended for prod/staging.',
    );
    process.exit(3);
  }

  const journal = readJournal();
  // Cut-off : on baseline seulement les migrations <= maxTag (par tag string compare,
  // car les tags 0000_..0099_ sont zéro-paddés).
  const baselineCandidates = journal.entries.filter(
    (e) => /^\d{4}_/.test(e.tag) && e.tag.split('_')[0] <= maxTag,
  );

  console.log(
    `Baseline : ${baselineCandidates.length} migrations candidates (tag <= ${maxTag})`,
  );

  const sql = postgres(dbUrl, { max: 1 });

  try {
    // Garantir l'existence de la table drizzle.__drizzle_migrations.
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    const existing = await sql<{ hash: string }[]>`
      SELECT hash FROM drizzle.__drizzle_migrations
    `;
    const existingHashes = new Set(existing.map((r) => r.hash));
    console.log(`Journal actuel : ${existingHashes.size} entrée(s) en DB.`);

    interface PendingInsert {
      tag: string;
      hash: string;
      when: number;
    }
    const inserts: PendingInsert[] = [];
    for (const entry of baselineCandidates) {
      let hash: string;
      try {
        hash = sha256OfFile(entry.tag);
      } catch (err) {
        console.warn(
          `⚠ SQL file manquant pour ${entry.tag} (${(err as Error).message}). Skip.`,
        );
        continue;
      }
      if (existingHashes.has(hash)) {
        console.log(`  ✓ déjà en journal : ${entry.tag}`);
        continue;
      }
      inserts.push({ tag: entry.tag, hash, when: entry.when });
    }

    if (inserts.length === 0) {
      console.log('Rien à insérer — le journal contient déjà tous les hashes 0000-' + maxTag + '.');
      return;
    }

    console.log(`\nWill insert ${inserts.length} baseline row(s):`);
    inserts.forEach((i) =>
      console.log(`  + ${i.tag.padEnd(50)} hash=${i.hash.slice(0, 16)}…  when=${i.when}`),
    );

    if (dryRun) {
      console.log('\n--dry-run — pas d\'insert effectué.');
      return;
    }

    // Transactionnel — soit tout, soit rien.
    await sql.begin(async (tx) => {
      for (const i of inserts) {
        await tx`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${i.hash}, ${i.when})
        `;
      }
    });
    console.log(`\n✓ ${inserts.length} entrée(s) baselinées.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
