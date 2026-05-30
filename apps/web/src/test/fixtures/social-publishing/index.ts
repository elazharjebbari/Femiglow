/**
 * Fixtures partagées pour la batterie social-publishing.
 *
 * Cf docs/social-publishing-test-battery/test-battery/07-fixtures-catalog.yaml
 */
import type {
  SocialAccount,
  SocialPublishJob,
  SocialPublishMode,
} from '@/lib/social-publishing/contracts';
import type { ContentPost } from '@/lib/content-studio/types';

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const accountInstagramActive: SocialAccount = {
  id: 'sa_e2e_ig_1',
  provider: 'postiz',
  platform: 'instagram',
  remoteId: 'postiz_ig_1',
  name: 'AlFenna Beauty (Test)',
  status: 'active',
  capabilities: [
    { platform: 'instagram', format: 'post', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true, supportsDraft: true },
    { platform: 'instagram', format: 'carousel', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true, supportsDraft: true },
    { platform: 'instagram', format: 'reel', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true, supportsDraft: true },
    { platform: 'instagram', format: 'story', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true, supportsDraft: true },
  ],
};

export const accountInstagramDisabled: SocialAccount = {
  ...accountInstagramActive,
  id: 'sa_e2e_ig_2',
  name: 'FemiGlow IG Test (disabled)',
  status: 'disabled',
};

export const accountInstagramTokenExpired: SocialAccount = {
  ...accountInstagramActive,
  id: 'sa_e2e_ig_3',
  name: 'FemiGlow IG Test (token expired)',
  status: 'token_expired',
};

export const accountFacebookActive: SocialAccount = {
  id: 'sa_e2e_fb_1',
  provider: 'postiz',
  platform: 'facebook',
  remoteId: 'postiz_fb_1',
  name: 'AlFenna FB (Test)',
  status: 'active',
  capabilities: [
    { platform: 'facebook', format: 'post', mediaRequired: false, maxCaptionLength: 63206, supportsScheduling: true, supportsDraft: true },
  ],
};

export const accountDryRun: SocialAccount = {
  id: 'sa_e2e_dry_1',
  provider: 'dry_run',
  platform: 'instagram',
  remoteId: 'dry_run_ig_1',
  name: 'Dry Run IG',
  status: 'active',
  capabilities: [
    { platform: 'instagram', format: 'post', mediaRequired: true, maxCaptionLength: 2200, supportsScheduling: true, supportsDraft: true },
  ],
};

export const allAccounts: SocialAccount[] = [
  accountInstagramActive,
  accountInstagramDisabled,
  accountInstagramTokenExpired,
  accountFacebookActive,
  accountDryRun,
];

// ---------------------------------------------------------------------------
// Jobs (8 representatifs)
// ---------------------------------------------------------------------------

function makeJob(over: Partial<SocialPublishJob>): SocialPublishJob {
  return {
    id: 'spj_default',
    postId: 'post_default',
    accountId: 'sa_e2e_ig_1',
    provider: 'postiz',
    platform: 'instagram',
    format: 'post',
    status: 'queued',
    idempotencyKey: 'key_default',
    content: {
      sourcePostId: 'post_default',
      platform: 'instagram',
      format: 'post',
      caption: 'Caption fixture',
      media: [],
      publishMode: 'now' as SocialPublishMode,
    },
    scheduledAt: null,
    publishedAt: null,
    lockedAt: null,
    attemptCount: 0,
    lastError: null,
    requestedBy: 'admin_test',
    createdAt: new Date('2026-05-28T10:00:00Z'),
    updatedAt: new Date('2026-05-28T10:00:00Z'),
    ...over,
  };
}

export const jobQueuedNow = makeJob({
  id: 'spj_e2e_1',
  postId: 'post_e2e_1',
  status: 'queued',
});

export const jobQueuedSchedule = makeJob({
  id: 'spj_e2e_2',
  postId: 'post_e2e_2',
  status: 'queued',
  scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  content: {
    sourcePostId: 'post_e2e_2',
    platform: 'instagram',
    format: 'post',
    caption: 'Scheduled fixture',
    media: [],
    publishMode: 'schedule' as SocialPublishMode,
  },
});

export const jobPublishing = makeJob({
  id: 'spj_e2e_3',
  postId: 'post_e2e_3',
  status: 'publishing',
  lockedAt: new Date(Date.now() - 30 * 1000),
  attemptCount: 1,
});

export const jobPublished = makeJob({
  id: 'spj_e2e_4',
  postId: 'post_e2e_4',
  status: 'published',
  publishedAt: new Date(Date.now() - 5 * 60 * 1000),
  attemptCount: 1,
});

export const jobFailedRateLimit = makeJob({
  id: 'spj_e2e_5',
  postId: 'post_e2e_5',
  status: 'failed',
  attemptCount: 3,
  lastError: {
    code: 'provider_rate_limited',
    message: 'Postiz 429',
    retryable: true,
  },
});

export const jobFailedAuth = makeJob({
  id: 'spj_e2e_6',
  postId: 'post_e2e_6',
  status: 'failed',
  attemptCount: 1,
  lastError: {
    code: 'token_expired',
    message: 'Token expired',
    retryable: false,
  },
});

export const jobCancelled = makeJob({
  id: 'spj_e2e_7',
  postId: 'post_e2e_7',
  status: 'cancelled',
});

export const jobRetriedQueued = makeJob({
  id: 'spj_e2e_8',
  postId: 'post_e2e_5',
  status: 'queued',
  attemptCount: 2,
});

export const allJobs: SocialPublishJob[] = [
  jobQueuedNow,
  jobQueuedSchedule,
  jobPublishing,
  jobPublished,
  jobFailedRateLimit,
  jobFailedAuth,
  jobCancelled,
  jobRetriedQueued,
];

// ---------------------------------------------------------------------------
// Posts (états variés)
// ---------------------------------------------------------------------------

function makePost(over: Partial<ContentPost>): ContentPost {
  return {
    id: 'post_default',
    draftId: 'draft_default',
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    utm: null,
    approvedBy: 'admin_test',
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-05-28T09:00:00Z'),
    updatedAt: new Date('2026-05-28T09:00:00Z'),
    ...over,
  } as ContentPost;
}

export const postApproved = makePost({ id: 'post_e2e_1', draftId: 'draft_e2e_1', status: 'approved' });
export const postScheduled = makePost({
  id: 'post_e2e_2',
  draftId: 'draft_e2e_2',
  status: 'scheduled',
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});
export const postPublished = makePost({
  id: 'post_e2e_3',
  draftId: 'draft_e2e_3',
  status: 'published',
  publishedAt: new Date(Date.now() - 60 * 60 * 1000),
});
export const postFailed = makePost({ id: 'post_e2e_4', draftId: 'draft_e2e_4', status: 'approved' });
export const postCancelled = makePost({
  id: 'post_e2e_5',
  draftId: 'draft_e2e_5',
  status: 'cancelled',
  cancelledAt: new Date(),
});

export const allPosts: ContentPost[] = [
  postApproved,
  postScheduled,
  postPublished,
  postFailed,
  postCancelled,
];

// ---------------------------------------------------------------------------
// Postiz responses
// ---------------------------------------------------------------------------

export const postizUploadSuccess = {
  id: 'media_postiz_1',
  path: '/uploads/media_postiz_1.jpg',
};

export const postizPostsNowSuccess = {
  id: 'postiz_post_1',
  status: 'SENT',
  permalink: 'https://instagram.com/p/abc123',
  createdAt: new Date().toISOString(),
};

export const postizPostsScheduleSuccess = {
  id: 'postiz_post_2',
  status: 'SCHEDULED',
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export const postizPostsDraftSuccess = {
  id: 'postiz_draft_1',
  status: 'DRAFT',
};

export const postizAnalyticsDay7 = {
  impressions: 1234,
  likes: 89,
  comments: 12,
  engagement: 0.082,
};

export const postizIntegrationsList = [
  { id: 'postiz_ig_1', name: 'AlFenna Beauty', platform: 'instagram' },
  { id: 'postiz_fb_1', name: 'AlFenna Beauty', platform: 'facebook' },
];

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

export const fixtures = {
  accounts: allAccounts,
  jobs: allJobs,
  posts: allPosts,
  postiz: {
    upload: postizUploadSuccess,
    postsNow: postizPostsNowSuccess,
    postsSchedule: postizPostsScheduleSuccess,
    postsDraft: postizPostsDraftSuccess,
    analytics: postizAnalyticsDay7,
    integrations: postizIntegrationsList,
  },
} as const;
