/**
 * Seed chat_canned_pair — alimente la table depuis le CSV de spec V5/V6.
 *
 * Idempotent : UPSERT par `key`. Chaque insertion ou update crée également
 * une `chat_canned_pair_version` (immutable history) si le body_hash
 * a changé. Marque le seed comme `status='published'` car les paires
 * sont prêtes pour la prod (validées dans la spec).
 *
 * Usages
 * ──────
 *   pnpm tsx scripts/seed-chat-canned-pairs.ts
 *
 * Appelé aussi depuis le seeder runner via
 * `src/lib/seeders/items/chat-canned-pairs.ts`.
 *
 * cf. docs/dossier-chat-v2/02-data/canned-pairs-seed.csv
 */
import './_load-env.mjs';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';

const CSV_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  '..',
  'docs',
  'dossier-chat-v2',
  '02-data',
  'canned-pairs-seed.csv',
);

export interface CannedPairSeedReport {
  csvPath: string;
  parsed: number;
  inserted: number;
  updated: number;
  versioned: number; // nb de nouvelles versions créées (body_hash diff)
  skipped: number;
}

interface CsvRow {
  key: string;
  page_pattern: string;
  audience: 'all' | 'b2c' | 'b2b';
  order: number;
  label_fr: string;
  label_ar: string;
  label_ar_ma: string;
  scripted_reply_fr: string;
  scripted_reply_ar: string;
  scripted_reply_ar_ma: string;
  cta_label: string | null;
  cta_url: string | null;
  allow_followup_llm: boolean;
  intent_implied: string | null;
  // CHA-310 — Conversion-focused fields (rétrocompatibles : si les
  // colonnes manquent dans un CSV legacy, on retombe sur false / null).
  triggers_lead_form: boolean;
  lead_form_copy_key: string | null;
  status: 'draft' | 'review' | 'published' | 'archived';
}

/**
 * Parser CSV minimaliste : gère les champs entre `"..."` contenant `,`.
 * Pas d'échappement `\"` (le CSV de spec n'en a pas). Retourne les rows
 * comme un tableau de string[].
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (inQuote) {
      if (c === '"') {
        inQuote = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((f) => f.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.length > 0)) rows.push(row);
  }
  return rows;
}

function toCsvRow(headers: string[], cells: string[]): CsvRow {
  const get = (k: string): string => {
    const idx = headers.indexOf(k);
    if (idx < 0) throw new Error(`column ${k} not in CSV`);
    return cells[idx] ?? '';
  };
  // CHA-310 — Lookup tolérant pour les colonnes optionnelles (rétrocompat
  // si on relit un CSV antérieur à 0037).
  const getOpt = (k: string): string => {
    const idx = headers.indexOf(k);
    if (idx < 0) return '';
    return cells[idx] ?? '';
  };
  const audience = get('audience') as CsvRow['audience'];
  if (audience !== 'all' && audience !== 'b2c' && audience !== 'b2b') {
    throw new Error(`invalid audience for key=${get('key')}: ${audience}`);
  }
  const rawStatus = getOpt('status').trim().toLowerCase();
  const status: CsvRow['status'] =
    rawStatus === 'archived' || rawStatus === 'draft' || rawStatus === 'review'
      ? rawStatus
      : 'published';
  const rawCopyKey = getOpt('lead_form_copy_key').trim();
  const lead_form_copy_key = rawCopyKey.length > 0 ? rawCopyKey : null;
  return {
    key: get('key').trim(),
    page_pattern: get('page_pattern').trim() || '*',
    audience,
    order: Number.parseInt(get('order'), 10) || 0,
    label_fr: get('label_fr').trim(),
    label_ar: get('label_ar').trim(),
    label_ar_ma: get('label_ar_ma').trim(),
    scripted_reply_fr: get('scripted_reply_fr').trim(),
    scripted_reply_ar: get('scripted_reply_ar').trim(),
    scripted_reply_ar_ma: get('scripted_reply_ar_ma').trim(),
    cta_label: get('cta_label').trim() || null,
    cta_url: get('cta_url').trim() || null,
    allow_followup_llm: get('allow_followup_llm').trim().toLowerCase() === 'yes',
    intent_implied: getOpt('intent_implied').trim() || null,
    triggers_lead_form: getOpt('triggers_lead_form').trim().toLowerCase() === 'yes',
    lead_form_copy_key,
    status,
  };
}

function bodyHash(row: CsvRow): string {
  const payload = `${row.scripted_reply_fr}|${row.scripted_reply_ar}|${row.scripted_reply_ar_ma}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export async function runChatCannedPairsSeed(opts: {
  csvPath?: string;
  actorId?: string;
} = {}): Promise<CannedPairSeedReport> {
  const csvPath = opts.csvPath ?? CSV_PATH;
  const actorId = opts.actorId ?? 'seed';
  const raw = await readFile(csvPath, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return { csvPath, parsed: 0, inserted: 0, updated: 0, versioned: 0, skipped: 0 };
  }
  const headers = rows[0]!.map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => toCsvRow(headers, r));

  const conn = db();
  if (!conn) {
    throw new Error(
      '[seed-chat-canned-pairs] DB non disponible (DATABASE_URL absent ?). ' +
        'Lancement attendu avec un Postgres réel — pas de fallback in-memory.',
    );
  }

  let inserted = 0;
  let updated = 0;
  let versioned = 0;
  let skipped = 0;

  for (const r of dataRows) {
    const hash = bodyHash(r);
    const existing = await conn.execute<{
      id: string;
      current_version_id: string | null;
    }>(sql`SELECT id, current_version_id FROM chat_canned_pair WHERE key = ${r.key} LIMIT 1`);
    const existingRow = Array.isArray(existing)
      ? (existing[0] as { id: string; current_version_id: string | null } | undefined)
      : (existing as { rows: { id: string; current_version_id: string | null }[] }).rows[0];

    if (!existingRow) {
      // INSERT
      const pairId = newId('cnp');
      await conn.execute(sql`
        INSERT INTO chat_canned_pair (
          id, key, page_pattern, audience, "order", enabled,
          label_fr, label_ar, label_ar_ma,
          scripted_reply_fr, scripted_reply_ar, scripted_reply_ar_ma,
          cta_label, cta_url, allow_followup_llm,
          triggers_lead_form, lead_form_copy_key,
          status, current_version_id, created_at, updated_at
        ) VALUES (
          ${pairId}, ${r.key}, ${r.page_pattern}, ${r.audience}, ${r.order}, true,
          ${r.label_fr}, ${r.label_ar}, ${r.label_ar_ma},
          ${r.scripted_reply_fr}, ${r.scripted_reply_ar}, ${r.scripted_reply_ar_ma},
          ${r.cta_label}, ${r.cta_url}, ${r.allow_followup_llm},
          ${r.triggers_lead_form}, ${r.lead_form_copy_key},
          ${r.status}, NULL, now(), now()
        )
      `);
      const versionId = newId('cnv');
      await conn.execute(sql`
        INSERT INTO chat_canned_pair_version (
          id, pair_id, body_fr, body_ar, body_ar_ma, body_hash, published_at, published_by
        ) VALUES (
          ${versionId}, ${pairId},
          ${r.scripted_reply_fr}, ${r.scripted_reply_ar}, ${r.scripted_reply_ar_ma},
          ${hash}, now(), ${actorId}
        )
      `);
      await conn.execute(sql`
        UPDATE chat_canned_pair SET current_version_id = ${versionId} WHERE id = ${pairId}
      `);
      inserted += 1;
      versioned += 1;
      continue;
    }

    // UPDATE in place (labels + CTA + order + page_pattern + audience +
    // CHA-310 conversion-focused fields).
    await conn.execute(sql`
      UPDATE chat_canned_pair SET
        page_pattern = ${r.page_pattern},
        audience = ${r.audience},
        "order" = ${r.order},
        label_fr = ${r.label_fr},
        label_ar = ${r.label_ar},
        label_ar_ma = ${r.label_ar_ma},
        cta_label = ${r.cta_label},
        cta_url = ${r.cta_url},
        allow_followup_llm = ${r.allow_followup_llm},
        triggers_lead_form = ${r.triggers_lead_form},
        lead_form_copy_key = ${r.lead_form_copy_key},
        status = ${r.status},
        scripted_reply_fr = ${r.scripted_reply_fr},
        scripted_reply_ar = ${r.scripted_reply_ar},
        scripted_reply_ar_ma = ${r.scripted_reply_ar_ma},
        updated_at = now()
      WHERE id = ${existingRow.id}
    `);

    // Si body_hash diffère → nouvelle version
    const lastVersion = await conn.execute<{ body_hash: string }>(sql`
      SELECT body_hash FROM chat_canned_pair_version
      WHERE pair_id = ${existingRow.id}
      ORDER BY published_at DESC LIMIT 1
    `);
    const lastHash = Array.isArray(lastVersion)
      ? (lastVersion[0] as { body_hash: string } | undefined)?.body_hash
      : (lastVersion as { rows: { body_hash: string }[] }).rows[0]?.body_hash;

    if (lastHash !== hash) {
      const versionId = newId('cnv');
      await conn.execute(sql`
        INSERT INTO chat_canned_pair_version (
          id, pair_id, body_fr, body_ar, body_ar_ma, body_hash, published_at, published_by
        ) VALUES (
          ${versionId}, ${existingRow.id},
          ${r.scripted_reply_fr}, ${r.scripted_reply_ar}, ${r.scripted_reply_ar_ma},
          ${hash}, now(), ${actorId}
        )
      `);
      await conn.execute(sql`
        UPDATE chat_canned_pair SET current_version_id = ${versionId} WHERE id = ${existingRow.id}
      `);
      versioned += 1;
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    csvPath,
    parsed: dataRows.length,
    inserted,
    updated,
    versioned,
    skipped,
  };
}

async function main(): Promise<void> {
  const report = await runChatCannedPairsSeed();
  console.log(
    `[seed-chat-canned-pairs] fixture: ${path.basename(report.csvPath)}`,
  );
  console.log(
    `[seed-chat-canned-pairs] parsed=${report.parsed} inserted=${report.inserted} ` +
      `updated=${report.updated} versioned=${report.versioned} skipped=${report.skipped}`,
  );
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[seed-chat-canned-pairs] erreur:', err);
    process.exit(1);
  });
}
