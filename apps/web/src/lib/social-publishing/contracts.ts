export const SOCIAL_PROVIDER_IDS = ['dry_run', 'meta_graph', 'postiz'] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

export const SOCIAL_PLATFORMS = ['instagram', 'facebook'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_FORMATS = ['post', 'story', 'reel', 'carousel'] as const;
export type SocialFormat = (typeof SOCIAL_FORMATS)[number];

export const SOCIAL_PUBLISH_MODES = ['now', 'schedule', 'draft'] as const;
export type SocialPublishMode = (typeof SOCIAL_PUBLISH_MODES)[number];

export const SOCIAL_PUBLISH_JOB_STATUSES = [
  'draft',
  'approved',
  'queued',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;
export type SocialPublishJobStatus = (typeof SOCIAL_PUBLISH_JOB_STATUSES)[number];

export const SOCIAL_PUBLISH_ERROR_CODES = [
  'token_expired',
  'permission_denied',
  'media_not_public',
  'provider_rate_limited',
  'provider_unavailable',
  'unsupported_format',
  'invalid_request',
  'duplicate_external_post',
  'unknown_provider_error',
] as const;
export type SocialPublishErrorCode = (typeof SOCIAL_PUBLISH_ERROR_CODES)[number];

export interface SocialAccount {
  id: string;
  provider: SocialProviderId;
  platform: SocialPlatform;
  remoteId: string;
  name: string;
  status: 'active' | 'disabled' | 'token_expired' | 'permission_missing';
  capabilities: SocialPublishingCapability[];
}

export interface SocialPublishingCapability {
  platform: SocialPlatform;
  format: SocialFormat;
  mediaRequired: boolean;
  maxCaptionLength?: number;
  supportsScheduling: boolean;
  /**
   * Provider can hold the content in a non-published review state (e.g.
   * Postiz draft, Buffer queue with manual approval). Drives the
   * "Brouillon Postiz" UI option.
   */
  supportsDraft: boolean;
}

export interface SocialMediaAsset {
  id: string;
  url: string;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
}

export interface SocialPublishContent {
  sourcePostId: string;
  platform: SocialPlatform;
  format: SocialFormat;
  caption: string;
  media: SocialMediaAsset[];
  scheduledAt?: Date | string | null;
  /**
   * Explicit publication intent. When absent, adapters fall back to the
   * legacy inference (scheduledAt in the future → schedule, else now) for
   * backward compatibility with jobs created before phase e.
   */
  publishMode?: SocialPublishMode;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SocialPublishRequest {
  account: SocialAccount;
  content: SocialPublishContent;
  idempotencyKey: string;
  requestedBy: string | null;
  now?: Date;
}

export interface SocialPublishProviderResponse {
  provider: SocialProviderId;
  platform: SocialPlatform;
  remoteId: string;
  permalink?: string | null;
  publishedAt: string;
  raw?: Record<string, unknown>;
}

export interface SocialPublishSuccess {
  ok: true;
  status: 'published';
  response: SocialPublishProviderResponse;
}

export interface SocialPublishFailure {
  ok: false;
  status: 'failed';
  error: {
    code: SocialPublishErrorCode;
    message: string;
    retryable: boolean;
    status?: number;
    details?: unknown;
  };
}

export type SocialPublishResult = SocialPublishSuccess | SocialPublishFailure;



export interface SocialPublishJob {
  id: string;
  postId: string;
  accountId: string;
  provider: SocialProviderId;
  platform: SocialPlatform;
  format: SocialFormat;
  status: SocialPublishJobStatus;
  idempotencyKey: string;
  content: SocialPublishContent;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  lockedAt: Date | null;
  attemptCount: number;
  lastError: {
    code: SocialPublishErrorCode;
    message: string;
    retryable: boolean;
  } | null;
  requestedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialPublishAttempt {
  id: string;
  jobId: string;
  attemptNumber: number;
  provider: SocialProviderId;
  status: 'succeeded' | 'failed';
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  error: {
    code?: SocialPublishErrorCode;
    message?: string;
    retryable?: boolean;
    details?: unknown;
  } | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface SocialPublication {
  id: string;
  jobId: string;
  postId: string;
  accountId: string;
  provider: SocialProviderId;
  platform: SocialPlatform;
  remoteId: string;
  permalink: string | null;
  status: 'published' | 'removed' | 'unknown';
  publishedAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SocialPublishEvent {
  id: string;
  jobId: string;
  type: string;
  actorId: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Normalized post performance metrics, written into
 * `content_performance_snapshot.metrics`. Optional fields stay nullable so
 * providers that don't surface a given metric don't lie with zeros.
 */
export interface SocialPostInsights {
  provider: SocialProviderId;
  remoteId: string;
  /** When the provider measured these metrics (defaults to now if absent). */
  capturedAt: string;
  metrics: {
    impressions?: number | null;
    reach?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    saves?: number | null;
    videoViews?: number | null;
    /** Engagement = (likes + comments + shares + saves) / max(reach, 1). 0..1 */
    engagementRate?: number | null;
  };
  /** Redacted provider payload — useful for debugging anomalies. */
  raw?: Record<string, unknown>;
}

export interface SocialInsightsRequest {
  account: SocialAccount;
  providerPostId: string;
}

export interface SocialInsightsSuccess {
  ok: true;
  insights: SocialPostInsights;
}

export interface SocialInsightsFailure {
  ok: false;
  error: {
    code: SocialPublishErrorCode;
    message: string;
    retryable: boolean;
    status?: number;
  };
}

export type SocialInsightsResult = SocialInsightsSuccess | SocialInsightsFailure;

export interface SocialPublishingAdapter {
  readonly provider: SocialProviderId;
  listCapabilities(account: SocialAccount): SocialPublishingCapability[];
  publish(request: SocialPublishRequest): Promise<SocialPublishResult>;
  /**
   * Optional analytics retrieval. Adapters that don't yet implement it
   * return `undefined` and the worker skips that publication.
   */
  getInsights?(request: SocialInsightsRequest): Promise<SocialInsightsResult>;
}
