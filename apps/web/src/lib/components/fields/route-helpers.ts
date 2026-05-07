/**
 * Helpers partagés par les routes `/api/admin/components/[key]/fields/**`.
 *
 * - `requireAdminApi` : garde `getAdminSession` + lance HttpError approprié.
 * - `requireComponentAndField` : résout `(key, fieldKey)` et lève les bonnes
 *   erreurs (`not_found`, `field_removed`).
 * - `auditFieldChange` : wrapper sur `logAuditEvent` avec resourceType
 *   stable `component_field_binding`.
 */
import 'server-only';
import { HttpError } from '@/lib/errors/http-error';
import { getAdminSession } from '@/lib/auth/require-admin';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { logAuditEvent } from '@/lib/audit/log-event';
import type { AdminSession } from '@/lib/auth/session';
import type { ComponentFieldDefinition, SiteComponent } from '@/lib/db/types';

export async function requireAdminApi(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new HttpError('unauthorized', 'Session requise');
  return session;
}

export async function requireComponentAndField(
  componentKey: string,
  fieldKey: string,
): Promise<{ component: SiteComponent; field: ComponentFieldDefinition }> {
  const cmp = await getSiteComponentByKey(componentKey);
  if (!cmp) throw new HttpError('not_found', 'Composant introuvable');
  const field = (cmp.fields ?? []).find((f) => f.key === fieldKey);
  if (!field) {
    // Différencie un champ jamais déclaré (404) vs. un champ retiré du registre :
    // on n'a pas de marqueur "tombstone" → `field_removed` (409) est réservé
    // au cas où des bindings existent encore. Ici, simple 404.
    throw new HttpError('not_found', `Champ '${fieldKey}' introuvable`);
  }
  return { component: cmp, field };
}

/** Log d'audit court — actions standardisées : `field.draft.create`, `field.draft.update`,
 * `field.publish`, `field.schedule`, `field.cancel_schedule`, `field.restore`. */
export async function auditFieldChange(input: {
  action: string;
  actorId: string | null;
  componentKey: string;
  fieldKey: string;
  bindingId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await logAuditEvent({
    action: input.action,
    actorId: input.actorId,
    resourceType: 'component_field_binding',
    resourceId: input.bindingId ?? `${input.componentKey}/${input.fieldKey}`,
    meta: {
      componentKey: input.componentKey,
      fieldKey: input.fieldKey,
      ...(input.meta ?? {}),
    },
  });
}
