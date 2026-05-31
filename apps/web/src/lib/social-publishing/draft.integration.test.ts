/**
 * S2.3 phase e — Integration test for the draft-mode chain via MSW.
 *
 * Goes one level deeper than the adapter unit tests: exercises the *real*
 * `createPostizDraft` + `uploadPostizMediaFromUrl` HTTP helpers against
 * MSW-stubbed Postiz endpoints, so any regression in the wire format
 * (payload shape, headers, type field) trips this test.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';
import { postizPostsHandler } from '@/test/msw/postiz-handlers';
import type { SocialAccount, SocialPublishRequest } from './contracts';

const POSTIZ_BASE = 'https://postiz.example.test';

// env.ts evaluates at import-time, so we have to inject POSTIZ_* before any
// module that transitively imports env. Vitest hoists vi.mock above imports;
// the URL constant is duplicated below because vi.mock factories cannot
// reference module-scope variables (they run before the imports complete).
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      POSTIZ_BASE_URL: 'https://postiz.example.test',
      POSTIZ_API_KEY: 'msw-postiz-key',
    },
  };
});

import { PostizSocialPublishingAdapter } from './adapters/postiz';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const account: SocialAccount = {
  id: 'acct_postiz_fb',
  provider: 'postiz',
  platform: 'facebook',
  remoteId: 'postiz_integration_fb',
  name: 'Postiz Facebook Test',
  status: 'active',
  capabilities: [],
};

function buildRequest(overrides: Partial<SocialPublishRequest['content']> = {}): SocialPublishRequest {
  return {
    account,
    idempotencyKey: 'integration-draft-1',
    requestedBy: 'adm_integration',
    now: new Date('2026-05-22T10:00:00.000Z'),
    content: {
      sourcePostId: 'po_int_1',
      platform: 'facebook',
      format: 'post',
      caption: 'Integration test draft caption',
      media: [], // Facebook caption-only — bypasses the upload step.
      publishMode: 'draft',
      ...overrides,
    },
  };
}

describe('PostizSocialPublishingAdapter — draft mode integration (MSW)', () => {
  it('envoie type="draft" dans le payload Postiz et expose le draft remoteId', async () => {
    let capturedBody: { type?: string; posts?: unknown[] } | null = null;
    server.use(
      postizPostsHandler({
        baseUrl: POSTIZ_BASE,
        onRequest: (body) => {
          capturedBody = body;
        },
        responseBody: { id: 'pz_draft_int_42', state: 'DRAFT', releaseURL: 'https://app.postiz.com/draft/42' },
      }),
    );

    const adapter = new PostizSocialPublishingAdapter();
    const result = await adapter.publish(buildRequest());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.remoteId).toBe('pz_draft_int_42');
    expect(result.response.permalink).toBe('https://app.postiz.com/draft/42');
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.type).toBe('draft');
    expect(Array.isArray(capturedBody!.posts)).toBe(true);
  });

  it('remonte une erreur invalid_request sur 422 Postiz, sans crash', async () => {
    server.use(
      postizPostsHandler({
        baseUrl: POSTIZ_BASE,
        status: 422,
        responseBody: { message: 'caption too long' },
      }),
    );

    const adapter = new PostizSocialPublishingAdapter();
    const result = await adapter.publish(buildRequest());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_request');
    expect(result.error.status).toBe(422);
  });
});
