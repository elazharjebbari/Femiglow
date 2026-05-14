/**
 * CHA-301 — Helper `embedTexts` partagé.
 *
 * Sélectionne le 1er provider `embedding` enabled (ordre `priority` asc)
 * et appelle son `embed()`. Sert :
 *   - RAG (`rag/service.ts`)
 *   - Cascade FAQ (`orchestrator.ts` L3)
 *   - Seeders FAQ + intents (génération initiale)
 *
 * Erreurs :
 *   - `EmbeddingProviderUnavailableError` si aucun provider `embedding`
 *     n'est enabled. Le caller doit gérer (ex. seeder FAQ skip embeddings,
 *     orchestrator fallback sur RAG+LLM).
 */
import { instantiateProvider } from '../providers/factory';
import { providerRepo } from '../repos/provider';

export class EmbeddingProviderUnavailableError extends Error {
  constructor() {
    super('no embedding provider enabled — seed chat-providers with OPENAI_API_KEY');
    this.name = 'EmbeddingProviderUnavailableError';
  }
}

export interface EmbedTextsResult {
  vectors: number[][];
  provider: string;
  model: string;
  dim: number;
}

export async function embedTexts(texts: string[]): Promise<EmbedTextsResult> {
  const list = await providerRepo.listByRole('embedding');
  const enabled = list.find((r) => r.enabled);
  if (!enabled) throw new EmbeddingProviderUnavailableError();
  const config = providerRepo.decode(enabled);
  const adapter = instantiateProvider(config);
  if (!adapter.embed) {
    throw new Error(`provider ${config.kind} does not support embed`);
  }
  const result = await adapter.embed({ inputs: texts });
  return {
    vectors: result.vectors,
    provider: config.kind,
    model: result.modelName ?? config.embeddingModel ?? 'unknown',
    dim: result.vectors[0]?.length ?? 0,
  };
}

/**
 * Calcule la moyenne L2-normalisée d'un set de vecteurs.
 *
 * Pour stocker un *centroid* d'intent : on agrège les embeddings de tous
 * les exemples annotés. La normalisation L2 force la magnitude à 1, ce
 * qui rend la distance cosine (`<=>` en pgvector) équivalente à un
 * produit scalaire et stabilise les comparaisons entre centroids
 * calculés sur des nombres d'exemples différents.
 */
export function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) throw new Error('cannot average empty vector set');
  const dim = vectors[0]!.length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) {
      throw new Error(`vector dim mismatch: expected ${dim}, got ${v.length}`);
    }
    for (let i = 0; i < dim; i += 1) sum[i]! += v[i]!;
  }
  for (let i = 0; i < dim; i += 1) sum[i]! /= vectors.length;
  return l2Normalize(sum);
}

export function l2Normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  const norm = Math.sqrt(n);
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}
