/**
 * CHA-003 — Type Drizzle custom pour la colonne `vector` (pgvector).
 *
 * pgvector expose le type SQL `vector(N)`. Drizzle n'a pas de mapping
 * natif → on en fournit un avec sérialisation manuelle.
 *
 * Format en base : `vector(1536)`. Le driver postgres reçoit le
 * vecteur sous forme de chaîne `'[0.1,0.2,...]'`.
 *
 * Référence : https://github.com/pgvector/pgvector#postgres
 */
import { customType } from 'drizzle-orm/pg-core';

interface VectorConfig {
  dimensions: number;
}

/**
 * Usage :
 * ```ts
 * vector: customVector('vector', { dimensions: 1536 }).notNull()
 * ```
 *
 * Helper d'index HNSW :
 * ```ts
 * hnswIdx: index('chat_ke_hnsw_idx').using('hnsw', t.vector.op('vector_cosine_ops'))
 * ```
 */
export const customVector = customType<{ data: number[]; driverData: string; config: VectorConfig }>({
  dataType(config) {
    if (!config?.dimensions || config.dimensions <= 0) {
      throw new Error('customVector requires a positive `dimensions` config');
    }
    return `vector(${config.dimensions})`;
  },
  toDriver(value: number[]): string {
    if (!Array.isArray(value)) {
      throw new TypeError('customVector expects a number[] value');
    }
    // pgvector format : '[v1,v2,...]'
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    if (typeof value !== 'string') {
      // Certains drivers retournent déjà un tableau parsé.
      return value as unknown as number[];
    }
    const trimmed = value.trim().replace(/^\[/, '').replace(/\]$/, '');
    if (trimmed.length === 0) return [];
    return trimmed.split(',').map((s) => Number.parseFloat(s));
  },
});
