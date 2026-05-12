/**
 * CHA-230 — Repository form_variant_assignment (sticky A/B).
 *
 * Assigne un `variant_key` (`A` | `B` | `control`) à un couple
 * `(visitor_id, form_id)`. Sticky : une fois assigné, la valeur ne change
 * plus tant que la row existe.
 *
 * `assignOrGet` est la primitive idempotente :
 *   - si la row existe → retourne sa valeur.
 *   - sinon → l'insère avec la valeur fournie (résolue côté caller via
 *     hash ou tirage déterministe).
 *
 * On utilise un upsert `DO NOTHING` pour éviter les races (deux requêtes
 * concurrentes sur le même visiteur).
 */
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  formVariantAssignment,
  type FormVariantAssignmentRow,
} from '@/lib/db/schema';

import { DbUnavailableError } from './idempotency-repo';

function requireDb(): NonNullable<ReturnType<typeof db>> {
  const conn = db();
  if (!conn) throw new DbUnavailableError();
  return conn;
}

export type VariantKey = FormVariantAssignmentRow['variantKey'];

export const variantAssignmentRepo = {
  /**
   * Retourne l'assignation existante OU insère la nouvelle (idempotent).
   * Si une race insère en parallèle, on relit pour renvoyer la valeur
   * effectivement persistée.
   */
  async assignOrGet(input: {
    visitorId: string;
    formId: string;
    variantKey: VariantKey;
    experimentKey?: string | null;
  }): Promise<FormVariantAssignmentRow> {
    const conn = requireDb();
    // Tentative d'insertion (DO NOTHING en cas de conflit PK).
    await conn
      .insert(formVariantAssignment)
      .values({
        visitorId: input.visitorId,
        formId: input.formId,
        variantKey: input.variantKey,
        experimentKey: input.experimentKey ?? null,
      })
      .onConflictDoNothing({
        target: [formVariantAssignment.visitorId, formVariantAssignment.formId],
      });
    // Re-lecture pour garantir la valeur effective (couvre la race).
    const rows = await conn
      .select()
      .from(formVariantAssignment)
      .where(
        and(
          eq(formVariantAssignment.visitorId, input.visitorId),
          eq(formVariantAssignment.formId, input.formId),
        ),
      )
      .limit(1);
    // Impossible : on vient d'insérer ou il existait déjà.
    if (!rows[0]) {
      throw new Error('variant_assignment lookup failed après insert');
    }
    return rows[0];
  },

  async getByVisitor(input: {
    visitorId: string;
    formId: string;
  }): Promise<FormVariantAssignmentRow | null> {
    const conn = requireDb();
    const rows = await conn
      .select()
      .from(formVariantAssignment)
      .where(
        and(
          eq(formVariantAssignment.visitorId, input.visitorId),
          eq(formVariantAssignment.formId, input.formId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },
};

/**
 * Résout déterministiquement le variant à attribuer pour un (visitorId,
 * formId) — utilisable côté serveur si la row n'existe pas encore.
 *
 * Note : on hash le visitorId pour répartir uniformément A/B (50/50). Le
 * `control` n'est pas assigné par cette fonction (il sert pour les
 * forçages admin).
 */
export function resolveDeterministicVariant(
  visitorId: string,
  weights: { A: number; B: number } = { A: 50, B: 50 },
): 'A' | 'B' {
  const total = weights.A + weights.B;
  if (total <= 0) return 'A';
  let h = 0;
  for (let i = 0; i < visitorId.length; i += 1) {
    h = (h * 31 + visitorId.charCodeAt(i)) >>> 0;
  }
  const bucket = h % total;
  return bucket < weights.A ? 'A' : 'B';
}
