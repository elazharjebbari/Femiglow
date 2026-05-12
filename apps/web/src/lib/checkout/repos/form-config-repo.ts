/**
 * CHA-230 — Repository form_config (admin + read public).
 *
 * Charge la config JSONB du wizard (`wizard_kit`, `wizard_commander`, …)
 * et expose des helpers pour la modifier avec un audit trail dans
 * `form_config_history`.
 *
 * Garanties :
 *   - Toute mutation incrémente `version` ET enregistre une ligne dans
 *     `form_config_history` (audit immuable).
 *   - L'écriture du JSONB passe par le schema Zod en amont (cf.
 *     `apps/web/src/lib/checkout/form-config/schema.ts`).
 *
 * Pas de cache mémoire ici — la route handler peut le faire au-dessus
 * (ex. revalidate Next.js).
 */
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  formConfig,
  formConfigHistory,
  type FormConfigRow,
} from '@/lib/db/schema';
import { createId } from '@/lib/ids';

import { type FormConfigJson } from '../form-config/schema';

import { DbUnavailableError } from './idempotency-repo';

function requireDb(): NonNullable<ReturnType<typeof db>> {
  const conn = db();
  if (!conn) throw new DbUnavailableError();
  return conn;
}

export type FormConfigHistoryAction =
  | 'create'
  | 'update'
  | 'activate'
  | 'deactivate'
  | 'rollback';

export const formConfigRepo = {
  /** Lit la config par clé (`wizard_kit`, `wizard_commander`, ...). */
  async getByKey(key: string): Promise<FormConfigRow | null> {
    const conn = requireDb();
    const rows = await conn
      .select()
      .from(formConfig)
      .where(eq(formConfig.key, key))
      .limit(1);
    return rows[0] ?? null;
  },

  /**
   * Met à jour la config + historise. La version est auto-incrementée.
   * Returns la nouvelle row (avec version mise à jour).
   */
  async update(input: {
    key: string;
    config: FormConfigJson;
    description?: string | null;
    active?: boolean;
    actorId: string;
  }): Promise<FormConfigRow | null> {
    const conn = requireDb();
    const existing = await this.getByKey(input.key);
    if (!existing) return null;

    const nextVersion = existing.version + 1;
    const now = new Date();

    // Audit log AVANT mutation pour garantir la trace même si la suite échoue.
    await conn.insert(formConfigHistory).values({
      id: createId('fch'),
      formConfigId: existing.id,
      key: existing.key,
      version: nextVersion,
      config: input.config,
      description: input.description ?? existing.description,
      actorId: input.actorId,
      action: 'update' as FormConfigHistoryAction,
    });

    const rows = await conn
      .update(formConfig)
      .set({
        config: input.config,
        version: nextVersion,
        description: input.description ?? existing.description,
        active: input.active ?? existing.active,
        updatedAt: now,
        updatedBy: input.actorId,
      })
      .where(eq(formConfig.id, existing.id))
      .returning();
    return rows[0] ?? null;
  },

  /**
   * Rollback explicite vers une version historique. Crée une nouvelle
   * version (=last+1) avec le contenu de la version cible.
   */
  async rollback(input: {
    key: string;
    targetVersion: number;
    actorId: string;
  }): Promise<FormConfigRow | null> {
    const conn = requireDb();
    const existing = await this.getByKey(input.key);
    if (!existing) return null;

    const target = await conn
      .select()
      .from(formConfigHistory)
      .where(eq(formConfigHistory.formConfigId, existing.id))
      .limit(50);
    const match = target.find((row) => row.version === input.targetVersion);
    if (!match) return null;

    const nextVersion = existing.version + 1;
    const now = new Date();

    await conn.insert(formConfigHistory).values({
      id: createId('fch'),
      formConfigId: existing.id,
      key: existing.key,
      version: nextVersion,
      config: match.config,
      description: `Rollback to v${input.targetVersion}`,
      actorId: input.actorId,
      action: 'rollback' as FormConfigHistoryAction,
    });

    const rows = await conn
      .update(formConfig)
      .set({
        config: match.config,
        version: nextVersion,
        updatedAt: now,
        updatedBy: input.actorId,
      })
      .where(eq(formConfig.id, existing.id))
      .returning();
    return rows[0] ?? null;
  },

  /** Liste l'historique pour la console admin (paginé client). */
  async listHistory(key: string, limit: number = 50) {
    const conn = requireDb();
    const cfg = await this.getByKey(key);
    if (!cfg) return [];
    return conn
      .select()
      .from(formConfigHistory)
      .where(eq(formConfigHistory.formConfigId, cfg.id))
      .limit(limit);
  },
};
