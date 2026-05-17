/**
 * CHA-201 — Repository chat_lead.
 *
 * Capture in-chat de contact (prénom + téléphone). Toutes les écritures
 * passent par ce repo pour garantir l'invariant : un lead est toujours
 * lié à une session et à un visiteur.
 *
 * Cycle de vie :
 *  1. `create` → `webhookStatus='pending'`, `outcome='pending'`.
 *  2. `markWebhookSent` / `markWebhookFailed` → côté service webhook.
 *  3. `setOutcome` → côté admin (CRM/back-office).
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §5.3
 */
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import { chatLead, type ChatLeadInsert, type ChatLeadRow } from '../db/schema';

type Outcome = ChatLeadRow['outcome'];
type WebhookStatus = ChatLeadRow['webhookStatus'];
type TriggerReason = ChatLeadRow['triggerReason'];

export interface ListForAdminQuery {
  outcome?: Outcome;
  webhookStatus?: WebhookStatus;
  triggerReason?: TriggerReason;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  cursor?: string; // id du dernier élément renvoyé
}

export const leadRepo = {
  /**
   * Insère un nouveau lead. Si un lead existe déjà pour la même session,
   * retourne le lead existant sans créer de doublon (upsert atomique).
   * Garantit l'unicité par session_id grâce à l'index UNIQUE.
   */
  async create(insert: Omit<ChatLeadInsert, 'id'> & { id?: string }): Promise<ChatLeadRow> {
    const db = requireChatDb();
    const id = insert.id ?? createId('cl');
    const rows = await db
      .insert(chatLead)
      .values({ ...insert, id })
      .onConflictDoNothing({ target: chatLead.sessionId })
      .returning();
    if (rows.length > 0) return rows[0]!;
    // Conflict: a lead already exists for this session. Fetch it.
    const existing = await leadRepo.findBySession(insert.sessionId);
    return existing!;
  },

  async getById(id: string): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const rows = await db.select().from(chatLead).where(eq(chatLead.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async listBySession(sessionId: string): Promise<ChatLeadRow[]> {
    const db = requireChatDb();
    return db
      .select()
      .from(chatLead)
      .where(eq(chatLead.sessionId, sessionId))
      .orderBy(desc(chatLead.createdAt));
  },

  async hasLeadForSession(sessionId: string): Promise<boolean> {
    const db = requireChatDb();
    const rows = await db
      .select({ id: chatLead.id })
      .from(chatLead)
      .where(eq(chatLead.sessionId, sessionId))
      .limit(1);
    return rows.length > 0;
  },

  /**
   * CHA-225 — Récupère le lead existant pour une session s'il existe.
   * Utilisé par la route form pour décider si on remplace un fallback
   * `inline-contact` par une soumission formelle (consent + validation).
   */
  async findBySession(sessionId: string): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatLead)
      .where(eq(chatLead.sessionId, sessionId))
      .orderBy(desc(chatLead.createdAt))
      .limit(1);
    return rows[0] ?? null;
  },

  /**
   * CHA-225 — Met à jour les champs "humains" d'un lead existant.
   * Utilisé pour formaliser un lead `inline-contact` (auto-créé) avec
   * les valeurs propres saisies dans le widget. On NE touche PAS aux
   * champs immutables (sessionId, visitorId, createdAt, fingerprint).
   */
  async upgrade(
    id: string,
    patch: {
      firstName: string;
      phoneE164: string;
      phoneRaw: string;
      consentVersion: string;
      triggerReason: TriggerReason;
      triggeringMessageId?: string | null;
      note?: string | null;
      language: string;
      intentAtCapture?: string | null;
      snapshotMessages?: ChatLeadRow['snapshotMessages'];
    },
  ): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const rows = await db
      .update(chatLead)
      .set({
        firstName: patch.firstName,
        phoneE164: patch.phoneE164,
        phoneRaw: patch.phoneRaw,
        consentVersion: patch.consentVersion,
        consentAt: new Date(),
        triggerReason: patch.triggerReason,
        triggeringMessageId: patch.triggeringMessageId ?? null,
        note: patch.note ?? null,
        language: patch.language,
        intentAtCapture: patch.intentAtCapture ?? null,
        snapshotMessages: patch.snapshotMessages ?? null,
        // Réinitialise le webhook : la donnée a changé, il faut renvoyer.
        webhookStatus: 'pending',
        webhookAttempts: 0,
        webhookLastError: null,
        webhookSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(chatLead.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Marque le webhook comme envoyé. */
  async markWebhookSent(id: string): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatLead)
      .set({
        webhookStatus: 'sent',
        webhookSentAt: new Date(),
        webhookLastError: null,
        updatedAt: new Date(),
      })
      .where(eq(chatLead.id, id));
  },

  /** Incrémente le compteur d'échecs et stocke le dernier message d'erreur. */
  async markWebhookFailed(id: string, error: string): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatLead)
      .set({
        webhookStatus: 'failed',
        webhookAttempts: sql`${chatLead.webhookAttempts} + 1`,
        webhookLastError: error.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(chatLead.id, id));
  },

  /** Met à jour l'outcome côté CRM (admin). */
  async setOutcome(
    id: string,
    outcome: Outcome,
    handledBy: string,
    convertedOrderId?: string,
  ): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const rows = await db
      .update(chatLead)
      .set({
        outcome,
        handledBy,
        handledAt: new Date(),
        convertedOrderId: convertedOrderId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(chatLead.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Liste paginée pour la console admin. */
  async listForAdmin(query: ListForAdminQuery = {}): Promise<ChatLeadRow[]> {
    const db = requireChatDb();
    const limit = query.limit ?? 50;
    const conditions = [] as ReturnType<typeof eq>[];
    if (query.outcome) conditions.push(eq(chatLead.outcome, query.outcome));
    if (query.webhookStatus) conditions.push(eq(chatLead.webhookStatus, query.webhookStatus));
    if (query.triggerReason) conditions.push(eq(chatLead.triggerReason, query.triggerReason));
    if (query.fromDate) conditions.push(gte(chatLead.createdAt, query.fromDate));
    if (query.toDate) conditions.push(lte(chatLead.createdAt, query.toDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(chatLead)
      .where(where ?? sql`true`)
      .orderBy(desc(chatLead.createdAt))
      .limit(limit);
    return rows;
  },

  /** Comptage par outcome sur une fenêtre — KPI dashboard admin. */
  async countByOutcomeSince(
    since: Date,
  ): Promise<Record<Outcome, number>> {
    const db = requireChatDb();
    const rows = await db
      .select({
        outcome: chatLead.outcome,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(chatLead)
      .where(gte(chatLead.createdAt, since))
      .groupBy(chatLead.outcome);
    const out: Record<Outcome, number> = {
      pending: 0,
      reached: 0,
      'no-answer': 0,
      converted: 0,
      discarded: 0,
    };
    for (const row of rows) {
      out[row.outcome as Outcome] = row.n;
    }
    return out;
  },

  /** RGPD — anonymise un lead sans le supprimer (audit trail conservé). */
  async forget(id: string): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatLead)
      .set({
        firstName: '[anonymisé]',
        phoneE164: '+0',
        phoneRaw: '[anonymisé]',
        note: null,
        fingerprintHash: null,
        snapshotMessages: null,
        outcome: 'discarded',
        updatedAt: new Date(),
      })
      .where(eq(chatLead.id, id));
  },
};
