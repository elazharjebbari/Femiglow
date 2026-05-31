/**
 * CHA-018 — Repository chat_conversation_event (append-only, source KPI).
 */
import { and, eq, gte, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import { chatConversationEvent, type ChatConversationEventRow } from '../db/schema';

type EventType = ChatConversationEventRow['type'];

export const eventRepo = {
  async append(
    sessionId: string,
    type: EventType,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const db = requireChatDb();
    await db.insert(chatConversationEvent).values({
      id: createId('cv'),
      sessionId,
      type,
      payload: payload ?? null,
    });
  },

  async listBySession(sessionId: string): Promise<ChatConversationEventRow[]> {
    const db = requireChatDb();
    return db
      .select()
      .from(chatConversationEvent)
      .where(eq(chatConversationEvent.sessionId, sessionId))
      .orderBy(chatConversationEvent.occurredAt);
  },

  async countByTypeSince(type: EventType, since: Date): Promise<number> {
    const db = requireChatDb();
    const res = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(chatConversationEvent)
      .where(
        and(
          eq(chatConversationEvent.type, type),
          gte(chatConversationEvent.occurredAt, since),
        ),
      );
    return res[0]?.n ?? 0;
  },

  /**
   * CHA-231 v7 — Existe-t-il déjà un event de ce type pour la session ?
   *
   * Cas d'usage canonique : décider si l'utilisateur a déjà soumis le
   * formulaire de capture (event `chat_lead_form_submit`). On distingue
   * ainsi un lead « auto-créé » (inline-contact, pas de submit explicite)
   * d'un lead « confirmé » (avec submit explicite).
   *
   * cf. orchestrator safety-net `llmPromisedForm`.
   */
  async hasEventOfType(sessionId: string, type: EventType): Promise<boolean> {
    const db = requireChatDb();
    const rows = await db
      .select({ id: chatConversationEvent.id })
      .from(chatConversationEvent)
      .where(
        and(
          eq(chatConversationEvent.sessionId, sessionId),
          eq(chatConversationEvent.type, type),
        ),
      )
      .limit(1);
    return rows.length > 0;
  },
};
