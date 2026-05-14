/**
 * CHA-307 — Recompute des centroïdes d'intent à partir de la table
 * `chat_intent_example`.
 *
 * Pourquoi un cron en plus du seeder
 * ──────────────────────────────────
 * Le seeder `scripts/seed-chat-intents.ts` peuple le dataset initial mais
 * une fois en prod, l'admin peut ajouter de nouveaux exemples annotés
 * (via UI ou import CSV). Ces nouveaux exemples n'impactent la cascade
 * vectorielle que si on rebuild les centroïdes — sinon le centroid reste
 * à la moyenne des exemples initiaux et la classification ne s'améliore
 * jamais.
 *
 * Algorithme
 * ──────────
 *  1. Liste tous les `chat_intent_example` actifs (`deleted_at IS NULL`).
 *  2. Embed chaque texte via `embedTexts` (batch=16) — utilise le 1er
 *     provider embedding actif.
 *  3. Group par `intent` (toutes langues confondues — l'embedding OpenAI
 *     est multilingue).
 *  4. UPSERT du centroïde via `intentCentroidRepo.upsert` avec
 *     `language='all'` et `sampleCount` = nombre d'exemples agrégés.
 *
 * Retourne un rapport pour les logs et les tests.
 *
 * Idempotent : ré-exécuter au cours d'une même heure produit le même
 * vecteur (à l'arrondi flottant près). Pas de protection contre les
 * doubles runs concurrents — la race condition est tolérable (le dernier
 * UPSERT gagne, et les vecteurs convergent).
 */
import { logger } from '@/lib/logging/logger';

import { intentCentroidRepo, intentExampleRepo } from '../repos/intent';
import {
  embedTexts,
  EmbeddingProviderUnavailableError,
  meanVector,
} from './embeddings';

export interface IntentRecomputeReport {
  examplesScanned: number;
  intentsTouched: number;
  centroidsInserted: number;
  centroidsUpdated: number;
  embeddingModel: string | null;
  skipped: 'no-provider' | 'no-examples' | null;
}

export async function recomputeAllCentroids(): Promise<IntentRecomputeReport> {
  const examples = await intentExampleRepo.listActive({});
  if (examples.length === 0) {
    return {
      examplesScanned: 0,
      intentsTouched: 0,
      centroidsInserted: 0,
      centroidsUpdated: 0,
      embeddingModel: null,
      skipped: 'no-examples',
    };
  }

  let vectors: number[][];
  let embeddingModel: string;
  try {
    const result = await embedAll(examples.map((e) => e.text));
    vectors = result.vectors;
    embeddingModel = result.model;
  } catch (err) {
    if (err instanceof EmbeddingProviderUnavailableError) {
      logger.warn('chat.cron.intent_recompute.no_provider', {
        examplesScanned: examples.length,
      });
      return {
        examplesScanned: examples.length,
        intentsTouched: 0,
        centroidsInserted: 0,
        centroidsUpdated: 0,
        embeddingModel: null,
        skipped: 'no-provider',
      };
    }
    throw err;
  }

  // Group par intent (langue='all' multilingue)
  const byIntent = new Map<string, number[][]>();
  for (let i = 0; i < examples.length; i += 1) {
    const intent = examples[i]!.intent;
    const vector = vectors[i]!;
    const bucket = byIntent.get(intent) ?? [];
    bucket.push(vector);
    byIntent.set(intent, bucket);
  }

  let centroidsInserted = 0;
  let centroidsUpdated = 0;
  for (const [intent, vecs] of byIntent.entries()) {
    const centroid = meanVector(vecs);
    const result = await intentCentroidRepo.upsert({
      intent,
      language: 'all',
      vector: centroid,
      sampleCount: vecs.length,
    });
    if (result.inserted) centroidsInserted += 1;
    if (result.updated) centroidsUpdated += 1;
  }

  return {
    examplesScanned: examples.length,
    intentsTouched: byIntent.size,
    centroidsInserted,
    centroidsUpdated,
    embeddingModel,
    skipped: null,
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
