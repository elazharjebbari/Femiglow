/**
 * CHA-230 Phase 3 — Repository `chat_golden_intent_set`.
 *
 * Le golden-set est un jeu de référence curé manuellement par
 * l'admin pour la régression CI de la classification d'intent.
 *
 * Pattern simple : insert / list / read / delete. Pas d'update : si
 * l'intent attendu change, on supprime + ré-insère (audit clair).
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.5
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import {
  chatGoldenIntentSet,
  type ChatGoldenIntentInsert,
  type ChatGoldenIntentRow,
} from '../db/schema';

export interface AddGoldenInput {
  text: string;
  language: ChatGoldenIntentRow['language'];
  expectedIntent: string;
  curatorEmail: string;
  sourceMessageId?: string | null;
  sourceSessionId?: string | null;
  notes?: string | null;
}

export interface ListGoldenQuery {
  intent?: string;
  language?: ChatGoldenIntentRow['language'];
  limit?: number;
}

export const goldenIntentRepo = {
  /** Crée une entrée golden. Génère l'id `cg_xxxxxxxx`. */
  async add(input: AddGoldenInput): Promise<ChatGoldenIntentRow> {
    const db = requireChatDb();
    const id = createId('cg');
    const insert: ChatGoldenIntentInsert = {
      id,
      text: input.text,
      language: input.language,
      expectedIntent: input.expectedIntent,
      curatorEmail: input.curatorEmail,
      sourceMessageId: input.sourceMessageId ?? null,
      sourceSessionId: input.sourceSessionId ?? null,
      notes: input.notes ?? null,
    };
    const [row] = await db.insert(chatGoldenIntentSet).values(insert).returning();
    if (!row) throw new Error('golden insert returned no row');
    return row;
  },

  /** Liste paginée (max 500 par défaut) avec filtres optionnels. */
  async list(query: ListGoldenQuery = {}): Promise<ChatGoldenIntentRow[]> {
    const db = requireChatDb();
    const where = and(
      query.intent ? eq(chatGoldenIntentSet.expectedIntent, query.intent) : undefined,
      query.language ? eq(chatGoldenIntentSet.language, query.language) : undefined,
    );
    return db
      .select()
      .from(chatGoldenIntentSet)
      .where(where)
      .orderBy(desc(chatGoldenIntentSet.createdAt))
      .limit(query.limit ?? 500);
  },

  /**
   * Liste TOUTES les entrées (pour l'export script — pas de pagination).
   * Trié par language puis intent pour rendre le diff fixture lisible.
   */
  async listAllForExport(): Promise<ChatGoldenIntentRow[]> {
    const db = requireChatDb();
    return db
      .select()
      .from(chatGoldenIntentSet)
      .orderBy(
        chatGoldenIntentSet.language,
        chatGoldenIntentSet.expectedIntent,
        chatGoldenIntentSet.createdAt,
      );
  },

  /** Compte par intent — pour le quality dashboard. */
  async countByIntent(): Promise<Array<{ intent: string; count: number }>> {
    const db = requireChatDb();
    const rows = await db
      .select({
        intent: chatGoldenIntentSet.expectedIntent,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(chatGoldenIntentSet)
      .groupBy(chatGoldenIntentSet.expectedIntent)
      .orderBy(desc(sql`COUNT(*)`));
    return rows;
  },

  /** Lit une entrée par id. `null` si introuvable. */
  async getById(id: string): Promise<ChatGoldenIntentRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatGoldenIntentSet)
      .where(eq(chatGoldenIntentSet.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  /** Supprime une entrée golden. */
  async delete(id: string): Promise<void> {
    const db = requireChatDb();
    await db.delete(chatGoldenIntentSet).where(eq(chatGoldenIntentSet.id, id));
  },

  /**
   * Trouve si un message a déjà été tagué — utile pour l'idempotence du
   * curator UI (pas de doublon si l'admin clique deux fois).
   */
  async existsForMessage(messageId: string): Promise<boolean> {
    const db = requireChatDb();
    const rows = await db
      .select({ id: chatGoldenIntentSet.id })
      .from(chatGoldenIntentSet)
      .where(eq(chatGoldenIntentSet.sourceMessageId, messageId))
      .limit(1);
    return rows.length > 0;
  },

  /**
   * Variante batch : retourne le set des messageIds déjà tagués parmi
   * un lot de candidats — utilisé par la page curator pour annoter
   * les lignes en une seule requête plutôt que N + 1.
   */
  async existsForMessages(messageIds: string[]): Promise<Set<string>> {
    if (messageIds.length === 0) return new Set();
    const db = requireChatDb();
    const rows = await db
      .select({ sourceMessageId: chatGoldenIntentSet.sourceMessageId })
      .from(chatGoldenIntentSet)
      .where(inArray(chatGoldenIntentSet.sourceMessageId, messageIds));
    const out = new Set<string>();
    for (const r of rows) {
      if (r.sourceMessageId) out.add(r.sourceMessageId);
    }
    return out;
  },
};
