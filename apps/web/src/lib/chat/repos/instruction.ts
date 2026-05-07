/**
 * CHA-018 — Repository chat_instruction_version (immutable, versionné).
 */
import { and, desc, eq, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import {
  chatInstructionVersion,
  type ChatInstructionVersionRow,
} from '../db/schema';

export const instructionRepo = {
  async listByScope(scope = 'default'): Promise<ChatInstructionVersionRow[]> {
    const db = requireChatDb();
    return db
      .select()
      .from(chatInstructionVersion)
      .where(eq(chatInstructionVersion.scope, scope))
      .orderBy(desc(chatInstructionVersion.version));
  },

  async active(scope = 'default'): Promise<ChatInstructionVersionRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatInstructionVersion)
      .where(
        and(
          eq(chatInstructionVersion.scope, scope),
          eq(chatInstructionVersion.enabled, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },

  async getById(id: string): Promise<ChatInstructionVersionRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatInstructionVersion)
      .where(eq(chatInstructionVersion.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(input: {
    scope?: string;
    body: string;
    bodyAr?: string | null;
    bodyArMa?: string | null;
    notes?: string | null;
    createdBy: string;
  }): Promise<ChatInstructionVersionRow> {
    const db = requireChatDb();
    const scope = input.scope ?? 'default';
    // Calcul de la version suivante
    const last = await db
      .select({ version: chatInstructionVersion.version })
      .from(chatInstructionVersion)
      .where(eq(chatInstructionVersion.scope, scope))
      .orderBy(desc(chatInstructionVersion.version))
      .limit(1);
    const nextVersion = (last[0]?.version ?? 0) + 1;
    const id = createId('ci');
    const rows = await db
      .insert(chatInstructionVersion)
      .values({
        id,
        scope,
        version: nextVersion,
        body: input.body,
        bodyAr: input.bodyAr ?? null,
        bodyArMa: input.bodyArMa ?? null,
        notes: input.notes ?? null,
        enabled: false,
        createdBy: input.createdBy,
      })
      .returning();
    return rows[0]!;
  },

  /**
   * Édition in-place d'une version (body / bodyAr / bodyArMa / notes uniquement).
   *
   * Les champs structurels (`version`, `scope`, `enabled`, `createdAt`,
   * `createdBy`) sont volontairement immuables : seul le contenu du prompt
   * peut être ajusté. Pour repartir d'une version saine, utiliser `create`.
   *
   * Attention : si une session a déjà été créée avec cette version
   * (`chat_session.instruction_version_id`), modifier le body change le
   * comportement rétroactif. C'est accepté pour les corrections d'admin —
   * pour un changement de fond, créer une nouvelle version à la place.
   */
  async update(
    id: string,
    patch: {
      body?: string;
      bodyAr?: string | null;
      bodyArMa?: string | null;
      notes?: string | null;
    },
  ): Promise<ChatInstructionVersionRow | null> {
    const db = requireChatDb();
    const set: Record<string, unknown> = {};
    if (typeof patch.body === 'string') set.body = patch.body;
    if (patch.bodyAr !== undefined) set.bodyAr = patch.bodyAr;
    if (patch.bodyArMa !== undefined) set.bodyArMa = patch.bodyArMa;
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (Object.keys(set).length === 0) return this.getById(id);
    const rows = await db
      .update(chatInstructionVersion)
      .set(set)
      .where(eq(chatInstructionVersion.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Active une version : désactive les autres dans le même scope. */
  async activate(id: string): Promise<ChatInstructionVersionRow | null> {
    const db = requireChatDb();
    return db.transaction(async (tx) => {
      const target = await tx
        .select()
        .from(chatInstructionVersion)
        .where(eq(chatInstructionVersion.id, id))
        .limit(1);
      if (!target[0]) return null;
      await tx.execute(sql`
        UPDATE chat_instruction_version
           SET enabled = false
         WHERE scope = ${target[0].scope} AND enabled = true
      `);
      const rows = await tx
        .update(chatInstructionVersion)
        .set({ enabled: true })
        .where(eq(chatInstructionVersion.id, id))
        .returning();
      return rows[0] ?? null;
    });
  },
};
