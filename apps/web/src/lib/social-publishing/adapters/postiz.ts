import type {
  SocialAccount,
  SocialPublishRequest,
  SocialPublishResult,
  SocialPublishingAdapter,
  SocialPublishingCapability,
} from '../contracts';
import {
  SocialPublishingError,
  errorFromHttpStatus,
  redactProviderPayload,
  toPublishFailure,
} from '../errors';
import {
  buildPostizDraftPayload,
  createPostizDraft,
  extractPostizPostId,
  parsePostizUploadedMedia,
  uploadPostizMediaFromUrl,
  type PostizPostInput,
  type PostizResult,
} from '../../content-studio/postiz';

const CAPABILITIES: SocialPublishingCapability[] = [
  { platform: 'instagram', format: 'post', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true },
  { platform: 'instagram', format: 'carousel', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true },
  { platform: 'instagram', format: 'reel', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true },
  { platform: 'instagram', format: 'story', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true },
  { platform: 'facebook', format: 'post', mediaRequired: false, maxCaptionLength: 63206, supportsScheduling: true },
];

export interface PostizAdapterDeps {
  uploadMedia?: typeof uploadPostizMediaFromUrl;
  createDraft?: typeof createPostizDraft;
}

export class PostizSocialPublishingAdapter implements SocialPublishingAdapter {
  readonly provider = 'postiz' as const;
  private readonly uploadMedia: typeof uploadPostizMediaFromUrl;
  private readonly createDraft: typeof createPostizDraft;

  constructor(deps: PostizAdapterDeps = {}) {
    this.uploadMedia = deps.uploadMedia ?? uploadPostizMediaFromUrl;
    this.createDraft = deps.createDraft ?? createPostizDraft;
  }

  listCapabilities(account: SocialAccount): SocialPublishingCapability[] {
    if (account.provider !== this.provider || account.status !== 'active') return [];
    return CAPABILITIES.filter((capability) => capability.platform === account.platform);
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    try {
      validateRequest(request, this.listCapabilities(request.account));
      validateSchedule(request);

      let uploadedImage: PostizPostInput['image'] = null;
      const media = request.content.media[0];
      if (media) {
        const upload = await this.uploadMedia({
          url: media.url,
          filename: filenameFor(media),
          retry: { attempts: 3 },
        });
        if (!upload.ok) throw fromPostizResult(upload, 'media_upload');
        const parsed = parsePostizUploadedMedia(upload.body);
        if (!parsed) {
          throw new SocialPublishingError({
            code: 'unknown_provider_error',
            message: 'Postiz did not return a parsable uploaded media',
            status: upload.status,
            details: redactProviderPayload(upload.body),
          });
        }
        uploadedImage = { id: parsed.id, path: parsed.path };
      }

      const now = request.now ?? new Date();
      const { type, scheduledAt } = resolvePostizSchedule(request.content.scheduledAt, now);

      const draftResult = await this.createDraft(
        {
          integrationId: request.account.remoteId,
          platform: request.content.platform,
          format: request.content.format,
          content: request.content.caption,
          scheduledAt,
          tags: request.content.tags?.map((tag) => ({ value: tag, label: tag })),
          image: uploadedImage,
          type,
        },
        { attempts: 3 },
      );
      if (!draftResult.ok) throw fromPostizResult(draftResult, 'create_draft');

      const remoteId = extractPostizPostId(draftResult.body);
      if (!remoteId) {
        throw new SocialPublishingError({
          code: 'unknown_provider_error',
          message: 'Postiz response did not contain a post id',
          status: draftResult.status,
          details: redactProviderPayload(draftResult.body),
        });
      }

      const publishedAt = now.toISOString();
      return {
        ok: true,
        status: 'published',
        response: {
          provider: this.provider,
          platform: request.account.platform,
          remoteId,
          permalink: extractPermalink(draftResult.body),
          publishedAt,
          raw: redactProviderPayload(draftResult.body) as Record<string, unknown>,
        },
      };
    } catch (err) {
      return toPublishFailure(err);
    }
  }
}

function resolvePostizSchedule(
  scheduledAt: Date | string | null | undefined,
  now: Date,
): { type: 'now' | 'schedule'; scheduledAt: Date | string | null } {
  if (!scheduledAt) return { type: 'now', scheduledAt: null };
  const date = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { type: 'now', scheduledAt: null };
  if (date.getTime() <= now.getTime()) return { type: 'now', scheduledAt: null };
  return { type: 'schedule', scheduledAt };
}

function validateSchedule(request: SocialPublishRequest): void {
  if (!request.content.scheduledAt) return;
  const date =
    request.content.scheduledAt instanceof Date
      ? request.content.scheduledAt
      : new Date(request.content.scheduledAt);
  if (Number.isNaN(date.getTime())) {
    throw new SocialPublishingError({
      code: 'invalid_request',
      message: 'Scheduled date is invalid',
      retryable: false,
    });
  }
  const now = (request.now ?? new Date()).getTime();
  // Allow a 60s tolerance so a request crafted at T0 doesn't bounce against
  // a serialization round-trip that lands at T0+ε. Anything older than that
  // is treated as a logic bug and refused.
  if (date.getTime() + 60_000 < now) {
    throw new SocialPublishingError({
      code: 'invalid_request',
      message: 'Scheduled date is in the past',
      retryable: false,
    });
  }
}

function validateRequest(request: SocialPublishRequest, capabilities: SocialPublishingCapability[]): void {
  if (!request.idempotencyKey.trim()) {
    throw new SocialPublishingError({ code: 'invalid_request', message: 'Missing idempotency key', retryable: false });
  }
  if (request.account.provider !== 'postiz') {
    throw new SocialPublishingError({ code: 'invalid_request', message: 'Postiz adapter received a non postiz account', retryable: false });
  }
  if (request.account.status !== 'active') {
    throw new SocialPublishingError({ code: 'token_expired', message: 'Social account is not active', retryable: false });
  }
  const capability = capabilities.find(
    (item) => item.platform === request.content.platform && item.format === request.content.format,
  );
  if (!capability) {
    throw new SocialPublishingError({ code: 'unsupported_format', message: 'Unsupported social format for Postiz', retryable: false });
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
}

function fromPostizResult(result: PostizResult, stage: 'media_upload' | 'create_draft'): SocialPublishingError {
  const baseMessage = stage === 'media_upload' ? 'Postiz upload failed' : 'Postiz draft creation failed';
  if (result.status === 422 || result.status === 400) {
    return new SocialPublishingError({
      code: 'invalid_request',
      message: extractPostizErrorMessage(result.body) ?? baseMessage,
      retryable: false,
      status: result.status,
      details: redactProviderPayload(result.body),
    });
  }
  const err = errorFromHttpStatus(result.status, extractPostizErrorMessage(result.body) ?? baseMessage);
  return new SocialPublishingError({
    code: err.code,
    message: err.message,
    retryable: err.retryable,
    status: result.status,
    details: redactProviderPayload(result.body),
  });
}

function extractPostizErrorMessage(body: Record<string, unknown>): string | null {
  const candidates = ['message', 'error', 'detail'];
  for (const key of candidates) {
    const value = body[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function extractPermalink(body: Record<string, unknown>): string | null {
  const candidates = ['releaseURL', 'release_url', 'permalink', 'url'];
  for (const key of candidates) {
    const value = body[key];
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  }
  return null;
}

function filenameFor(media: { url: string }): string {
  try {
    const url = new URL(media.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last.length > 0) return last;
  } catch {
    // fallthrough
  }
  return 'media.bin';
}
