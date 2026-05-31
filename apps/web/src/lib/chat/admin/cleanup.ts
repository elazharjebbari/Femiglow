/**
 * CHA-LEAD-V2 — Cleanup des ghost sessions orphelines.
 *
 * Archive les rows `chat_session` :
 *  - kind = 'wizard_pivot' (default)
 *  - status = 'open'
 *  - aucun `chat_lead` rattaché (orphelin)
 *  - opened_at > N jours (default 30)
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/api-contracts.md §9
 */
import { and, eq, lt, notExists, sql } from 'drizzle-orm';

import { requireChatDb } from '../db/client';
import { chatLead, chatSession } from '../db/schema';
import type { ChatSessionKind } from '../db/kind';

export interface CleanupGhostsInput {
  dryRun: boolean;
  olderThanDays: number;
  kinds?: ReadonlyArray<ChatSessionKind>;
}

export interface CleanupGhostsResult {
  candidates: number;
  archived: number;
  dryRun: boolean;
  criteria: {
    olderThanDays: number;
    kinds: ReadonlyArray<ChatSessionKind>;
    withoutLead: true;
  };
}

const DEFAULT_KINDS: ReadonlyArray<ChatSessionKind> = ['wizard_pivot'];

export async function cleanupGhosts(
  input: CleanupGhostsInput,
): Promise<CleanupGhostsResult> {
  if (input.olderThanDays < 7) {
    throw new Error('olderThanDays must be >= 7 (safety guard)');
  }
  const db = requireChatDb();
  const kinds = input.kinds && input.kinds.length > 0 ? input.kinds : DEFAULT_KINDS;
  const cutoff = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000);

  // 1. Compter les candidats
  const countRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(chatSession)
    .where(
      and(
        sql`${chatSession.kind} IN (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})`,
        eq(chatSession.status, 'open'),
        lt(chatSession.openedAt, cutoff),
        notExists(
          db.select().from(chatLead).where(eq(chatLead.sessionId, chatSession.id)),
        ),
      ),
    );
  const candidates = Number(countRows[0]?.value ?? 0);

  // 2. Archiver si pas dry-run
  let archived = 0;
  if (!input.dryRun && candidates > 0) {
    const result = await db
      .update(chatSession)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          sql`${chatSession.kind} IN (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})`,
          eq(chatSession.status, 'open'),
          lt(chatSession.openedAt, cutoff),
          notExists(
            db.select().from(chatLead).where(eq(chatLead.sessionId, chatSession.id)),
          ),
        ),
      )
      .returning();
    archived = result.length;
  }

  return {
    candidates,
    archived,
    dryRun: input.dryRun,
    criteria: {
      olderThanDays: input.olderThanDays,
      kinds,
      withoutLead: true,
    },
  };
}
