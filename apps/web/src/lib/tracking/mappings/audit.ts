/**
 * Audit log pour les mutations event_mapping_versions.
 * cf. docs/event-mappings/30-backend/audit-events.md
 */
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { MappingAuditAction, MappingAuditEntry } from './types';

export async function auditMappingChange(input: {
  versionId: string | null;
  action: MappingAuditAction;
  actorId: string;
  before?: object | null;
  after?: object | null;
  meta?: Record<string, unknown>;
  ipAnonymized?: string | null;
  uaHash?: string | null;
}): Promise<void> {
  const drizzle = db();
  if (!drizzle) return; // best-effort en memory mode
  await drizzle.insert(schema.eventMappingAudit).values({
    id: createId('ema'),
    versionId: input.versionId,
    action: input.action,
    actorId: input.actorId,
    before: (input.before ?? null) as unknown as Record<string, unknown> | null,
    after: (input.after ?? null) as unknown as Record<string, unknown> | null,
    meta: input.meta ?? {},
    ipAnonymized: input.ipAnonymized ?? null,
    uaHash: input.uaHash ?? null,
  });
}

export async function listAuditForVersion(
  versionId: string,
  opts: { limit?: number } = {},
): Promise<MappingAuditEntry[]> {
  const drizzle = db();
  if (!drizzle) return [];
  const rows = await drizzle
    .select()
    .from(schema.eventMappingAudit)
    .where(eq(schema.eventMappingAudit.versionId, versionId))
    .orderBy(desc(schema.eventMappingAudit.createdAt))
    .limit(opts.limit ?? 50);
  return rows.map((r) => ({
    id: r.id,
    versionId: r.versionId,
    action: r.action as MappingAuditAction,
    actorId: r.actorId,
    before: r.before as Record<string, unknown> | null,
    after: r.after as Record<string, unknown> | null,
    meta: r.meta as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}
