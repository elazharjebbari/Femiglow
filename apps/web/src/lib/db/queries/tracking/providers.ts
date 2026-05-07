import { asc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { decryptSecret, encryptSecret } from '@/lib/crypto/encryption';
import type {
  TrackingProvider,
  TrackingProviderKind,
  TrackingProviderStatus,
} from '@/lib/db/types';

export interface UpsertTrackingProviderInput {
  kind: TrackingProviderKind;
  status?: TrackingProviderStatus;
  pixelId?: string | null;
  capiToken?: string | null;
  testEventCode?: string | null;
  customHead?: string | null;
  customBody?: string | null;
  config?: Record<string, unknown>;
  enabledEvents?: string[];
}

export interface UpdateTrackingProviderInput {
  status?: TrackingProviderStatus;
  pixelId?: string | null;
  capiToken?: string | null;
  testEventCode?: string | null;
  customHead?: string | null;
  customBody?: string | null;
  config?: Record<string, unknown>;
  enabledEvents?: string[];
  errorCount24h?: number;
  lastError?: string | null;
  lastEventAt?: Date | null;
}

function rowToProvider(row: typeof schema.trackingProviders.$inferSelect): TrackingProvider {
  return {
    id: row.id,
    kind: row.kind as TrackingProviderKind,
    status: row.status as TrackingProviderStatus,
    pixelId: row.pixelId,
    capiToken: row.capiToken,
    capiTokenIv: row.capiTokenIv,
    capiTokenTag: row.capiTokenTag,
    testEventCode: row.testEventCode,
    customHead: row.customHead,
    customBody: row.customBody,
    config: (row.config as Record<string, unknown>) ?? {},
    enabledEvents: (row.enabledEvents as string[]) ?? [],
    lastEventAt: row.lastEventAt,
    errorCount24h: row.errorCount24h,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function encryptCapiToken(plaintext: string): string {
  return encryptSecret(plaintext);
}

export function decryptCapiToken(provider: TrackingProvider): string | null {
  if (!provider.capiToken) return null;
  try {
    return decryptSecret(provider.capiToken);
  } catch {
    return null;
  }
}

export async function findTrackingProviderByKind(
  kind: TrackingProviderKind,
): Promise<TrackingProvider | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingProviders)
      .where(eq(schema.trackingProviders.kind, kind))
      .limit(1);
    return rows[0] ? rowToProvider(rows[0]) : null;
  }
  for (const p of memoryStore().trackingProviders.values()) {
    if (p.kind === kind) return p;
  }
  return null;
}

export async function listTrackingProviders(): Promise<TrackingProvider[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.trackingProviders).orderBy(asc(schema.trackingProviders.kind));
    return rows.map(rowToProvider);
  }
  return Array.from(memoryStore().trackingProviders.values()).sort((a, b) => a.kind.localeCompare(b.kind));
}

export async function listEnabledTrackingProviders(): Promise<TrackingProvider[]> {
  const all = await listTrackingProviders();
  return all.filter((p) => p.status === 'enabled');
}

export async function upsertTrackingProvider(
  input: UpsertTrackingProviderInput,
): Promise<TrackingProvider> {
  const existing = await findTrackingProviderByKind(input.kind);
  const now = new Date();
  const encryptedToken = input.capiToken ? encryptCapiToken(input.capiToken) : null;
  if (existing) {
    return updateTrackingProvider(existing.id, {
      status: input.status,
      pixelId: input.pixelId,
      capiToken: input.capiToken,
      testEventCode: input.testEventCode,
      customHead: input.customHead,
      customBody: input.customBody,
      config: input.config,
      enabledEvents: input.enabledEvents,
    });
  }
  const provider: TrackingProvider = {
    id: createId('tpr'),
    kind: input.kind,
    status: input.status ?? 'disabled',
    pixelId: input.pixelId ?? null,
    capiToken: encryptedToken,
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: input.testEventCode ?? null,
    customHead: input.customHead ?? null,
    customBody: input.customBody ?? null,
    config: input.config ?? {},
    enabledEvents: input.enabledEvents ?? [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.trackingProviders).values({
      id: provider.id,
      kind: provider.kind,
      status: provider.status,
      pixelId: provider.pixelId,
      capiToken: provider.capiToken,
      testEventCode: provider.testEventCode,
      customHead: provider.customHead,
      customBody: provider.customBody,
      config: provider.config,
      enabledEvents: provider.enabledEvents,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    });
  } else {
    memoryStore().trackingProviders.set(provider.id, provider);
  }
  return provider;
}

export async function updateTrackingProvider(
  id: string,
  input: UpdateTrackingProviderInput,
): Promise<TrackingProvider> {
  const drizzle = db();
  const existing = drizzle
    ? (
        await drizzle
          .select()
          .from(schema.trackingProviders)
          .where(eq(schema.trackingProviders.id, id))
          .limit(1)
      )[0]
    : memoryStore().trackingProviders.get(id);
  if (!existing) throw new Error(`tracking provider ${id} not found`);
  const existingProvider = drizzle
    ? rowToProvider(existing as typeof schema.trackingProviders.$inferSelect)
    : (existing as TrackingProvider);
  const encryptedToken =
    input.capiToken === undefined
      ? existingProvider.capiToken
      : input.capiToken === null
        ? null
        : encryptCapiToken(input.capiToken);
  const updated: TrackingProvider = {
    ...existingProvider,
    status: input.status ?? existingProvider.status,
    pixelId: input.pixelId !== undefined ? input.pixelId : existingProvider.pixelId,
    capiToken: encryptedToken,
    testEventCode:
      input.testEventCode !== undefined ? input.testEventCode : existingProvider.testEventCode,
    customHead: input.customHead !== undefined ? input.customHead : existingProvider.customHead,
    customBody: input.customBody !== undefined ? input.customBody : existingProvider.customBody,
    config: input.config ?? existingProvider.config,
    enabledEvents: input.enabledEvents ?? existingProvider.enabledEvents,
    errorCount24h: input.errorCount24h ?? existingProvider.errorCount24h,
    lastError: input.lastError !== undefined ? input.lastError : existingProvider.lastError,
    lastEventAt: input.lastEventAt !== undefined ? input.lastEventAt : existingProvider.lastEventAt,
    updatedAt: new Date(),
  };
  if (drizzle) {
    await drizzle
      .update(schema.trackingProviders)
      .set({
        status: updated.status,
        pixelId: updated.pixelId,
        capiToken: updated.capiToken,
        testEventCode: updated.testEventCode,
        customHead: updated.customHead,
        customBody: updated.customBody,
        config: updated.config,
        enabledEvents: updated.enabledEvents,
        errorCount24h: updated.errorCount24h,
        lastError: updated.lastError,
        lastEventAt: updated.lastEventAt,
        updatedAt: updated.updatedAt,
      })
      .where(eq(schema.trackingProviders.id, id));
  } else {
    memoryStore().trackingProviders.set(id, updated);
  }
  return updated;
}

export async function deleteTrackingProvider(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.trackingProviders).where(eq(schema.trackingProviders.id, id));
  } else {
    memoryStore().trackingProviders.delete(id);
  }
}
