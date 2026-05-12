/**
 * CHA-230 — Repository chat_session côté wizard (init paresseuse).
 *
 * Le wizard checkout réutilise la table `chat_session` (FK depuis
 * `chat_lead.session_id`) mais n'a pas besoin d'une conversation IA.
 * Ce repo crée une session "fantôme" à la volée (status=open, pas de
 * messages) afin de satisfaire la contrainte FK sans dupliquer la table.
 *
 * Idempotent : si une session existe déjà avec ce `sessionId`, retourne
 * la row existante sans modification (les TOUCH éventuels sont gérés
 * par `sessionRepo.touch()` côté chat).
 *
 * Conception
 * ----------
 * - Atomique via `INSERT ... ON CONFLICT (id) DO NOTHING RETURNING *`
 *   puis SELECT fallback si conflit → garantit que deux requêtes
 *   concurrentes avec le même sessionId ne dupliquent jamais.
 * - Utilise la version d'instruction active comme stub (chat_session
 *   exige `instruction_version_id NOT NULL`). Si aucune version n'est
 *   active, lève `NoActiveInstructionError` — l'admin doit en activer
 *   une (cf. CHA-018) avant de pouvoir capturer un lead wizard.
 *
 * Sécurité
 * --------
 * - Le `visitorId` provient du client mais n'a PAS d'impact sur les
 *   privilèges : la session sert uniquement de pivot pour le lead.
 *   Aucune donnée sensible n'y est écrite par le wizard.
 * - On NE re-mappe PAS un visitorId existant : si l'attaquant force
 *   un `sessionId` qui existe déjà avec un autre visitor, l'INSERT
 *   est un no-op et la row existante reste intacte.
 */
import { eq, sql } from 'drizzle-orm';

import { requireChatDb } from '@/lib/chat/db/client';
import { chatSession, type ChatSessionRow } from '@/lib/chat/db/schema';
import { instructionRepo } from '@/lib/chat/repos/instruction';

export interface EnsureWizardSessionInput {
  sessionId: string;
  visitorId: string;
  language?: string | null;
  page?: string | null;
  referrer?: string | null;
  utm?: Record<string, string> | null;
}

export class NoActiveInstructionError extends Error {
  constructor() {
    super(
      'Aucune version d\u2019instruction chat active. Activer une version (CHA-018) avant de capturer un lead wizard.',
    );
    this.name = 'NoActiveInstructionError';
  }
}

export const wizardSessionRepo = {
  /**
   * Garantit qu'une row `chat_session` existe pour le `sessionId` donné.
   * Si absente, en crée une avec la version d'instruction active.
   * Si présente, ne touche à rien et la retourne.
   */
  async ensureForWizard(input: EnsureWizardSessionInput): Promise<ChatSessionRow> {
    const db = requireChatDb();

    // Fast path : la session existe déjà.
    const existing = await db
      .select()
      .from(chatSession)
      .where(eq(chatSession.id, input.sessionId))
      .limit(1);
    if (existing[0]) return existing[0];

    // Slow path : il faut créer la row. Exige une version d'instruction active.
    const active = await instructionRepo.active();
    if (!active) throw new NoActiveInstructionError();

    // INSERT ... ON CONFLICT DO NOTHING pour gérer la concurrence.
    // Si deux requêtes arrivent en même temps, l'une crée, l'autre voit le
    // conflit et bascule sur le SELECT de récupération.
    const inserted = await db
      .insert(chatSession)
      .values({
        id: input.sessionId,
        visitorId: input.visitorId,
        language: input.language ?? 'fr',
        page: input.page ?? null,
        referrer: input.referrer ?? null,
        utm: input.utm ?? null,
        instructionVersionId: active.id,
        status: 'open',
      })
      .onConflictDoNothing({ target: chatSession.id })
      .returning();

    if (inserted[0]) return inserted[0];

    // Conflit → autre requête a gagné la course. Relire la row.
    const recheck = await db
      .select()
      .from(chatSession)
      .where(eq(chatSession.id, input.sessionId))
      .limit(1);
    if (!recheck[0]) {
      // Impossible en pratique (FK garantie par l'INSERT), mais on protège
      // contre une race extrême (purge concurrente, etc.).
      throw new Error('chat_session insertion race condition');
    }
    return recheck[0];
  },

  /** Met à jour `last_seen_at` (utile entre les étapes du wizard). */
  async touch(sessionId: string): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatSession)
      .set({ lastSeenAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(chatSession.id, sessionId));
  },
};
