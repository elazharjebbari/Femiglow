import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logging/logger';
import type { AuditEvent } from '@/lib/db/types';

export async function logAuditEvent(input: {
  action: string;
  actorId: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: createId('ae'),
    action: input.action,
    actorId: input.actorId,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    meta: input.meta ?? {},
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.auditEvents).values(event);
  } else {
    memoryStore().auditEvents.set(event.id, event);
  }
  logger.info('audit.event', {
    action: input.action,
    actor_id: input.actorId,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
  });
  return event;
}
