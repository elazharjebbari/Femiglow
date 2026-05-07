import { logAuditEvent } from '@/lib/audit/log-event';

export type TrackingResource =
  | 'tracking_page'
  | 'tracking_component'
  | 'tracking_event_definition'
  | 'tracking_component_event'
  | 'tracking_provider'
  | 'tracking_consent'
  | 'tracking_inventory'
  | 'site_component'
  | 'component_media_binding'
  | 'component_animation_binding'
  | 'tracking_gtm';

export type TrackingAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'enable'
  | 'disable'
  | 'sync'
  | 'seed'
  | 'test_event'
  | 'purge'
  | 'custom_code_update'
  | 'export_download'
  | 'export_copy'
  | 'export_view'
  | 'export_push'
  | 'assign'
  | 'unassign'
  | 'bulk-activate'
  | 'bulk-deactivate'
  | 'bulk-delete'
  | 'bulk-update';

export async function auditTrackingChange(input: {
  action: TrackingAction;
  resource: TrackingResource;
  resourceId?: string | null;
  actorId: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await logAuditEvent({
    action: `tracking.${input.resource}.${input.action}`,
    actorId: input.actorId,
    resourceType: input.resource,
    resourceId: input.resourceId ?? null,
    meta: input.meta ?? {},
  });
}
