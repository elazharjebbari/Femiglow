/**
 * Audience CRUD queries (M5.3.6).
 */
import 'server-only';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import {
  emailAudience,
  emailAudienceSnapshot,
  type EmailAudienceRow,
  type EmailAudienceSnapshotRow,
} from '@/lib/db/schema-emails';
import {
  RulesGroupSchema,
  ExclusionFlagsSchema,
  type ExclusionFlags,
  type RulesGroup,
} from './rules-types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type CreateAudienceInput = {
  slug: string;
  name: string;
  description?: string;
  rules: RulesGroup;
  exclusionFlags?: ExclusionFlags;
  evaluationMode?: 'static' | 'dynamic';
};

export type UpdateAudienceInput = {
  name?: string;
  description?: string;
  rules?: RulesGroup;
  exclusionFlags?: ExclusionFlags;
  evaluationMode?: 'static' | 'dynamic';
};

export async function listAudiences(): Promise<EmailAudienceRow[]> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailAudience)
    .where(isNull(emailAudience.deletedAt))
    .orderBy(desc(emailAudience.createdAt));
  return rows;
}

export async function getAudienceById(id: string): Promise<EmailAudienceRow | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailAudience)
    .where(and(eq(emailAudience.id, id), isNull(emailAudience.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAudienceBySlug(slug: string): Promise<EmailAudienceRow | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailAudience)
    .where(and(eq(emailAudience.slug, slug), isNull(emailAudience.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAudience(
  input: CreateAudienceInput,
  createdBy: string,
): Promise<EmailAudienceRow> {
  RulesGroupSchema.parse(input.rules);
  if (input.exclusionFlags) ExclusionFlagsSchema.parse(input.exclusionFlags);

  const drizzle = requireDb();
  const [row] = await drizzle
    .insert(emailAudience)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      rules: input.rules,
      exclusionFlags: input.exclusionFlags ?? undefined,
      evaluationMode: input.evaluationMode ?? 'dynamic',
      createdBy,
    })
    .returning();
  if (!row) throw new Error('createAudience: INSERT returned no row');
  return row;
}

export async function updateAudience(
  id: string,
  input: UpdateAudienceInput,
): Promise<EmailAudienceRow | null> {
  if (input.rules) RulesGroupSchema.parse(input.rules);
  if (input.exclusionFlags) ExclusionFlagsSchema.parse(input.exclusionFlags);

  const drizzle = requireDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.rules !== undefined) patch.rules = input.rules;
  if (input.exclusionFlags !== undefined) patch.exclusionFlags = input.exclusionFlags;
  if (input.evaluationMode !== undefined) patch.evaluationMode = input.evaluationMode;

  const [row] = await drizzle
    .update(emailAudience)
    .set(patch)
    .where(and(eq(emailAudience.id, id), isNull(emailAudience.deletedAt)))
    .returning();
  return row ?? null;
}

export async function deleteAudience(id: string): Promise<boolean> {
  const drizzle = requireDb();
  const [row] = await drizzle
    .update(emailAudience)
    .set({ deletedAt: new Date() })
    .where(and(eq(emailAudience.id, id), isNull(emailAudience.deletedAt)))
    .returning();
  return !!row;
}

export async function listSnapshotsForAudience(
  audienceId: string,
  limit: number = 20,
): Promise<EmailAudienceSnapshotRow[]> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailAudienceSnapshot)
    .where(eq(emailAudienceSnapshot.audienceId, audienceId))
    .orderBy(desc(emailAudienceSnapshot.createdAt))
    .limit(Math.min(Math.max(1, limit), 100));
  return rows;
}

export type AudienceListItem = Pick<
  EmailAudienceRow,
  'id' | 'slug' | 'name' | 'description' | 'evaluationMode' | 'createdBy' | 'createdAt'
> & { snapshotCount: number };

export async function listAudiencesWithSnapshotCount(): Promise<AudienceListItem[]> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select({
      id: emailAudience.id,
      slug: emailAudience.slug,
      name: emailAudience.name,
      description: emailAudience.description,
      evaluationMode: emailAudience.evaluationMode,
      createdBy: emailAudience.createdBy,
      createdAt: emailAudience.createdAt,
      snapshotCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${emailAudienceSnapshot}
        WHERE ${emailAudienceSnapshot.audienceId} = ${emailAudience.id}
      )`,
    })
    .from(emailAudience)
    .where(isNull(emailAudience.deletedAt))
    .orderBy(desc(emailAudience.createdAt));
  return rows as AudienceListItem[];
}
