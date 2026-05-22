import { describe, expect, it } from 'vitest';
import type { SocialAccount, SocialPublishRequest } from '../contracts';
import { DryRunSocialPublishingAdapter } from './dry-run';

const account: SocialAccount = {
  id: 'acct_1',
  provider: 'dry_run',
  platform: 'instagram',
  remoteId: 'ig_1',
  name: 'FemiGlow Dry Run',
  status: 'active',
  capabilities: [],
};

function request(overrides: Partial<SocialPublishRequest> = {}): SocialPublishRequest {
  return {
    account,
    idempotencyKey: 'post_1:acct_1:now',
    requestedBy: 'admin_1',
    now: new Date('2026-05-19T10:00:00.000Z'),
    content: {
      sourcePostId: 'post_1',
      platform: 'instagram',
      format: 'post',
      caption: 'Caption Femiglow',
      media: [{ id: 'media_1', url: 'https://staging.femiglow-maroc.com/media/image.webp' }],
    },
    ...overrides,
  };
}

describe('DryRunSocialPublishingAdapter', () => {
  it('publie un post simulé avec remote id déterministe', async () => {
    const adapter = new DryRunSocialPublishingAdapter();
    const result = await adapter.publish(request());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.response.remoteId).toMatch(/^dry_/);
    expect(result.response.publishedAt).toBe('2026-05-19T10:00:00.000Z');
    expect(result.response.raw?.token).toBe('[redacted]');
  });

  it('refuse une image Instagram sans média public HTTPS', async () => {
    const adapter = new DryRunSocialPublishingAdapter();
    const result = await adapter.publish(request({ content: { ...request().content, media: [] } }));
    expect(result).toMatchObject({ ok: false, error: { code: 'media_not_public', retryable: false } });
  });

  it('refuse un format non supporté par la plateforme', async () => {
    const adapter = new DryRunSocialPublishingAdapter();
    const result = await adapter.publish(request({ content: { ...request().content, format: 'story' } }));
    expect(result).toMatchObject({ ok: false, error: { code: 'unsupported_format' } });
  });

  it('simule les erreurs provider configurées dans metadata', async () => {
    const adapter = new DryRunSocialPublishingAdapter();
    const result = await adapter.publish(
      request({ content: { ...request().content, metadata: { dryRunFailureCode: 'provider_rate_limited' } } }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'provider_rate_limited', retryable: true } });
  });

  describe('publishMode draft', () => {
    it('produit un permalink /draft/ et marque raw.simulatedDraft', async () => {
      const adapter = new DryRunSocialPublishingAdapter();
      const result = await adapter.publish(
        request({ content: { ...request().content, publishMode: 'draft' } }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.response.permalink).toContain('/draft/');
      expect(result.response.raw?.simulatedDraft).toBe(true);
    });

    it('publication standard (sans publishMode) ne marque pas simulatedDraft', async () => {
      const adapter = new DryRunSocialPublishingAdapter();
      const result = await adapter.publish(request());
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.response.permalink).not.toContain('/draft/');
      expect(result.response.raw?.simulatedDraft).toBe(false);
    });
  });
});
