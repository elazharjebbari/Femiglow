import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { createContentIdea } from '@/lib/content-studio/service';
import {
  approveDraft,
  createBrief,
  createDrafts,
  upsertPrimaryAsset,
} from '@/lib/content-studio/repository';
import {
  createPublishJob,
  upsertSocialAccount,
} from '@/lib/social-publishing/repository';
import type { SocialPublishContent } from '@/lib/social-publishing/contracts';
import { POST } from './route';

const content: SocialPublishContent = {
  sourcePostId: 'cp_route',
  platform: 'instagram',
  format: 'post',
  caption: 'Routine FemiGlow route',
  media: [
    {
      id: 'me_route',
      url: 'https://cdn.femiglow.test/route.png',
      mimeType: 'image/png',
      width: 1024,
      height: 1024,
      alt: 'Routine route',
    },
  ],
  tags: ['routine'],
};

async function setupApprovedPostAndAccount() {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format: 'post',
    prompt: 'Cron route test.',
    actorId: 'adm_cron',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Cron',
    cta: 'Découvrir',
    actorId: 'adm_cron',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format: 'post',
      variantLabel: 'A',
      caption: 'Routine cron',
      altText: 'Cron test',
      hashtags: ['routine'],
    },
  ]);
  if (!draft) throw new Error('Draft fixture missing');
  const media = await createMedia({
    kind: 'image',
    source: 'upload',
    slug: `cron-${draft.id}`,
    alt: 'Cron test',
    originalUrl: 'https://cdn.femiglow.test/route.png',
    originalMime: 'image/png',
    originalWidth: 1024,
    originalHeight: 1024,
    status: 'ready',
  });
  await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
  const post = await approveDraft({ draftId: draft.id, actorId: 'adm_cron' });
  const account = await upsertSocialAccount({
    provider: 'dry_run',
    platform: 'instagram',
    remoteId: 'ig_cron',
    name: 'IG cron test',
  });
  return { post, account };
}

function bearer(secret?: string): Headers {
  const h = new Headers();
  h.set('content-type', 'application/json');
  if (secret) h.set('authorization', `Bearer ${secret}`);
  return h;
}

beforeEach(() => {
  resetMemoryStore();
});

describe('POST /api/cron/content-studio/social-publish-scheduler', () => {
  it('rejette sans Bearer (401)', async () => {
    const res = await POST(
      new Request('http://x/api/cron/content-studio/social-publish-scheduler', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejette avec un mauvais Bearer (401)', async () => {
    const res = await POST(
      new Request('http://x/api/cron/content-studio/social-publish-scheduler', {
        method: 'POST',
        headers: bearer('wrong-secret'),
        body: '{}',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('200 avec checked=0 quand aucun job dû', async () => {
    const res = await POST(
      new Request('http://x/api/cron/content-studio/social-publish-scheduler', {
        method: 'POST',
        headers: bearer(process.env.CRON_SECRET),
        body: '{}',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checked: number; executed: number };
    expect(body.checked).toBe(0);
    expect(body.executed).toBe(0);
  });

  it('200 et exécute le job dû', async () => {
    const { post, account } = await setupApprovedPostAndAccount();
    await createPublishJob({
      postId: post.id,
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'cron:route:1',
      content: { ...content, sourcePostId: post.id },
      scheduledAt: new Date(Date.now() - 60_000),
    });

    const res = await POST(
      new Request('http://x/api/cron/content-studio/social-publish-scheduler', {
        method: 'POST',
        headers: bearer(process.env.CRON_SECRET),
        body: JSON.stringify({ limit: 5 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checked: number; executed: number; succeeded: number };
    expect(body.checked).toBe(1);
    expect(body.executed).toBe(1);
    expect(body.succeeded).toBe(1);
  });

  it('200 accepte un body vide (limit défaut)', async () => {
    const res = await POST(
      new Request('http://x/api/cron/content-studio/social-publish-scheduler', {
        method: 'POST',
        headers: bearer(process.env.CRON_SECRET),
      }),
    );
    expect(res.status).toBe(200);
  });
});
