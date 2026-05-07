import { desc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { LeadEvent, LeadEventType } from '@/lib/db/types';

export async function listLeadEvents(leadId: string): Promise<LeadEvent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.leadEvents)
      .where(eq(schema.leadEvents.leadId, leadId))
      .orderBy(desc(schema.leadEvents.createdAt));
    return rows.map((r) => ({
      ...r,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    }));
  }
  const store = memoryStore();
  return Array.from(store.leadEvents.values())
    .filter((e) => e.leadId === leadId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createLeadEvent(input: {
  leadId: string;
  type: LeadEventType;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<LeadEvent> {
  const event: LeadEvent = {
    id: createId('le'),
    leadId: input.leadId,
    type: input.type,
    actorId: input.actorId,
    payload: input.payload ?? {},
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.leadEvents).values(event);
    return event;
  }
  memoryStore().leadEvents.set(event.id, event);
  return event;
}
