import { logAuditEvent } from '@/lib/audit/log-event';

export type LegalAuditAction =
  | 'legal.page.created'
  | 'legal.page.updated'
  | 'legal.page.archived'
  | 'legal.page.submitted-review'
  | 'legal.page.published'
  | 'legal.page.restored'
  | 'legal.placement.upserted'
  | 'legal.placement.toggled'
  | 'legal.template-var.updated';

export async function logLegalEvent(
  action: LegalAuditAction,
  actorId: string | null,
  resourceId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  await logAuditEvent({
    action,
    actorId,
    resourceType: 'legal_page',
    resourceId,
    meta,
  });
}
