/**
 * Seed chat_intent_example + chat_intent_centroid — alimente les deux
 * tables depuis le dataset annoté V5/V6 + embeddings OpenAI.
 *
 * Algorithme :
 *   1. Parse `intent-dataset-sample.csv` (50 lignes).
 *   2. Pré-nettoie : DELETE FROM chat_intent_example WHERE added_by='seed'.
 *      Permet de re-seed sans accumuler les doublons.
 *   3. Embedd chaque exemple via OpenAI text-embedding-3-small (1536-d).
 *   4. INSERT bulk les exemples (avec leur language native).
 *   5. Group by intent → moyenne L2-normalisée des vecteurs → UPSERT
 *      centroid (language='all', multilingue puisque l'embedding l'est).
 *
 * Pré-requis : provider embedding enabled. Sinon log + skip.
 *
 * Usages
 * ──────
 *   pnpm tsx scripts/seed-chat-intents.ts
 *
 * cf. docs/dossier-chat-v2/02-data/intent-dataset-sample.csv
 *     docs/dossier-chat-v2/02-data/intent-taxonomy.csv
 */
import './_load-env.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '@/lib/logging/logger';

import {
  embedTexts,
  EmbeddingProviderUnavailableError,
  meanVector,
} from '@/lib/chat/services/embeddings';
import {
  intentCentroidRepo,
  intentExampleRepo,
} from '@/lib/chat/repos/intent';
import type { ChatLanguage } from '@/lib/chat/contracts';

const CSV_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  '..',
  'docs',
  'dossier-chat-v2',
  '02-data',
  'intent-dataset-sample.csv',
);

export interface IntentsSeedReport {
  csvPath: string;
  parsedExamples: number;
  deletedExamples: number;
  insertedExamples: number;
  centroidsInserted: number;
  centroidsUpdated: number;
  embeddingModel: string | null;
}

interface CsvRow {
  id: string;
  text: string;
  language: ChatLanguage;
  intent_label: string;
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
    throw new Error(`invalid language for id=${get('id')}: ${language}`);
  }
  return {
    id: get('id').trim(),
    text: get('text').trim(),
    language,
    intent_label: get('intent_label').trim(),
  };
}

async function embedAll(
  texts: string[],
  batchSize = 16,
): Promise<{ vectors: number[][]; model: string }> {
  const vectors: number[][] = [];
  let model = 'unknown';
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const result = await embedTexts(batch);
    model = result.model;
    vectors.push(...result.vectors);
  }
  return { vectors, model };
}

export async function runChatIntentsSeed(
  opts: { csvPath?: string; actorId?: string } = {},
): Promise<IntentsSeedReport> {
  const csvPath = opts.csvPath ?? CSV_PATH;
  const actorId = opts.actorId ?? 'seed';
  const raw = await readFile(csvPath, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return {
      csvPath,
      parsedExamples: 0,
      deletedExamples: 0,
      insertedExamples: 0,
      centroidsInserted: 0,
      centroidsUpdated: 0,
      embeddingModel: null,
    };
  }
  const headers = rows[0]!.map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => toCsvRow(headers, r));

  // Embed avant de toucher la DB. Si pas de provider, on skip propre
  // (sans wipe la table existante — re-run sera safe).
  let embeds: { vectors: number[][]; model: string };
  try {
    embeds = await embedAll(dataRows.map((r) => r.text));
  } catch (err) {
    if (err instanceof EmbeddingProviderUnavailableError) {
      logger.warn('seed.chat-intents.no-embedding-provider', {
        parsed: dataRows.length,
        hint: 'run seeder chat-providers with OPENAI_API_KEY first',
      });
      return {
        csvPath,
        parsedExamples: dataRows.length,
        deletedExamples: 0,
        insertedExamples: 0,
        centroidsInserted: 0,
        centroidsUpdated: 0,
        embeddingModel: null,
      };
    }
    throw err;
  }

  // Clean les anciennes entrées 'seed' (re-run idempotent)
  const deletedExamples = await intentExampleRepo.deleteBySeed(actorId);

  // INSERT examples
  let insertedExamples = 0;
  for (const r of dataRows) {
    await intentExampleRepo.create({
      intent: r.intent_label,
      language: r.language,
      text: r.text,
      addedBy: actorId,
    });
    insertedExamples += 1;
  }

  // Group by intent → centroid moyen (langue 'all', multilingue)
  const byIntent = new Map<string, number[][]>();
  for (let i = 0; i < dataRows.length; i += 1) {
    const intent = dataRows[i]!.intent_label;
    const vector = embeds.vectors[i]!;
    const bucket = byIntent.get(intent) ?? [];
    bucket.push(vector);
    byIntent.set(intent, bucket);
  }

  let centroidsInserted = 0;
  let centroidsUpdated = 0;
  for (const [intent, vectors] of byIntent.entries()) {
    const centroid = meanVector(vectors);
    const result = await intentCentroidRepo.upsert({
      intent,
      language: 'all',
      vector: centroid,
      sampleCount: vectors.length,
    });
    if (result.inserted) centroidsInserted += 1;
    if (result.updated) centroidsUpdated += 1;
  }

  return {
    csvPath,
    parsedExamples: dataRows.length,
    deletedExamples,
    insertedExamples,
    centroidsInserted,
    centroidsUpdated,
    embeddingModel: embeds.model,
  };
}

async function main(): Promise<void> {
  const report = await runChatIntentsSeed();
  console.log(`[seed-chat-intents] fixture: ${path.basename(report.csvPath)}`);
  console.log(
    `[seed-chat-intents] parsed=${report.parsedExamples} ` +
      `deleted=${report.deletedExamples} ` +
      `inserted=${report.insertedExamples} ` +
      `centroids: ${report.centroidsInserted} new + ${report.centroidsUpdated} updated ` +
      `· model=${report.embeddingModel ?? 'n/a'}`,
  );
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed-chat-intents] erreur:', err);
      process.exit(1);
    });
}
