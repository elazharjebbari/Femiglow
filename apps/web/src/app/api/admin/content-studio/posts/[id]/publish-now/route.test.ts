import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { HttpError } from '@/lib/errors/http-error';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { createContentIdea } from '@/lib/content-studio/service';
import { approveDraft, createBrief, createDrafts, upsertPrimaryAsset } from '@/lib/content-studio/repository';
import { GET as getAccounts, POST as syncAccounts } from '@/app/api/admin/social/accounts/route';
import { GET as getPublishability } from '../publishability/route';
import { POST as publishNow } from './route';
import { GET as listJobs } from '@/app/api/admin/content-studio/publish-jobs/route';
import { GET as getJob } from '@/app/api/admin/content-studio/publish-jobs/[id]/route';
import { POST as schedulePost } from '@/app/api/admin/content-studio/posts/[id]/schedule/route';
import { POST as cancelJob } from '@/app/api/admin/content-studio/publish-jobs/[id]/cancel/route';

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn(),
  requireContentStudioEnabled: vi.fn(),
}));

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const requireContentStudioEnabledMock = requireContentStudioEnabled as unknown as ReturnType<typeof vi.fn>;

function adminSession() {
  return {
    adminId: 'adm_social_publish',
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
    actorId: 'adm_social_publish',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Routine du soir',
    cta: 'Découvrir le kit',
    actorId: 'adm_social_publish',
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
    slug: `social-test-${draft.id}`,
    alt: 'Routine skincare',
    originalUrl: 'https://cdn.femiglow.test/social-test.png',
    originalMime: 'image/png',
    originalWidth: 1024,
    originalHeight: 1024,
    status: 'ready',
  });
  await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
  return approveDraft({ draftId: draft.id, actorId: 'adm_social_publish' });
}

function request(url: string, body?: unknown, key?: string): Request {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  resetMemoryStore();
  vi.clearAllMocks();
  requireContentStudioEnabledMock.mockReturnValue(undefined);
  requireAdminApiMock.mockResolvedValue(adminSession());
});

describe('social publishing admin routes dry-run', () => {
  it('synchronise et liste les comptes dry-run sans secret', async () => {
    const synced = await syncAccounts();
    expect(synced.status).toBe(200);
    const listed = await getAccounts(request('http://localhost/api/admin/social/accounts'));
    const body = (await listed.json()) as { accounts: Array<{ provider: string; platform: string; remoteId: string }> };

    expect(body.accounts).toHaveLength(2);
    expect(body.accounts.map((account) => `${account.provider}:${account.platform}`)).toEqual([
      'dry_run:instagram',
      'dry_run:facebook',
    ]);
    expect(JSON.stringify(body)).not.toMatch(/token|secret/i);
  });

  it('publie immédiatement en dry-run et rend le job consultable', async () => {
    const post = await approvedInstagramPost();
    await syncAccounts();

    const publishable = await getPublishability(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/publishability`),
      { params: { id: post.id } },
    );
    expect(publishable.status).toBe(200);
    await expect(publishable.json()).resolves.toMatchObject({ publishability: { publishable: true } });

    const first = await publishNow(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/publish-now`, {}, 'dry-route-key'),
      { params: { id: post.id } },
    );
    const second = await publishNow(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/publish-now`, {}, 'dry-route-key'),
      { params: { id: post.id } },
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = (await first.json()) as { job: { id: string; status: string; attemptCount: number }; result: { ok: boolean } };
    const secondBody = (await second.json()) as { job: { id: string; status: string; attemptCount: number }; result: { ok: boolean } };
    expect(firstBody.job.id).toBe(secondBody.job.id);
    expect(secondBody.job.status).toBe('published');
    expect(secondBody.result.ok).toBe(true);

    const listed = await listJobs(request('http://localhost/api/admin/content-studio/publish-jobs?status=published'));
    const listedBody = (await listed.json()) as { jobs: Array<{ job: { id: string }; publications: unknown[] }> };
    expect(listedBody.jobs).toHaveLength(1);
    expect(listedBody.jobs[0]?.job.id).toBe(firstBody.job.id);
    expect(listedBody.jobs[0]?.publications).toHaveLength(1);

    const detail = await getJob(request(`http://localhost/api/admin/content-studio/publish-jobs/${firstBody.job.id}`), {
      params: { id: firstBody.job.id },
    });
    await expect(detail.json()).resolves.toMatchObject({ job: { status: 'published' } });
  });

  it('programme puis annule un job dry-run futur', async () => {
    const post = await approvedInstagramPost();
    await syncAccounts();
    const scheduledAt = new Date(Date.now() + 3_600_000).toISOString();

    const scheduled = await schedulePost(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/schedule`, { scheduledAt }, 'dry-schedule-key'),
      { params: { id: post.id } },
    );
    expect(scheduled.status).toBe(201);
    const scheduledBody = (await scheduled.json()) as { job: { id: string; status: string; scheduledAt: string } };
    expect(scheduledBody.job.status).toBe('queued');

    const cancelled = await cancelJob(
      request(`http://localhost/api/admin/content-studio/publish-jobs/${scheduledBody.job.id}/cancel`, {}),
      { params: { id: scheduledBody.job.id } },
    );
    expect(cancelled.status).toBe(200);
    await expect(cancelled.json()).resolves.toMatchObject({ job: { status: 'cancelled' } });
  });

  it('renvoie 401 sans session admin', async () => {
    requireAdminApiMock.mockRejectedValueOnce(new HttpError('unauthorized', 'Session expirée.'));
    const response = await getAccounts(request('http://localhost/api/admin/social/accounts'));
    expect(response.status).toBe(401);
  });
});
