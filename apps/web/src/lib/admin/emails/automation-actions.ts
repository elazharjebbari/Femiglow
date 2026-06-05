'use server';

/**
 * Server actions for the automation admin page.
 *   - toggleAutomationActive : flip active flag (avec feedback + confirmation côté UI)
 *   - cancelAutomationRun    : mark a single running run as cancelled
 *   - retryAutomationRun     : relance un run errored (UX-AUT-003)
 *
 * Toutes renvoient un `ActionResult` { ok, message } pour alimenter un
 * feedback role=alert/role=status côté client (useActionState) — UX-AUT-012.
 */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';

export type ActionResult = { ok: boolean; message: string };

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

/**
 * Bascule l'état actif d'une automation. Compatible `useActionState`
 * ((prevState, formData) => …) pour exposer un feedback succès/erreur.
 * Désactiver une automation annulera ses runs en cours au prochain tick : la
 * confirmation est portée côté UI (UX-AUT-012).
 */
export async function toggleAutomationActive(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin('/admin/emails/automation');
    const id = String(formData.get('id') ?? '');
    const next = formData.get('next') === 'true';
    if (!id) return { ok: false, message: 'Identifiant manquant.' };

    const drizzle = requireDb();
    const updated = await drizzle
      .update(emailAutomation)
      .set({ active: next, updatedAt: new Date() })
      .where(eq(emailAutomation.id, id))
      .returning();
    if (updated.length === 0) return { ok: false, message: 'Automation introuvable.' };

    await logAuditEvent({
      action: next ? 'mail.automation.activated' : 'mail.automation.deactivated',
      actorId: session.email,
      resourceId: id,
    });
    logger.info('admin.automation.toggle', { id, next, by: session.email });
    revalidatePath('/admin/emails/automation');
    return {
      ok: true,
      message: next ? 'Automation activée.' : 'Automation désactivée (ses runs en cours seront annulés au prochain tick).',
    };
  } catch (err) {
    logger.error('admin.automation.toggle_failed', { error: String(err) });
    return { ok: false, message: 'Échec de la mise à jour. Réessayez.' };
  }
}

/** Annule un run en cours. Compatible `useActionState`. */
export async function cancelAutomationRun(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin('/admin/emails/automation');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, message: 'Identifiant manquant.' };

    const drizzle = requireDb();
    const updated = await drizzle
      .update(emailAutomationRun)
      .set({ status: 'cancelled', finishedAt: new Date(), nextActionAt: null })
      .where(eq(emailAutomationRun.id, id))
      .returning();
    if (updated.length === 0) return { ok: false, message: 'Run introuvable.' };

    await logAuditEvent({
      action: 'mail.automation.run_cancelled',
      actorId: session.email,
      resourceId: id,
    });
    revalidatePath('/admin/emails/automation');
    revalidatePath('/admin/emails/automation/runs');
    return { ok: true, message: 'Run annulé.' };
  } catch (err) {
    logger.error('admin.automation.cancel_failed', { error: String(err) });
    return { ok: false, message: 'Échec de l’annulation. Réessayez.' };
  }
}

/**
 * Relance un run `errored` (UX-AUT-003) : remet status='running',
 * nextActionAt=now, efface erroredReason/erroredAt/finishedAt. Le run reprend
 * au step courant au prochain tick du runner.
 *
 * Refuse (ok=false) tout run dont le statut n'est pas `errored` (on ne ré-arme
 * pas un run completed/cancelled/running) — anti-incohérence.
 *
 * Signature double : utilisable en `useActionState` (1er arg ignoré) OU en
 * appel direct `retryAutomationRun(formData)`.
 */
export async function retryAutomationRun(
  arg1: ActionResult | undefined | FormData,
  arg2?: FormData,
): Promise<ActionResult> {
  const formData = arg1 instanceof FormData ? arg1 : arg2;
  try {
    const session = await requireAdmin('/admin/emails/automation');
    const id = String(formData?.get('id') ?? '');
    if (!id) return { ok: false, message: 'Identifiant manquant.' };

    const drizzle = requireDb();
    // UPDATE conditionné sur status='errored' : atomique, ne ré-arme JAMAIS un
    // run completed/cancelled/running. `returning` vide ⇒ rien n'a matché.
    const updated = await drizzle
      .update(emailAutomationRun)
      .set({
        status: 'running',
        nextActionAt: new Date(),
        finishedAt: null,
        erroredAt: null,
        erroredReason: null,
      })
      .where(
        and(
          eq(emailAutomationRun.id, id),
          eq(emailAutomationRun.status, 'errored'),
        ),
      )
      .returning();

    if (updated.length === 0) {
      return {
        ok: false,
        message: 'Run introuvable ou non relançable (seuls les runs en erreur peuvent être relancés).',
      };
    }

    await logAuditEvent({
      action: 'mail.automation.run_retried',
      actorId: session.email,
      resourceId: id,
    });
    logger.info('admin.automation.run_retried', { id, by: session.email });
    revalidatePath('/admin/emails/automation');
    revalidatePath('/admin/emails/automation/runs');
    revalidatePath(`/admin/emails/automation/runs/${id}`);
    return { ok: true, message: 'Run relancé — il reprendra au prochain tick.' };
  } catch (err) {
    logger.error('admin.automation.retry_failed', { error: String(err) });
    return { ok: false, message: 'Échec de la relance. Réessayez.' };
  }
}
