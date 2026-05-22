import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { HttpError } from '@/lib/errors/http-error';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { createContentIdea } from '@/lib/content-studio/service';
import {
  approveDraft,
  createBrief,
  createDrafts,
  upsertPrimaryAsset,
} from '@/lib/content-studio/repository';
import { POST as syncAccounts } from '@/app/api/admin/social/accounts/route';
import { POST as draftOnProvider } from './route';
import { POST as publishNow } from '../publish-now/route';
import { listPublishJobs } from '@/lib/social-publishing/repository';
import { memoryStore } from '@/lib/db/client';

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn(),
  requireContentStudioEnabled: vi.fn(),
}));

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const requireContentStudioEnabledMock = requireContentStudioEnabled as unknown as ReturnType<typeof vi.fn>;

function adminSession() {
  return {
    adminId: 'adm_draft_test',
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
    prompt: 'Brouillon test',
    actorId: 'adm_draft_test',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Routine du soir',
    cta: 'Découvrir le kit',
    actorId: 'adm_draft_test',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format: 'post',
      variantLabel: 'A',
      caption: 'Routine FemiGlow du soir',
      altText: 'Routine skincare',
      hashtags: ['routine'],
    },
  ]);
  if (!draft) throw new Error('draft fixture missing');
  const media = await createMedia({
    kind: 'image',
    source: 'upload',
    slug: `draft-test-${draft.id}`,
    alt: 'Routine skincare',
    originalUrl: 'https://cdn.femiglow.test/draft-test.png',
    originalMime: 'image/png',
    originalWidth: 1024,
    originalHeight: 1024,
    status: 'ready',
  });
  await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
  return approveDraft({ draftId: draft.id, actorId: 'adm_draft_test' });
}

function request(url: string, body?: unknown, idempotencyKey?: string): Request {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
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

describe('POST /api/admin/content-studio/posts/[id]/draft-on-provider', () => {
  it('envoie un post en brouillon dry-run et marque content.publishMode=draft', async () => {
    const post = await approvedInstagramPost();
    await syncAccounts();

    const res = await draftOnProvider(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/draft-on-provider`, {}, 'idem-draft-1'),
      { params: { id: post.id } },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      job: { id: string; status: string; idempotencyKey: string; content: { publishMode: string } };
      result: { ok: boolean };
    };
    expect(body.job.status).toBe('published');
    expect(body.job.content.publishMode).toBe('draft');
    expect(body.result.ok).toBe(true);

    // Verify exactly one job stored
    const jobs = await listPublishJobs({ postId: post.id });
    expect(jobs).toHaveLength(1);
  });

  it('idempotent sur Idempotency-Key: deux appels back-to-back ⇒ un seul job', async () => {
    const post = await approvedInstagramPost();
    await syncAccounts();

    const first = await draftOnProvider(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/draft-on-provider`, {}, 'idem-draft-2'),
      { params: { id: post.id } },
    );
    const second = await draftOnProvider(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/draft-on-provider`, {}, 'idem-draft-2'),
      { params: { id: post.id } },
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = (await first.json()) as { job: { id: string } };
    const secondBody = (await second.json()) as { job: { id: string } };
    expect(firstBody.job.id).toBe(secondBody.job.id);
  });

  it('crée deux jobs distincts pour draft vs publish-now sur le même post', async () => {
    const post = await approvedInstagramPost();
    await syncAccounts();

    const draftRes = await draftOnProvider(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/draft-on-provider`, {}),
      { params: { id: post.id } },
    );
    const publishRes = await publishNow(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/publish-now`, {}),
      { params: { id: post.id } },
    );
    expect(draftRes.status).toBe(201);
    expect(publishRes.status).toBe(201);

    const jobs = await listPublishJobs({ postId: post.id });
    expect(jobs).toHaveLength(2);
    const modes = jobs.map((j) => j.content.publishMode).sort();
    expect(modes).toEqual(['draft', 'now']);
  });

  it('renvoie 401 sans session admin', async () => {
    requireAdminApiMock.mockRejectedValueOnce(new HttpError('unauthorized', 'Session expirée.'));
    const res = await draftOnProvider(
      request('http://localhost/api/admin/content-studio/posts/po_x/draft-on-provider', {}),
      { params: { id: 'po_x' } },
    );
    expect(res.status).toBe(401);
  });

  it('émet un audit event social.draft_created en cas de succès', async () => {
    const post = await approvedInstagramPost();
    await syncAccounts();
    const res = await draftOnProvider(
      request(`http://localhost/api/admin/content-studio/posts/${post.id}/draft-on-provider`, {}),
      { params: { id: post.id } },
    );
    expect(res.status).toBe(201);
    const auditEvents = Array.from(
      (memoryStore() as unknown as { auditEvents?: Map<string, { action: string; resourceId: string | null }> }).auditEvents?.values() ?? [],
    );
    const draftEvents = auditEvents.filter((e) => e.action === 'social.draft_created');
    expect(draftEvents).toHaveLength(1);
    expect(draftEvents[0]?.resourceId).toBe(post.id);
  });

  it('renvoie 404 si le post n’existe pas', async () => {
    await syncAccounts();
    const res = await draftOnProvider(
      request('http://localhost/api/admin/content-studio/posts/po_ghost/draft-on-provider', {}),
      { params: { id: 'po_ghost' } },
    );
    expect(res.status).toBe(404);
  });
});
