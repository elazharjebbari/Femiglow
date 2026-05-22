import { createHash } from 'node:crypto';
import type {
  SocialAccount,
  SocialInsightsRequest,
  SocialInsightsResult,
  SocialPublishRequest,
  SocialPublishResult,
  SocialPublishingAdapter,
  SocialPublishingCapability,
  SocialPublishErrorCode,
} from '../contracts';
import { SocialPublishingError, redactProviderPayload, toPublishFailure } from '../errors';

const CAPABILITIES: SocialPublishingCapability[] = [
  { platform: 'instagram', format: 'post', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true, supportsDraft: true },
  { platform: 'instagram', format: 'carousel', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true, supportsDraft: true },
  { platform: 'facebook', format: 'post', mediaRequired: false, maxCaptionLength: 63206, supportsScheduling: true, supportsDraft: true },
];

export class DryRunSocialPublishingAdapter implements SocialPublishingAdapter {
  readonly provider = 'dry_run' as const;

  listCapabilities(account: SocialAccount): SocialPublishingCapability[] {
    if (account.provider !== this.provider || account.status !== 'active') return [];
    return CAPABILITIES.filter((capability) => capability.platform === account.platform);
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    try {
      validateRequest(request, this.listCapabilities(request.account));
      const simulatedFailure = request.content.metadata?.dryRunFailureCode;
      if (typeof simulatedFailure === 'string') {
        throw simulatedError(simulatedFailure as SocialPublishErrorCode);
      }

      const publishedAt = (request.now ?? new Date()).toISOString();
      const remoteId = deterministicRemoteId(request.idempotencyKey);
      const isDraft = request.content.publishMode === 'draft';
      const permalink = isDraft
        ? `https://social.example.test/${request.account.platform}/draft/${remoteId}`
        : `https://social.example.test/${request.account.platform}/${remoteId}`;
      return {
        ok: true,
        status: 'published',
        response: {
          provider: this.provider,
          platform: request.account.platform,
          remoteId,
          permalink,
          publishedAt,
          raw: redactProviderPayload({
            dryRun: true,
            idempotencyKey: request.idempotencyKey,
            simulatedDraft: isDraft,
            token: 'not-a-real-token',
          }) as Record<string, unknown>,
        },
      };
    } catch (err) {
      return toPublishFailure(err);
    }
  }

  async getInsights(request: SocialInsightsRequest): Promise<SocialInsightsResult> {
    // Deterministic synthetic metrics — same providerPostId always yields the
    // same numbers, so two ingestion runs produce identical snapshots and the
    // worker's idempotency check holds.
    const seed = createHash('sha256').update(request.providerPostId).digest();
    const byteAt = (idx: number): number => seed.readUInt8(idx);
    const impressions = 500 + (seed.readUInt16BE(0) % 3500);
    const reach = Math.round(impressions * (0.55 + (byteAt(2) % 30) / 100));
    const likes = Math.round(reach * (0.04 + (byteAt(3) % 12) / 100));
    const comments = Math.round(likes * (0.05 + (byteAt(4) % 15) / 100));
    const shares = Math.round(likes * (0.02 + (byteAt(5) % 8) / 100));
    const saves = Math.round(likes * (0.03 + (byteAt(6) % 10) / 100));
    const engagementRate = reach > 0 ? (likes + comments + shares + saves) / reach : 0;
    return {
      ok: true,
      insights: {
        provider: this.provider,
        remoteId: request.providerPostId,
        capturedAt: new Date().toISOString(),
        metrics: {
          impressions,
          reach,
          likes,
          comments,
          shares,
          saves,
          videoViews: null,
          engagementRate: Math.round(engagementRate * 10_000) / 10_000,
        },
      },
    };
  }
}

function validateRequest(request: SocialPublishRequest, capabilities: SocialPublishingCapability[]): void {
  if (!request.idempotencyKey.trim()) {
    throw new SocialPublishingError({ code: 'invalid_request', message: 'Missing idempotency key', retryable: false });
  }
  if (request.account.provider !== 'dry_run') {
    throw new SocialPublishingError({ code: 'invalid_request', message: 'Dry-run adapter received a non dry-run account', retryable: false });
  }
  if (request.account.status !== 'active') {
    throw new SocialPublishingError({ code: 'token_expired', message: 'Social account is not active', retryable: false });
  }
  const capability = capabilities.find(
    (item) => item.platform === request.content.platform && item.format === request.content.format,
  );
  if (!capability) {
    throw new SocialPublishingError({ code: 'unsupported_format', message: 'Unsupported social format', retryable: false });
  }
  if (capability.mediaRequired && request.content.media.length === 0) {
    throw new SocialPublishingError({ code: 'media_not_public', message: 'A public media URL is required', retryable: false });
  }
  for (const media of request.content.media) {
    if (!/^https:\/\//i.test(media.url)) {
      throw new SocialPublishingError({ code: 'media_not_public', message: 'Media URL must be public HTTPS', retryable: false });
    }
  }
  if (capability.maxCaptionLength && request.content.caption.length > capability.maxCaptionLength) {
    throw new SocialPublishingError({ code: 'invalid_request', message: 'Caption exceeds platform limit', retryable: false });
  }
  if (request.content.publishMode === 'draft' && !capability.supportsDraft) {
    throw new SocialPublishingError({
      code: 'unsupported_format',
      message: 'Draft mode not supported for this dry-run capability',
      retryable: false,
    });
  }
}

function deterministicRemoteId(seed: string): string {
  return `dry_${createHash('sha256').update(seed).digest('hex').slice(0, 18)}`;
}

function simulatedError(code: SocialPublishErrorCode): SocialPublishingError {
  const retryable = code === 'provider_rate_limited' || code === 'provider_unavailable';
  return new SocialPublishingError({ code, message: `Dry-run simulated failure: ${code}`, retryable });
}
