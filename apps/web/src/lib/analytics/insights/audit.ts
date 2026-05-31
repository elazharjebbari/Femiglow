/**
 * Helpers audit pour le module Insights — wrapper léger sur logAuditEvent.
 */
import { logAuditEvent } from '@/lib/audit/log-event';

export type InsightsAuditAction =
  | 'analytics.insights.refresh'
  | 'analytics.insights.toggle'
  | 'analytics.insights.settings_update'
  | 'analytics.insights.export'
  | 'analytics.insights.drilldown.page'
  | 'analytics.insights.drilldown.component'
  | 'analytics.insights.purge';

export async function logInsightsAudit(input: {
  action: InsightsAuditAction;
  actorId: string | null;
  meta?: Record<string, unknown>;
  resourceId?: string | null;
}): Promise<void> {
  await logAuditEvent({
    action: input.action,
    actorId: input.actorId,
    resourceType: 'analytics_insights',
    resourceId: input.resourceId ?? null,
    meta: input.meta,
  });
}
