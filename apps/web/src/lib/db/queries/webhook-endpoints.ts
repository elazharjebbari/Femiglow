import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { encryptSecret, generateWebhookSecret } from '@/lib/crypto/encryption';
import type { WebhookEndpoint, WebhookEventName } from '@/lib/db/types';

function rowToEndpoint(row: typeof schema.webhookEndpoints.$inferSelect): WebhookEndpoint {
  return {
    ...row,
    events: (row.events ?? []) as WebhookEventName[],
  };
}

export async function listWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.webhookEndpoints)
      .where(isNull(schema.webhookEndpoints.deletedAt))
      .orderBy(desc(schema.webhookEndpoints.createdAt));
    return rows.map(rowToEndpoint);
  }
  return Array.from(memoryStore().webhookEndpoints.values())
    .filter((e) => !e.deletedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getWebhookEndpoint(id: string): Promise<WebhookEndpoint | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.webhookEndpoints)
      .where(and(eq(schema.webhookEndpoints.id, id), isNull(schema.webhookEndpoints.deletedAt)))
      .limit(1);
    return rows[0] ? rowToEndpoint(rows[0]) : null;
  }
  const ep = memoryStore().webhookEndpoints.get(id);
  return ep && !ep.deletedAt ? ep : null;
}

export async function createWebhookEndpoint(input: {
  url: string;
  events: WebhookEventName[];
  description?: string | null;
}): Promise<{ endpoint: WebhookEndpoint; plainSecret: string }> {
  const plainSecret = generateWebhookSecret();
  const now = new Date();
  const endpoint: WebhookEndpoint = {
    id: createId('we'),
    url: input.url,
    events: input.events,
    encryptedSecret: encryptSecret(plainSecret),
    active: true,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.webhookEndpoints).values(endpoint);
    return { endpoint, plainSecret };
  }
  memoryStore().webhookEndpoints.set(endpoint.id, endpoint);
  return { endpoint, plainSecret };
}

export async function updateWebhookEndpoint(
  id: string,
  patch: Partial<Pick<WebhookEndpoint, 'url' | 'events' | 'active' | 'description'>>,
): Promise<WebhookEndpoint> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .update(schema.webhookEndpoints)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(schema.webhookEndpoints.id, id), isNull(schema.webhookEndpoints.deletedAt)))
      .returning();
    if (!rows[0]) throw new Error(`Endpoint ${id} introuvable`);
    return rowToEndpoint(rows[0]);
  }
  const store = memoryStore();
  const ep = store.webhookEndpoints.get(id);
  if (!ep || ep.deletedAt) throw new Error(`Endpoint ${id} introuvable`);
  const next: WebhookEndpoint = { ...ep, ...patch, updatedAt: new Date() };
  store.webhookEndpoints.set(id, next);
  return next;
}

export async function rotateWebhookSecret(id: string): Promise<{
  endpoint: WebhookEndpoint;
  plainSecret: string;
}> {
  const plainSecret = generateWebhookSecret();
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .update(schema.webhookEndpoints)
      .set({ encryptedSecret: encryptSecret(plainSecret), updatedAt: new Date() })
      .where(and(eq(schema.webhookEndpoints.id, id), isNull(schema.webhookEndpoints.deletedAt)))
      .returning();
    if (!rows[0]) throw new Error(`Endpoint ${id} introuvable`);
    return { endpoint: rowToEndpoint(rows[0]), plainSecret };
  }
  const store = memoryStore();
  const ep = store.webhookEndpoints.get(id);
  if (!ep || ep.deletedAt) throw new Error(`Endpoint ${id} introuvable`);
  const next: WebhookEndpoint = {
    ...ep,
    encryptedSecret: encryptSecret(plainSecret),
    updatedAt: new Date(),
  };
  store.webhookEndpoints.set(id, next);
  return { endpoint: next, plainSecret };
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.webhookEndpoints)
      .set({ deletedAt: new Date() })
      .where(eq(schema.webhookEndpoints.id, id));
    return;
  }
  const store = memoryStore();
  const ep = store.webhookEndpoints.get(id);
  if (!ep) return;
  store.webhookEndpoints.set(id, { ...ep, deletedAt: new Date() });
}
