/**
 * CHA-301 — Repositories chat_intent_example + chat_intent_centroid.
 *
 * Cascade L1 : on embed la question utilisateur et on cherche le
 * centroid le plus proche (distance cosine `<=>`). Si le score >= seuil
 * configurable (default 0.78), on adopte l'intent prédit comme
 * `intentTag` côté orchestrator — sinon on retombe sur le classifieur
 * pattern-based existant (`services/intent.ts`).
 *
 * Le dataset d'exemples annoté (cf. `intent-dataset-sample.csv`) sert
 * de "training data" — chaque embedding est moyenné par intent pour
 * produire le centroid. Pas de ML : juste une moyenne L2-normalisée.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';

import { rowsOf } from '@/lib/db/exec';
import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import {
  chatIntentCentroid,
  chatIntentExample,
  type ChatIntentCentroidRow,
  type ChatIntentExampleRow,
} from '../db/schema';
import type { ChatLanguage } from '../contracts';

export type IntentLanguage = 'all' | ChatLanguage;

export interface IntentMatch {
  intent: string;
  language: IntentLanguage;
  score: number;
  sampleCount: number;
}

export const intentExampleRepo = {
  /**
   * Crée une nouvelle entrée d'exemple. Pas de dédoublonnage automatique
   * (le seeder pré-nettoie la table). Soft-delete via `deleted_at`.
   */
  async create(input: {
    intent: string;
    language: ChatLanguage;
    text: string;
    addedBy: string;
  }): Promise<ChatIntentExampleRow> {
    const db = requireChatDb();
    const id = createId('ie');
    const rows = await db
      .insert(chatIntentExample)
      .values({
        id,
        intent: input.intent,
        language: input.language,
        text: input.text,
        addedBy: input.addedBy,
      })
      .returning();
    return rows[0]!;
  },

  async deleteBySeed(actorId = 'seed'): Promise<number> {
    const db = requireChatDb();
    const rows = await db
      .delete(chatIntentExample)
      .where(eq(chatIntentExample.addedBy, actorId))
      .returning();
    return rows.length;
  },

  async listActive(opts: {
    intent?: string;
    language?: ChatLanguage;
  } = {}): Promise<ChatIntentExampleRow[]> {
    const db = requireChatDb();
    const conditions = [isNull(chatIntentExample.deletedAt)];
    if (opts.intent) conditions.push(eq(chatIntentExample.intent, opts.intent));
    if (opts.language) conditions.push(eq(chatIntentExample.language, opts.language));
    return db
      .select()
      .from(chatIntentExample)
      .where(and(...conditions));
  },
};

export const intentCentroidRepo = {
  /**
   * UPSERT par (intent, language). On stocke aussi `sampleCount` —
   * permet à l'admin de voir combien d'exemples ont nourri le centroid
   * (un centroid à 2 exemples est moins fiable qu'à 30).
   */
  async upsert(input: {
    intent: string;
    language: IntentLanguage;
    vector: number[];
    sampleCount: number;
  }): Promise<{ inserted: boolean; updated: boolean; id: string }> {
    const db = requireChatDb();
    const existing = await db
      .select({ id: chatIntentCentroid.id })
      .from(chatIntentCentroid)
      .where(
        and(
          eq(chatIntentCentroid.intent, input.intent),
          eq(chatIntentCentroid.language, input.language),
        ),
      )
      .limit(1);
    const vectorLiteral = `[${input.vector.join(',')}]`;
    if (existing[0]) {
      await db.execute(sql`
        UPDATE chat_intent_centroid SET
          vector = ${vectorLiteral}::vector,
          sample_count = ${input.sampleCount},
          updated_at = now()
        WHERE id = ${existing[0].id}
      `);
      return { inserted: false, updated: true, id: existing[0].id };
    }
    const id = createId('ic');
    await db.execute(sql`
      INSERT INTO chat_intent_centroid (
        id, intent, language, vector, sample_count, updated_at
      ) VALUES (
        ${id}, ${input.intent}, ${input.language},
        ${vectorLiteral}::vector, ${input.sampleCount}, now()
      )
    `);
    return { inserted: true, updated: false, id };
  },

  /**
   * Cherche les centroids les plus proches d'un embedding question.
   * Limite par défaut à 3 candidates. Filtre par langue avec fallback
   * sur `language='all'` (centroid multilingue).
   */
  async match(
    vector: number[],
    opts: { language?: ChatLanguage; limit?: number } = {},
  ): Promise<IntentMatch[]> {
    const db = requireChatDb();
    const limit = opts.limit ?? 3;
    // Si on demande une langue précise, on accepte aussi 'all'.
    // Sinon on cherche dans tous les centroids.
    const langFilter = opts.language
      ? sql`AND language IN ('all', ${opts.language})`
      : sql``;
    const vectorLiteral = `[${vector.join(',')}]`;
    const rows = await db.execute<{
      intent: string;
      language: IntentLanguage;
      score: number;
      sample_count: number;
    }>(sql`
      SELECT
        intent,
        language,
        sample_count,
        1 - (vector <=> ${vectorLiteral}::vector) AS score
      FROM chat_intent_centroid
      WHERE TRUE
      ${langFilter}
      ORDER BY vector <=> ${vectorLiteral}::vector ASC
      LIMIT ${limit}
    `);
    return rowsOf(rows).map((r) => ({
      intent: r.intent,
      language: r.language,
      score: Number(r.score),
      sampleCount: Number(r.sample_count),
    }));
  },

  async listAll(): Promise<ChatIntentCentroidRow[]> {
    const db = requireChatDb();
    return db.select().from(chatIntentCentroid);
  },
};
