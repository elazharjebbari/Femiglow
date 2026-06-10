import { and, asc, desc, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { db, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import {
  socialAccounts,
  socialPublishAttempts,
  socialPublishEvents,
  socialPublishJobs,
  socialPublications,
} from '@/lib/db/schema-social-publishing';
import type {
  SocialAccount,
  SocialPlatform,
  SocialProviderId,
  SocialPublishContent,
  SocialPublishErrorCode,
  SocialPublishJob,
  SocialPublishJobStatus,
  SocialPublishAttempt,
  SocialPublication,
  SocialPublishEvent,
  SocialFormat,
} from './contracts';

interface Store {
  socialAccounts: Map<string, SocialAccount>;
  socialPublishJobs: Map<string, SocialPublishJob>;
  socialPublishAttempts: Map<string, SocialPublishAttempt>;
  socialPublications: Map<string, SocialPublication>;
  socialPublishEvents: Map<string, SocialPublishEvent>;
}

function store(): Store {
  const s = memoryStore() as unknown as Store & Record<string, unknown>;
  if (!s.socialAccounts) s.socialAccounts = new Map();
  if (!s.socialPublishJobs) s.socialPublishJobs = new Map();
  if (!s.socialPublishAttempts) s.socialPublishAttempts = new Map();
  if (!s.socialPublications) s.socialPublications = new Map();
  if (!s.socialPublishEvents) s.socialPublishEvents = new Map();
  return s;
}

function rowAccount(row: typeof socialAccounts.$inferSelect): SocialAccount {
  return {
    id: row.id,
    provider: row.provider,
    platform: row.platform,
    remoteId: row.remoteId,
    name: row.name,
    status: row.status,
    capabilities: row.capabilities as SocialAccount['capabilities'],
  };
}

function rowJob(row: typeof socialPublishJobs.$inferSelect): SocialPublishJob {
  return {
    id: row.id,
    postId: row.postId,
    accountId: row.accountId,
    provider: row.provider,
    platform: row.platform,
    format: row.format,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    content: row.content as SocialPublishContent,
    scheduledAt: row.scheduledAt,
    publishedAt: row.publishedAt,
    lockedAt: row.lockedAt,
    attemptCount: row.attemptCount,
    lastError: row.lastError as SocialPublishJob['lastError'],
    requestedBy: row.requestedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowAttempt(row: typeof socialPublishAttempts.$inferSelect): SocialPublishAttempt {
  return {
    id: row.id,
    jobId: row.jobId,
    attemptNumber: row.attemptNumber,
    provider: row.provider,
    status: row.status,
    request: row.request as Record<string, unknown>,
    response: row.response as Record<string, unknown>,
    error: row.error as SocialPublishAttempt['error'],
    durationMs: row.durationMs,
    createdAt: row.createdAt,
  };
}

function rowPublication(row: typeof socialPublications.$inferSelect): SocialPublication {
  return {
    id: row.id,
    jobId: row.jobId,
    postId: row.postId,
    accountId: row.accountId,
    provider: row.provider,
    platform: row.platform,
    remoteId: row.remoteId,
    permalink: row.permalink,
    status: row.status,
    publishedAt: row.publishedAt,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

function rowEvent(row: typeof socialPublishEvents.$inferSelect): SocialPublishEvent {
  return {
    id: row.id,
    jobId: row.jobId,
    type: row.type,
    actorId: row.actorId,
    message: row.message,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = /token|secret|password|authorization|api[_-]?key/i.test(key)
      ? '[redacted]'
      : redactSecrets(nested);
  }
  return out;
}

export async function upsertSocialAccount(input: {
  id?: string;
  provider: SocialProviderId;
  platform: SocialPlatform;
  remoteId: string;
  name: string;
  status?: SocialAccount['status'];
  capabilities?: SocialAccount['capabilities'];
}): Promise<SocialAccount> {
  const now = new Date();
  const account: SocialAccount = {
    id: input.id ?? createId('sa'),
    provider: input.provider,
    platform: input.platform,
    remoteId: input.remoteId,
    name: input.name,
    status: input.status ?? 'active',
    capabilities: input.capabilities ?? [],
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(socialAccounts).values({
      ...account,
      capabilities: account.capabilities as never,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [socialAccounts.provider, socialAccounts.remoteId],
      set: {
        platform: account.platform,
        name: account.name,
        status: account.status,
        capabilities: account.capabilities as never,
        updatedAt: now,
      },
    });
    const rows = await drizzle.select().from(socialAccounts).where(and(
      eq(socialAccounts.provider, account.provider),
      eq(socialAccounts.remoteId, account.remoteId),
    )).limit(1);
    return rows[0] ? rowAccount(rows[0]) : account;
  }
  const existing = Array.from(store().socialAccounts.values()).find(
    (item) => item.provider === account.provider && item.remoteId === account.remoteId,
  );
  const finalAccount = existing ? { ...existing, ...account, id: existing.id } : account;
  store().socialAccounts.set(finalAccount.id, finalAccount);
  return finalAccount;
}

export async function listSocialAccounts(filters: {
  provider?: SocialProviderId;
  platform?: SocialPlatform;
  status?: SocialAccount['status'];
} = {}): Promise<SocialAccount[]> {
  const drizzle = db();
  if (drizzle) {
    const conditions = [];
    if (filters.provider) conditions.push(eq(socialAccounts.provider, filters.provider));
    if (filters.platform) conditions.push(eq(socialAccounts.platform, filters.platform));
    if (filters.status) conditions.push(eq(socialAccounts.status, filters.status));
    const rows = await drizzle.select().from(socialAccounts).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(socialAccounts.updatedAt));
    return rows.map(rowAccount);
  }
  return Array.from(store().socialAccounts.values()).filter((account) =>
    (!filters.provider || account.provider === filters.provider) &&
    (!filters.platform || account.platform === filters.platform) &&
    (!filters.status || account.status === filters.status)
  );
}

export async function getSocialAccount(id: string): Promise<SocialAccount | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(socialAccounts).where(eq(socialAccounts.id, id)).limit(1);
    return rows[0] ? rowAccount(rows[0]) : null;
  }
  return store().socialAccounts.get(id) ?? null;
}

export async function createPublishJob(input: {
  postId: string;
  accountId: string;
  provider: SocialProviderId;
  platform: SocialPlatform;
  format: SocialFormat;
  idempotencyKey: string;
  content: SocialPublishContent;
  status?: SocialPublishJobStatus;
  scheduledAt?: Date | null;
  requestedBy?: string | null;
}): Promise<SocialPublishJob> {
  const existing = await findPublishJobByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;
  const now = new Date();
  const job: SocialPublishJob = {
    id: createId('spj'),
    postId: input.postId,
    accountId: input.accountId,
    provider: input.provider,
    platform: input.platform,
    format: input.format,
    status: input.status ?? 'queued',
    idempotencyKey: input.idempotencyKey,
    content: input.content,
    scheduledAt: input.scheduledAt ?? null,
    publishedAt: null,
    lockedAt: null,
    attemptCount: 0,
    lastError: null,
    requestedBy: input.requestedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(socialPublishJobs).values({
      ...job,
      content: job.content as never,
      lastError: job.lastError as never,
    });
  } else {
    store().socialPublishJobs.set(job.id, job);
  }
  await recordPublishEvent({ jobId: job.id, type: 'job.created', actorId: job.requestedBy, message: 'Publication job created' });
  return job;
}

export async function findPublishJobByIdempotencyKey(idempotencyKey: string): Promise<SocialPublishJob | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(socialPublishJobs).where(eq(socialPublishJobs.idempotencyKey, idempotencyKey)).limit(1);
    return rows[0] ? rowJob(rows[0]) : null;
  }
  return Array.from(store().socialPublishJobs.values()).find((job) => job.idempotencyKey === idempotencyKey) ?? null;
}

export async function getPublishJob(id: string): Promise<SocialPublishJob | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(socialPublishJobs).where(eq(socialPublishJobs.id, id)).limit(1);
    return rows[0] ? rowJob(rows[0]) : null;
  }
  return store().socialPublishJobs.get(id) ?? null;
}

export async function listPublishJobs(filters: {
  status?: SocialPublishJobStatus;
  postId?: string;
  accountId?: string;
} = {}): Promise<SocialPublishJob[]> {
  const drizzle = db();
  if (drizzle) {
    const conditions = [];
    if (filters.status) conditions.push(eq(socialPublishJobs.status, filters.status));
    if (filters.postId) conditions.push(eq(socialPublishJobs.postId, filters.postId));
    if (filters.accountId) conditions.push(eq(socialPublishJobs.accountId, filters.accountId));
    const rows = await drizzle.select().from(socialPublishJobs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(socialPublishJobs.createdAt));
    return rows.map(rowJob);
  }
  return Array.from(store().socialPublishJobs.values())
    .filter((job) =>
      (!filters.status || job.status === filters.status) &&
      (!filters.postId || job.postId === filters.postId) &&
      (!filters.accountId || job.accountId === filters.accountId),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function tryAcquirePublishJobLock(input: {
  jobId: string;
  allowedFromStatuses: SocialPublishJobStatus[];
}): Promise<SocialPublishJob | null> {
  const now = new Date();
  const drizzle = db();
  if (drizzle) {
    const updated = await drizzle
      .update(socialPublishJobs)
      .set({ status: 'publishing', lockedAt: now, updatedAt: now })
      .where(
        and(
          eq(socialPublishJobs.id, input.jobId),
          inArray(socialPublishJobs.status, input.allowedFromStatuses),
          isNull(socialPublishJobs.lockedAt),
        ),
      )
      .returning();
    const row = updated[0];
    if (!row) return null;
    const job = rowJob(row);
    await recordPublishEvent({
      jobId: job.id,
      type: 'job.publishing',
      actorId: job.requestedBy,
      message: 'Publication job locked for execution',
    });
    return job;
  }
  const current = store().socialPublishJobs.get(input.jobId);
  if (!current) return null;
  if (!input.allowedFromStatuses.includes(current.status)) return null;
  if (current.lockedAt) return null;
  const locked: SocialPublishJob = {
    ...current,
    status: 'publishing',
    lockedAt: now,
    updatedAt: now,
  };
  store().socialPublishJobs.set(locked.id, locked);
  await recordPublishEvent({
    jobId: locked.id,
    type: 'job.publishing',
    actorId: locked.requestedBy,
    message: 'Publication job locked for execution',
  });
  return locked;
}

export async function listScheduledJobsDue(input: {
  now: Date;
  limit: number;
}): Promise<SocialPublishJob[]> {
  const limit = Math.max(1, Math.min(input.limit, 50));
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(socialPublishJobs)
      .where(
        and(
          eq(socialPublishJobs.status, 'queued'),
          isNotNull(socialPublishJobs.scheduledAt),
          lte(socialPublishJobs.scheduledAt, input.now),
          isNull(socialPublishJobs.lockedAt),
        ),
      )
      .orderBy(asc(socialPublishJobs.scheduledAt))
      .limit(limit);
    return rows.map(rowJob);
  }
  return Array.from(store().socialPublishJobs.values())
    .filter(
      (job) =>
        job.status === 'queued' &&
        job.scheduledAt !== null &&
        job.scheduledAt.getTime() <= input.now.getTime() &&
        job.lockedAt === null,
    )
    .sort((a, b) => (a.scheduledAt!.getTime() - b.scheduledAt!.getTime()))
    .slice(0, limit);
}

export async function updatePublishJobStatus(input: {
  jobId: string;
  status: SocialPublishJobStatus;
  lockedAt?: Date | null;
  publishedAt?: Date | null;
  lastError?: { code: SocialPublishErrorCode; message: string; retryable: boolean } | null;
}): Promise<SocialPublishJob | null> {
  const current = await getPublishJob(input.jobId);
  if (!current) return null;
  const updated: SocialPublishJob = {
    ...current,
    status: input.status,
    lockedAt: input.lockedAt !== undefined ? input.lockedAt : current.lockedAt,
    publishedAt: input.publishedAt !== undefined ? input.publishedAt : current.publishedAt,
    lastError: input.lastError !== undefined ? input.lastError : current.lastError,
    updatedAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.update(socialPublishJobs).set({
      status: updated.status,
      lockedAt: updated.lockedAt,
      publishedAt: updated.publishedAt,
      lastError: updated.lastError as never,
      updatedAt: updated.updatedAt,
    }).where(eq(socialPublishJobs.id, input.jobId));
  } else {
    store().socialPublishJobs.set(updated.id, updated);
  }
  await recordPublishEvent({ jobId: updated.id, type: `job.${updated.status}`, actorId: updated.requestedBy, message: `Publication job moved to ${updated.status}` });
  return updated;
}

/**
 * Re-cible la date d'exécution d'un job queued (re-programmation d'un post).
 * Met à jour job.scheduledAt ET content.scheduledAt (le snapshot porté par
 * l'adapter) pour que les deux restent cohérents.
 */
export async function updatePublishJobSchedule(input: {
  jobId: string;
  scheduledAt: Date;
}): Promise<SocialPublishJob | null> {
  const current = await getPublishJob(input.jobId);
  if (!current) return null;
  const content = { ...current.content, scheduledAt: input.scheduledAt };
  const updated: SocialPublishJob = {
    ...current,
    scheduledAt: input.scheduledAt,
    content,
    updatedAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.update(socialPublishJobs).set({
      scheduledAt: updated.scheduledAt,
      content: updated.content as never,
      updatedAt: updated.updatedAt,
    }).where(eq(socialPublishJobs.id, input.jobId));
  } else {
    store().socialPublishJobs.set(updated.id, updated);
  }
  await recordPublishEvent({
    jobId: updated.id,
    type: 'job.rescheduled',
    actorId: updated.requestedBy,
    message: `Publication job rescheduled to ${input.scheduledAt.toISOString()}`,
  });
  return updated;
}

export async function recordPublishAttempt(input: {
  jobId: string;
  provider: SocialProviderId;
  status: 'succeeded' | 'failed';
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: SocialPublishAttempt['error'];
  durationMs?: number | null;
}): Promise<SocialPublishAttempt> {
  const job = await getPublishJob(input.jobId);
  if (!job) throw new Error(`social publish job not found: ${input.jobId}`);
  const attempt: SocialPublishAttempt = {
    id: createId('spa'),
    jobId: input.jobId,
    attemptNumber: job.attemptCount + 1,
    provider: input.provider,
    status: input.status,
    request: redactSecrets(input.request ?? {}) as Record<string, unknown>,
    response: redactSecrets(input.response ?? {}) as Record<string, unknown>,
    error: input.error ? redactSecrets(input.error) as SocialPublishAttempt['error'] : null,
    durationMs: input.durationMs ?? null,
    createdAt: new Date(),
  };
  const updatedJob = { ...job, attemptCount: attempt.attemptNumber, updatedAt: new Date() };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(socialPublishAttempts).values({ ...attempt, request: attempt.request as never, response: attempt.response as never, error: attempt.error as never });
    await drizzle.update(socialPublishJobs).set({ attemptCount: updatedJob.attemptCount, updatedAt: updatedJob.updatedAt }).where(eq(socialPublishJobs.id, job.id));
  } else {
    store().socialPublishAttempts.set(attempt.id, attempt);
    store().socialPublishJobs.set(job.id, updatedJob);
  }
  return attempt;
}

export async function createPublication(input: {
  jobId: string;
  postId: string;
  accountId: string;
  provider: SocialProviderId;
  platform: SocialPlatform;
  remoteId: string;
  permalink?: string | null;
  publishedAt: Date;
  metadata?: Record<string, unknown>;
}): Promise<SocialPublication> {
  const publication: SocialPublication = {
    id: createId('sp'),
    jobId: input.jobId,
    postId: input.postId,
    accountId: input.accountId,
    provider: input.provider,
    platform: input.platform,
    remoteId: input.remoteId,
    permalink: input.permalink ?? null,
    status: 'published',
    publishedAt: input.publishedAt,
    metadata: redactSecrets(input.metadata ?? {}) as Record<string, unknown>,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(socialPublications).values({ ...publication, metadata: publication.metadata as never });
  } else {
    store().socialPublications.set(publication.id, publication);
  }
  await recordPublishEvent({ jobId: input.jobId, type: 'publication.created', actorId: null, message: 'External publication recorded', metadata: { remoteId: input.remoteId } });
  return publication;
}

export async function listPublicationsForPost(postId: string): Promise<SocialPublication[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(socialPublications).where(eq(socialPublications.postId, postId)).orderBy(desc(socialPublications.createdAt));
    return rows.map(rowPublication);
  }
  return Array.from(store().socialPublications.values()).filter((publication) => publication.postId === postId);
}

export async function recordPublishEvent(input: {
  jobId: string;
  type: string;
  actorId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<SocialPublishEvent> {
  const event: SocialPublishEvent = {
    id: createId('spe'),
    jobId: input.jobId,
    type: input.type,
    actorId: input.actorId ?? null,
    message: input.message,
    metadata: redactSecrets(input.metadata ?? {}) as Record<string, unknown>,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(socialPublishEvents).values({ ...event, metadata: event.metadata as never });
  } else {
    store().socialPublishEvents.set(event.id, event);
  }
  return event;
}

export async function listPublishEvents(jobId: string): Promise<SocialPublishEvent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(socialPublishEvents).where(eq(socialPublishEvents.jobId, jobId)).orderBy(desc(socialPublishEvents.createdAt));
    return rows.map(rowEvent);
  }
  return Array.from(store().socialPublishEvents.values())
    .filter((event) => event.jobId === jobId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
