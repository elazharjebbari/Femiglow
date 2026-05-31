import { describe, expect, it } from 'vitest';
import type { SocialAccount, SocialPublishRequest } from './contracts';
import { DryRunSocialPublishingAdapter } from './adapters/dry-run';
import { publishWithAdapter } from './service';

const account: SocialAccount = {
  id: 'acct_1',
  provider: 'dry_run',
  platform: 'facebook',
  remoteId: 'fb_1',
  name: 'FemiGlow Facebook Dry Run',
  status: 'active',
  capabilities: [],
};

const request: SocialPublishRequest = {
  account,
  idempotencyKey: 'post_2:acct_1:now',
  requestedBy: 'admin_1',
  content: {
    sourcePostId: 'post_2',
    platform: 'facebook',
    format: 'post',
    caption: 'Facebook caption without media',
    media: [],
  },
};

describe('publishWithAdapter', () => {
  it('publie via un adapter compatible', async () => {
    const result = await publishWithAdapter(new DryRunSocialPublishingAdapter(), request);
    expect(result.ok).toBe(true);
  });

  it('refuse un provider incompatible', async () => {
    const result = await publishWithAdapter(new DryRunSocialPublishingAdapter(), {
      ...request,
      account: { ...request.account, provider: 'postiz' },
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_request', retryable: false } });
  });
});
