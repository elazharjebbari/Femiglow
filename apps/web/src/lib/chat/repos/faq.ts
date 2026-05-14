/**
 * CHA-301 — Repository chat_faq_entry.
 *
 * Cascade L3 : si aucun intent vectoriel ni canned-pair ne matche, on
 * cherche une FAQ entry par similarité cosine sur `question_embedding`.
 * Chaque entry porte son propre `threshold` (typique 0.82–0.86) — un
 * match sous le seuil retombe sur RAG+LLM.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { rowsOf } from '@/lib/db/exec';
import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import {
  chatFaqEntry,
  type ChatFaqEntryInsert,
  type ChatFaqEntryRow,
} from '../db/schema';
import type { ChatLanguage } from '../contracts';

export interface FaqMatch {
  id: string;
  key: string;
  language: ChatLanguage;
  questionCanonical: string;
  scriptedReply: string;
  intentHint: string | null;
  threshold: number;
  score: number;
}

export const faqRepo = {
  /**
   * Recherche le meilleur match FAQ pour un embedding question donné.
   *
   * - Filtre par `enabled = true`, langue, audience (avec 'all' inclus).
   * - Tri par distance cosine ascendante (= score descendant).
   * - Garde uniquement le top-1 et applique le `threshold` ligne par ligne :
   *   un match n'est valide que si `score >= threshold` propre à l'entrée.
   *
   * Retourne `null` si aucun match au-dessus du seuil — caller fallback
   * sur RAG+LLM.
   */
  async matchByEmbedding(
    vector: number[],
    opts: {
      language: ChatLanguage;
      audience?: 'all' | 'b2c' | 'b2b';
      limit?: number;
    },
  ): Promise<FaqMatch | null> {
    const db = requireChatDb();
    const limit = opts.limit ?? 3;
    const audiences: ('all' | 'b2c' | 'b2b')[] =
      opts.audience && opts.audience !== 'all'
        ? ['all', opts.audience]
        : ['all'];
    const audienceLiteral = audiences.map((a) => `'${a}'`).join(',');
    const vectorLiteral = `[${vector.join(',')}]`;
    const rows = await db.execute<{
      id: string;
      key: string;
      language: ChatLanguage;
      question_canonical: string;
      scripted_reply: string;
      intent_hint: string | null;
      threshold: string;
      score: number;
    }>(sql`
      SELECT
        id, key, language, question_canonical, scripted_reply,
        intent_hint, threshold,
        1 - (question_embedding <=> ${vectorLiteral}::vector) AS score
      FROM chat_faq_entry
      WHERE enabled = true
        AND language = ${opts.language}
        AND audience IN (${sql.raw(audienceLiteral)})
      ORDER BY question_embedding <=> ${vectorLiteral}::vector ASC
      LIMIT ${limit}
    `);
    const list = rowsOf(rows);
    for (const r of list) {
      const score = Number(r.score);
      const threshold = Number(r.threshold);
      if (score >= threshold) {
        return {
          id: r.id,
          key: r.key,
          language: r.language,
          questionCanonical: r.question_canonical,
          scriptedReply: r.scripted_reply,
          intentHint: r.intent_hint,
          threshold,
          score,
        };
      }
    }
    return null;
  },

  /**
   * UPSERT par (key, language). Si l'entrée existe, on met à jour
   * `question_canonical`, `scripted_reply`, `embedding`, `threshold`,
   * `intent_hint`, `audience`, `updated_at`.
   *
   * Retourne `{ inserted: true }` ou `{ updated: true }`.
   */
  async upsertEntry(input: {
    key: string;
    language: ChatLanguage;
    questionCanonical: string;
    questionEmbedding: number[];
    scriptedReply: string;
    intentHint: string | null;
    threshold: number;
    audience: 'all' | 'b2c' | 'b2b';
  }): Promise<{ inserted: boolean; updated: boolean; id: string }> {
    const db = requireChatDb();
    const existing = await db
      .select({ id: chatFaqEntry.id })
      .from(chatFaqEntry)
      .where(
        and(
          eq(chatFaqEntry.key, input.key),
          eq(chatFaqEntry.language, input.language),
        ),
      )
      .limit(1);
    const vectorLiteral = `[${input.questionEmbedding.join(',')}]`;
    if (existing[0]) {
      await db.execute(sql`
        UPDATE chat_faq_entry SET
          question_canonical = ${input.questionCanonical},
          question_embedding = ${vectorLiteral}::vector,
          scripted_reply = ${input.scriptedReply},
          intent_hint = ${input.intentHint},
          threshold = ${input.threshold.toString()},
          audience = ${input.audience},
          enabled = true,
          updated_at = now()
        WHERE id = ${existing[0].id}
      `);
      return { inserted: false, updated: true, id: existing[0].id };
    }
    const id = createId('fq');
    await db.execute(sql`
      INSERT INTO chat_faq_entry (
        id, key, language, question_canonical, question_embedding,
        scripted_reply, intent_hint, threshold, audience, enabled,
        created_at, updated_at
      ) VALUES (
        ${id}, ${input.key}, ${input.language}, ${input.questionCanonical},
        ${vectorLiteral}::vector,
        ${input.scriptedReply}, ${input.intentHint},
        ${input.threshold.toString()}, ${input.audience}, true,
        now(), now()
      )
    `);
    return { inserted: true, updated: false, id };
  },

  async listAll(): Promise<ChatFaqEntryRow[]> {
    const db = requireChatDb();
    return db
      .select()
      .from(chatFaqEntry)
      .orderBy(desc(chatFaqEntry.updatedAt));
  },

  async getById(id: string): Promise<ChatFaqEntryRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatFaqEntry)
      .where(eq(chatFaqEntry.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  /**
   * Patch partiel d'une entrée par id. Le `questionEmbedding` doit être
   * fourni si `questionCanonical` change (le caller ré-embed avant
   * d'appeler). Tout autre champ est optionnel.
   */
  async update(
    id: string,
    patch: {
      key?: string;
      language?: ChatLanguage;
      questionCanonical?: string;
      questionEmbedding?: number[];
      scriptedReply?: string;
      intentHint?: string | null;
      threshold?: number;
      audience?: 'all' | 'b2c' | 'b2b';
      enabled?: boolean;
    },
  ): Promise<ChatFaqEntryRow | null> {
    const db = requireChatDb();
    const sets: ReturnType<typeof sql>[] = [];
    if (patch.key !== undefined) sets.push(sql`key = ${patch.key}`);
    if (patch.language !== undefined) sets.push(sql`language = ${patch.language}`);
    if (patch.questionCanonical !== undefined) {
      sets.push(sql`question_canonical = ${patch.questionCanonical}`);
    }
    if (patch.questionEmbedding !== undefined) {
      const lit = `[${patch.questionEmbedding.join(',')}]`;
      sets.push(sql`question_embedding = ${lit}::vector`);
    }
    if (patch.scriptedReply !== undefined) {
      sets.push(sql`scripted_reply = ${patch.scriptedReply}`);
    }
    if (patch.intentHint !== undefined) {
      sets.push(sql`intent_hint = ${patch.intentHint}`);
    }
    if (patch.threshold !== undefined) {
      sets.push(sql`threshold = ${patch.threshold.toString()}`);
    }
    if (patch.audience !== undefined) sets.push(sql`audience = ${patch.audience}`);
    if (patch.enabled !== undefined) sets.push(sql`enabled = ${patch.enabled}`);
    if (sets.length === 0) return this.getById(id);
    sets.push(sql`updated_at = now()`);
    await db.execute(sql`
      UPDATE chat_faq_entry SET ${sql.join(sets, sql`, `)}
      WHERE id = ${id}
    `);
    return this.getById(id);
  },

  async deleteById(id: string): Promise<boolean> {
    const db = requireChatDb();
    const rows = await db
      .delete(chatFaqEntry)
      .where(eq(chatFaqEntry.id, id))
      .returning();
    return rows.length > 0;
  },

  async deleteByKey(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const db = requireChatDb();
    await db.delete(chatFaqEntry).where(inArray(chatFaqEntry.key, keys));
  },

  toInsert(row: ChatFaqEntryRow): ChatFaqEntryInsert {
    return row;
  },
};
