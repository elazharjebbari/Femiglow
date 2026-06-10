import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { createContentIdea } from '@/lib/content-studio/service';
import {
  approveDraft,
  cancelPost,
  createBrief,
  createDrafts,
  upsertPrimaryAsset,
} from '@/lib/content-studio/repository';
import { executeJob } from '@/lib/social-publishing/admin-service';
import { listPublishJobs, listPublicationsForPost } from '@/lib/social-publishing/repository';
import { runScheduledPublishJobs } from '@/lib/social-publishing/worker';
import { POST as syncAccounts } from '@/app/api/admin/social/accounts/route';
import { POST as schedulePost } from './schedule/route';
import { POST as cancelPostRoute } from './cancel/route';
import { PATCH as reschedulePostRoute } from './reschedule/route';

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn(),
  requireContentStudioEnabled: vi.fn(),
}));

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const requireContentStudioEnabledMock = requireContentStudioEnabled as unknown as ReturnType<typeof vi.fn>;

function adminSession() {
  return {
    adminId: 'adm_cancel_resched',
    email: 'admin@femiglow.local',
    issuedAt: 0,
    expiresAt: Date.now() + 60_000,
  };
}

async function approvedInstagramPost() {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format: 'post',
    prompt: 'Créer un post social dry-run.',
    actorId: 'adm_cancel_resched',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Routine du soir',
    cta: 'Découvrir le kit',
    actorId: 'adm_cancel_resched',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format: 'post',
      variantLabel: 'A',
      caption: 'Routine FemiGlow du soir #routine',
      altText: 'Routine skincare FemiGlow',
      hashtags: ['routine', 'femiglow'],
    },
  ]);
  if (!draft) throw new Error('Draft fixture missing');
  const media = await createMedia({
    kind: 'image',
    source: 'upload',
    slug: `cancel-resched-${draft.id}`,
    alt: 'Routine skincare',
    originalUrl: 'https://cdn.femiglow.test/cancel-resched.png',
    originalMime: 'image/png',
    originalWidth: 1024,
    originalHeight: 1024,
    status: 'ready',
  });
  await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
  return approveDraft({ draftId: draft.id, actorId: 'adm_cancel_resched' });
}

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function inHours(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

async function scheduleAt(postId: string, scheduledAt: Date): Promise<Response> {
  return schedulePost(
    jsonRequest(`http://localhost/api/admin/content-studio/posts/${postId}/schedule`, 'POST', {
      scheduledAt: scheduledAt.toISOString(),
    }),
    { params: { id: postId } },
  );
}

beforeEach(() => {
  resetMemoryStore();
  vi.clearAllMocks();
  requireContentStudioEnabledMock.mockReturnValue(undefined);
  requireAdminApiMock.mockResolvedValue(adminSession());
});

describe('annulation de post — purge des jobs de publication (P1-1)', () => {
  it('annuler un post programmé annule son job queued et le cron ne publie plus rien', async () => {
    await syncAccounts();
    const post = await approvedInstagramPost();
    const when = inHours(2);

    const scheduled = await scheduleAt(post.id, when);
    expect(scheduled.status).toBe(201);
    const queuedBefore = await listPublishJobs({ postId: post.id, status: 'queued' });
    expect(queuedBefore).toHaveLength(1);

    const cancelled = await cancelPostRoute(
      jsonRequest(`http://localhost/api/admin/content-studio/posts/${post.id}/cancel`, 'POST', {
        reason: 'changement de plan',
      }),
      { params: { id: post.id } },
    );
    expect(cancelled.status).toBe(200);
    await expect(cancelled.json()).resolves.toMatchObject({ post: { status: 'cancelled' } });

    const jobs = await listPublishJobs({ postId: post.id });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.status).toBe('cancelled');

    // Le cron passe APRÈS la date prévue : il ne doit rien exécuter ni publier.
    const run = await runScheduledPublishJobs({ now: new Date(when.getTime() + 3_600_000) });
    expect(run.executed).toBe(0);
    expect(run.succeeded).toBe(0);
    const publications = await listPublicationsForPost(post.id);
    expect(publications).toHaveLength(0);
  });

  it('executeJob refuse un job dont le post source a été annulé entre-temps', async () => {
    await syncAccounts();
    const post = await approvedInstagramPost();
    await scheduleAt(post.id, inHours(2));
    const [job] = await listPublishJobs({ postId: post.id, status: 'queued' });
    expect(job).toBeDefined();

    // Annulation directe en base (contourne la purge du service) : c'est la
    // défense en profondeur d'executeJob qui doit bloquer.
    await cancelPost(post.id, 'annulé hors flux', null);

    const { job: after, result } = await executeJob({ jobId: job!.id, actorId: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain('Post source');
    }
    expect(after.status).toBe('failed');
    expect(await listPublicationsForPost(post.id)).toHaveLength(0);
  });
});

describe('re-programmation de post — re-ciblage des jobs (P1-1)', () => {
  it('reschedule re-cible le job queued sur la nouvelle date (job + snapshot)', async () => {
    await syncAccounts();
    const post = await approvedInstagramPost();
    await scheduleAt(post.id, inHours(2));
    const newDate = inHours(4);

    const res = await reschedulePostRoute(
      jsonRequest(`http://localhost/api/admin/content-studio/posts/${post.id}/reschedule`, 'PATCH', {
        scheduledAt: newDate.toISOString(),
      }),
      { params: { id: post.id } },
    );
    expect(res.status).toBe(200);

    const queued = await listPublishJobs({ postId: post.id, status: 'queued' });
    expect(queued).toHaveLength(1);
    expect(new Date(queued[0]!.scheduledAt!).toISOString()).toBe(newDate.toISOString());
    expect(new Date(queued[0]!.content.scheduledAt as string | Date).toISOString()).toBe(
      newDate.toISOString(),
    );
  });

  it('reschedule refuse une date passée (400)', async () => {
    await syncAccounts();
    const post = await approvedInstagramPost();
    await scheduleAt(post.id, inHours(2));

    const res = await reschedulePostRoute(
      jsonRequest(`http://localhost/api/admin/content-studio/posts/${post.id}/reschedule`, 'PATCH', {
        scheduledAt: new Date(Date.now() - 3_600_000).toISOString(),
      }),
      { params: { id: post.id } },
    );
    expect(res.status).toBe(400);
  });

  it('programmer deux fois ne laisse qu’un seul job actif (anti-double-publication)', async () => {
    await syncAccounts();
    const post = await approvedInstagramPost();
    const date1 = inHours(2);
    const date2 = inHours(6);

    expect((await scheduleAt(post.id, date1)).status).toBe(201);
    expect((await scheduleAt(post.id, date2)).status).toBe(201);

    const jobs = await listPublishJobs({ postId: post.id });
    const queued = jobs.filter((j) => j.status === 'queued');
    const cancelledJobs = jobs.filter((j) => j.status === 'cancelled');
    expect(queued).toHaveLength(1);
    expect(cancelledJobs).toHaveLength(1);
    expect(new Date(queued[0]!.scheduledAt!).toISOString()).toBe(date2.toISOString());
  });
});
