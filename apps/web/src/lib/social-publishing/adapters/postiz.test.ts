import { describe, expect, it, vi } from 'vitest';
import type { SocialAccount, SocialPublishRequest } from '../contracts';
import { PostizSocialPublishingAdapter } from './postiz';
import type { PostizResult } from '../../content-studio/postiz';

const igAccount: SocialAccount = {
  id: 'acct_postiz_ig',
  provider: 'postiz',
  platform: 'instagram',
  remoteId: 'postiz_integration_ig',
  name: 'FemiGlow Instagram Postiz',
  status: 'active',
  capabilities: [],
};

const fbAccount: SocialAccount = {
  ...igAccount,
  id: 'acct_postiz_fb',
  platform: 'facebook',
  remoteId: 'postiz_integration_fb',
  name: 'FemiGlow Facebook Postiz',
};

function request(overrides: Partial<SocialPublishRequest> = {}, account: SocialAccount = igAccount): SocialPublishRequest {
  return {
    account,
    idempotencyKey: 'post_1:acct_postiz_ig:now',
    requestedBy: 'admin_1',
    now: new Date('2026-05-20T12:00:00.000Z'),
    content: {
      sourcePostId: 'post_1',
      platform: account.platform,
      format: 'post',
      caption: 'Caption Femiglow via Postiz',
      media: [{ id: 'media_1', url: 'https://staging.femiglow-maroc.com/media/image.webp' }],
    },
    ...overrides,
  };
}

function postizOk(body: Record<string, unknown> = {}, status = 200): PostizResult {
  return { ok: true, status, body };
}

function postizErr(status: number, body: Record<string, unknown> = {}): PostizResult {
  return { ok: false, status, body };
}

describe('PostizSocialPublishingAdapter', () => {
  describe('listCapabilities', () => {
    it('liste 4 capabilities Instagram pour un compte actif', () => {
      const adapter = new PostizSocialPublishingAdapter();
      const caps = adapter.listCapabilities(igAccount);
      expect(caps).toHaveLength(4);
      expect(caps.map((c) => c.format).sort()).toEqual(['carousel', 'post', 'reel', 'story']);
    });

    it('liste 1 capability Facebook pour un compte actif', () => {
      const adapter = new PostizSocialPublishingAdapter();
      const caps = adapter.listCapabilities(fbAccount);
      expect(caps).toHaveLength(1);
      expect(caps[0]).toMatchObject({ platform: 'facebook', format: 'post', mediaRequired: false });
    });

    it('ne liste rien pour un compte non actif', () => {
      const adapter = new PostizSocialPublishingAdapter();
      expect(adapter.listCapabilities({ ...igAccount, status: 'token_expired' })).toHaveLength(0);
    });

    it('ne liste rien pour un compte non postiz', () => {
      const adapter = new PostizSocialPublishingAdapter();
      expect(adapter.listCapabilities({ ...igAccount, provider: 'dry_run' })).toHaveLength(0);
    });
  });

  describe('publish — succès', () => {
    it('upload le média, crée le draft Postiz et retourne le remote id', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(
        postizOk({ id: 'postiz_media_1', path: '/upload/postiz_media_1.webp' }),
      );
      const createDraft = vi.fn().mockResolvedValue(
        postizOk({ id: 'postiz_post_42', releaseURL: 'https://postiz.example.com/p/42' }),
      );
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.response.remoteId).toBe('postiz_post_42');
      expect(result.response.permalink).toBe('https://postiz.example.com/p/42');
      expect(result.response.publishedAt).toBe('2026-05-20T12:00:00.000Z');
      expect(uploadMedia).toHaveBeenCalledTimes(1);
      expect(createDraft).toHaveBeenCalledTimes(1);
      const draftCall = createDraft.mock.calls[0]?.[0];
      expect(draftCall).toMatchObject({
        integrationId: igAccount.remoteId,
        platform: 'instagram',
        format: 'post',
        image: { id: 'postiz_media_1', path: '/upload/postiz_media_1.webp' },
      });
    });

    it('extrait un remote id depuis une réponse imbriquée', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(
        postizOk({ data: { posts: [{ id: 'nested_post_id' }] } }),
      );
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      if (!result.ok) throw new Error('expected success');
      expect(result.response.remoteId).toBe('nested_post_id');
    });

    it('redacte les clés sensibles dans raw', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(
        postizOk({ id: 'p_1', accessToken: 'secret-token-value' }),
      );
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      if (!result.ok) throw new Error('expected success');
      expect(result.response.raw?.accessToken).toBe('[redacted]');
    });

    it('publie une story instagram sans demander une publication facebook', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(postizOk({ id: 'p_story_1' }));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const req = request({ content: { ...request().content, format: 'story' } });
      const result = await adapter.publish(req);
      expect(result.ok).toBe(true);
    });
  });

  describe('publish — validation', () => {
    it('rejette une idempotency key vide', async () => {
      const adapter = new PostizSocialPublishingAdapter();
      const result = await adapter.publish(request({ idempotencyKey: '   ' }));
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid_request', retryable: false } });
    });

    it('rejette un account non postiz', async () => {
      const adapter = new PostizSocialPublishingAdapter();
      const result = await adapter.publish(request({}, { ...igAccount, provider: 'dry_run' }));
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid_request' } });
    });

    it('rejette un account non actif', async () => {
      const adapter = new PostizSocialPublishingAdapter();
      const result = await adapter.publish(request({}, { ...igAccount, status: 'token_expired' }));
      expect(result).toMatchObject({ ok: false, error: { code: 'token_expired' } });
    });

    it('rejette un format non supporté', async () => {
      const adapter = new PostizSocialPublishingAdapter();
      const result = await adapter.publish(
        request({ content: { ...request().content, format: 'reel' } }, fbAccount),
      );
      expect(result).toMatchObject({ ok: false, error: { code: 'unsupported_format' } });
    });

    it('rejette un media non HTTPS', async () => {
      const adapter = new PostizSocialPublishingAdapter();
      const result = await adapter.publish(
        request({ content: { ...request().content, media: [{ id: 'm', url: 'http://insecure/image.webp' }] } }),
      );
      expect(result).toMatchObject({ ok: false, error: { code: 'media_not_public' } });
    });

    it('rejette un caption qui dépasse la limite plateforme', async () => {
      const adapter = new PostizSocialPublishingAdapter();
      const caption = 'a'.repeat(2201);
      const result = await adapter.publish(request({ content: { ...request().content, caption } }));
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid_request' } });
    });
  });

  describe('publish — mapping erreurs HTTP', () => {
    it('mappe HTTP 401 du draft en token_expired', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(postizErr(401, { message: 'token expired' }));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      expect(result).toMatchObject({ ok: false, error: { code: 'token_expired', retryable: false } });
    });

    it('mappe HTTP 403 du draft en permission_denied', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(postizErr(403));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      expect(result).toMatchObject({ ok: false, error: { code: 'permission_denied', retryable: false } });
    });

    it('mappe HTTP 429 du draft en provider_rate_limited retryable', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(postizErr(429));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      expect(result).toMatchObject({ ok: false, error: { code: 'provider_rate_limited', retryable: true } });
    });

    it('mappe HTTP 503 du draft en provider_unavailable retryable', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(postizErr(503));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      expect(result).toMatchObject({ ok: false, error: { code: 'provider_unavailable', retryable: true } });
    });

    it('mappe HTTP 422 du draft en invalid_request avec message extrait', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(postizErr(422, { message: 'image required' }));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.error.code).toBe('invalid_request');
      expect(result.error.message).toBe('image required');
    });

    it('propage une erreur de l upload média (5xx)', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizErr(500, { stage: 'upload' }));
      const createDraft = vi.fn();
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      expect(result).toMatchObject({ ok: false, error: { code: 'provider_unavailable', retryable: true } });
      expect(createDraft).not.toHaveBeenCalled();
    });

    it('mappe une réponse sans id Postiz en unknown_provider_error', async () => {
      const uploadMedia = vi.fn().mockResolvedValue(postizOk({ id: 'm', path: '/p.webp' }));
      const createDraft = vi.fn().mockResolvedValue(postizOk({ status: 'queued' }));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const result = await adapter.publish(request());
      expect(result).toMatchObject({ ok: false, error: { code: 'unknown_provider_error' } });
    });
  });

  describe('publish — facebook sans média', () => {
    it('autorise un post Facebook sans média (caption-only)', async () => {
      const uploadMedia = vi.fn();
      const createDraft = vi.fn().mockResolvedValue(postizOk({ id: 'fb_post_1' }));
      const adapter = new PostizSocialPublishingAdapter({ uploadMedia, createDraft });
      const req = request({ content: { ...request().content, platform: 'facebook', media: [] } }, fbAccount);
      const result = await adapter.publish(req);
      expect(result.ok).toBe(true);
      expect(uploadMedia).not.toHaveBeenCalled();
    });
  });
});
