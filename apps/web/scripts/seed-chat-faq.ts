/**
 * Seed chat_faq_entry — alimente la table depuis le CSV V5/V6 + embeddings
 * OpenAI sur `question_canonical`.
 *
 * Idempotent : UPSERT par (`key`, `language`). Re-run = re-calcul des
 * embeddings (utile si on change le modèle d'embedding ou la question
 * canonique). Coût : ~17 questions × 50 tokens × ~$0.00002/1k tokens ≈ <$0.001.
 *
 * Pré-requis : un provider chat embedding doit être enabled (seeder
 * `chat-providers` exécuté + `OPENAI_API_KEY` en env). Sans embedding,
 * on saute la ligne (warning) — admin pourra re-run après config.
 *
 * Usages
 * ──────
 *   pnpm tsx scripts/seed-chat-faq.ts
 *
 * Appelé aussi depuis `lib/seeders/items/chat-faq.ts`.
 *
 * cf. docs/dossier-chat-v2/02-data/faq-entries-seed.csv
 *     docs/dossier-chat-v2/03-backend/intent-detection.md §FAQ-cascade
 */
import './_load-env.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '@/lib/logging/logger';

import {
  embedTexts,
  EmbeddingProviderUnavailableError,
} from '@/lib/chat/services/embeddings';
import { faqRepo } from '@/lib/chat/repos/faq';
import type { ChatLanguage } from '@/lib/chat/contracts';

const CSV_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  '..',
  'docs',
  'dossier-chat-v2',
  '02-data',
  'faq-entries-seed.csv',
);

export interface FaqSeedReport {
  csvPath: string;
  parsed: number;
  inserted: number;
  updated: number;
  skipped: number;
  embeddingModel: string | null;
}

interface CsvRow {
  key: string;
  language: ChatLanguage;
  question_canonical: string;
  scripted_reply: string;
  intent_hint: string | null;
  threshold: number;
  audience: 'all' | 'b2c' | 'b2b';
}

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
  const language = get('language') as ChatLanguage;
  if (language !== 'fr' && language !== 'ar' && language !== 'ar-MA') {
    throw new Error(`invalid language for key=${get('key')}: ${language}`);
  }
  const audience = get('audience') as CsvRow['audience'];
  if (audience !== 'all' && audience !== 'b2c' && audience !== 'b2b') {
    throw new Error(`invalid audience for key=${get('key')}: ${audience}`);
  }
  const threshold = Number.parseFloat(get('threshold'));
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(`invalid threshold for key=${get('key')}: ${get('threshold')}`);
  }
  return {
    key: get('key').trim(),
    language,
    question_canonical: get('question_canonical').trim(),
    scripted_reply: get('scripted_reply').trim(),
    intent_hint: get('intent_hint').trim() || null,
    threshold,
    audience,
  };
}

/**
 * Embed les questions par batches (limite OpenAI = 2048 inputs / req,
 * mais on reste prudent à 16 pour les tokens). Conserve l'ordre.
 */
async function embedQuestions(
  questions: string[],
  batchSize = 16,
): Promise<{ vectors: number[][]; model: string }> {
  const vectors: number[][] = [];
  let model = 'unknown';
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const result = await embedTexts(batch);
    model = result.model;
    vectors.push(...result.vectors);
  }
  return { vectors, model };
}

export async function runChatFaqSeed(
  opts: { csvPath?: string } = {},
): Promise<FaqSeedReport> {
  const csvPath = opts.csvPath ?? CSV_PATH;
  const raw = await readFile(csvPath, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return {
      csvPath,
      parsed: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      embeddingModel: null,
    };
  }
  const headers = rows[0]!.map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => toCsvRow(headers, r));

  // Tentative d'embedding. Si pas de provider, on log et on retourne 0
  // sans insérer (la table requiert `question_embedding NOT NULL`).
  let embeds: { vectors: number[][]; model: string };
  try {
    embeds = await embedQuestions(dataRows.map((r) => r.question_canonical));
  } catch (err) {
    if (err instanceof EmbeddingProviderUnavailableError) {
      logger.warn('seed.chat-faq.no-embedding-provider', {
        parsed: dataRows.length,
        hint: 'run seeder chat-providers with OPENAI_API_KEY first',
      });
      return {
        csvPath,
        parsed: dataRows.length,
        inserted: 0,
        updated: 0,
        skipped: dataRows.length,
        embeddingModel: null,
      };
    }
    throw err;
  }

  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < dataRows.length; i += 1) {
    const r = dataRows[i]!;
    const vector = embeds.vectors[i];
    if (!vector) throw new Error(`missing embedding for row ${i} (${r.key})`);
    const result = await faqRepo.upsertEntry({
      key: r.key,
      language: r.language,
      questionCanonical: r.question_canonical,
      questionEmbedding: vector,
      scriptedReply: r.scripted_reply,
      intentHint: r.intent_hint,
      threshold: r.threshold,
      audience: r.audience,
    });
    if (result.inserted) inserted += 1;
    if (result.updated) updated += 1;
  }

  return {
    csvPath,
    parsed: dataRows.length,
    inserted,
    updated,
    skipped: 0,
    embeddingModel: embeds.model,
  };
}

async function main(): Promise<void> {
  const report = await runChatFaqSeed();
  console.log(`[seed-chat-faq] fixture: ${path.basename(report.csvPath)}`);
  console.log(
    `[seed-chat-faq] parsed=${report.parsed} inserted=${report.inserted} ` +
      `updated=${report.updated} skipped=${report.skipped} ` +
      `model=${report.embeddingModel ?? 'n/a'}`,
  );
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main()
    // postgres-js garde le pool ouvert : on force la sortie après succès
    // sinon le process traîne 30s avant que Node ne timeout les handles.
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed-chat-faq] erreur:', err);
      process.exit(1);
    });
}
