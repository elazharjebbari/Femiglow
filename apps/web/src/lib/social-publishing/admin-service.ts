import { HttpError } from '@/lib/errors/http-error';
import { env } from '@/lib/env';
import { getMediaWithRelations } from '@/lib/db/queries/media';
import {
  getDraft,
  getLatestReview,
  getPost,
  getPrimaryAsset,
  updatePostPlanning,
} from '@/lib/content-studio/repository';
import type {
  SocialAccount,
  SocialFormat,
  SocialPlatform,
  SocialPublishContent,
  SocialPublishJob,
  SocialPublishResult,
} from './contracts';
import { DryRunSocialPublishingAdapter } from './adapters/dry-run';
import { publishWithAdapter } from './service';
import { assertSocialPublishJobTransition, nextRetryStatus } from './state-machine';
import {
  createPublication,
  createPublishJob,
  findPublishJobByIdempotencyKey,
  getPublishJob,
  getSocialAccount,
  listPublishEvents,
  listPublishJobs,
  listPublicationsForPost,
  listSocialAccounts,
  recordPublishAttempt,
  updatePublishJobStatus,
  upsertSocialAccount,
} from './repository';

const dryRunAdapter = new DryRunSocialPublishingAdapter();

export async function syncDryRunSocialAccounts(): Promise<SocialAccount[]> {
  const instagram = await upsertSocialAccount({
    provider: 'dry_run',
    platform: 'instagram',
    remoteId: 'dry_run_instagram',
    name: 'Instagram dry-run',
    status: 'active',
    capabilities: dryRunAdapter.listCapabilities({
      id: 'dry_run_instagram',
      provider: 'dry_run',
      platform: 'instagram',
      remoteId: 'dry_run_instagram',
      name: 'Instagram dry-run',
      status: 'active',
      capabilities: [],
    }),
  });
  const facebook = await upsertSocialAccount({
    provider: 'dry_run',
    platform: 'facebook',
    remoteId: 'dry_run_facebook',
    name: 'Facebook dry-run',
    status: 'active',
    capabilities: dryRunAdapter.listCapabilities({
      id: 'dry_run_facebook',
      provider: 'dry_run',
      platform: 'facebook',
      remoteId: 'dry_run_facebook',
      name: 'Facebook dry-run',
      status: 'active',
      capabilities: [],
    }),
  });
  return [instagram, facebook];
}

export async function listAdminSocialAccounts(): Promise<SocialAccount[]> {
  const accounts = await listSocialAccounts();
  return accounts.length > 0 ? accounts : syncDryRunSocialAccounts();
}

export async function getPostPublishability(input: {
  postId: string;
  accountId?: string | null;
}): Promise<{
  postId: string;
  account: SocialAccount;
  publishable: boolean;
  content: SocialPublishContent;
  warnings: string[];
  errors: string[];
}> {
  const { post, draft, account } = await resolvePostDraftAccount(input.postId, input.accountId ?? null);
  const content = await buildSocialContent(post.id, draft, post.scheduledAt);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (post.status !== 'approved' && post.status !== 'scheduled') {
    errors.push('Seul un post approuvé ou planifié peut être publié.');
  }
  if (draft.status !== 'approved') {
    errors.push('Le brouillon lié doit être approuvé.');
  }
  const review = await getLatestReview(draft.id);
  if (review?.status === 'blocked') {
    errors.push('Le brouillon est bloqué par la charte de marque.');
  }
  const capability = dryRunAdapter
    .listCapabilities(account)
    .find((item) => item.platform === content.platform && item.format === content.format);
  if (!capability) errors.push('Le compte social ne supporte pas ce format.');
  if (capability?.mediaRequired && content.media.length === 0) {
    errors.push('Un média HTTPS public est requis pour cette plateforme.');
  }
  if (capability?.maxCaptionLength && content.caption.length > capability.maxCaptionLength) {
    errors.push(`La légende dépasse la limite de ${capability.maxCaptionLength} caractères.`);
  }
  if (content.media.some((media) => !media.url.startsWith('https://'))) {
    errors.push('Tous les médias doivent être accessibles via HTTPS public.');
  }
  if (content.tags && content.tags.length > 25) warnings.push('Plus de 25 hashtags détectés.');

  return {
    postId: post.id,
    account,
    publishable: errors.length === 0,
    content,
    warnings,
    errors,
  };
}

export async function publishContentPostNow(input: {
  postId: string;
  accountId?: string | null;
  actorId: string | null;
  idempotencyKey?: string | null;
}): Promise<{ job: SocialPublishJob; result: SocialPublishResult }> {
  const explicitKey = input.idempotencyKey?.trim();
  if (explicitKey) {
    const existing = await findPublishJobByIdempotencyKey(explicitKey);
    if (existing) return resultForExistingJob(existing);
  }
  const publishability = await getPostPublishability({ postId: input.postId, accountId: input.accountId });
  if (!publishability.publishable) {
    throw new HttpError('invalid_state', 'Post non publiable.', { errors: publishability.errors });
  }
  const key = explicitKey || defaultIdempotencyKey(input.postId, publishability.account.id, 'now');
  const job = await createPublishJob({
    postId: input.postId,
    accountId: publishability.account.id,
    provider: publishability.account.provider,
    platform: publishability.content.platform,
    format: publishability.content.format,
    idempotencyKey: key,
    content: publishability.content,
    status: 'queued',
    requestedBy: input.actorId,
  });
  return executeDryRunJob(job.id, input.actorId);
}

export async function scheduleContentPost(input: {
  postId: string;
  accountId?: string | null;
  scheduledAt: Date;
  actorId: string | null;
  idempotencyKey?: string | null;
}): Promise<{ job: SocialPublishJob }> {
  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new HttpError('invalid_input', 'Date de programmation invalide.');
  }
  if (input.scheduledAt.getTime() <= Date.now()) {
    throw new HttpError('invalid_input', 'La date de programmation doit être future.');
  }
  const publishability = await getPostPublishability({ postId: input.postId, accountId: input.accountId });
  if (!publishability.publishable) {
    throw new HttpError('invalid_state', 'Post non programmable.', { errors: publishability.errors });
  }
  const key = input.idempotencyKey?.trim() || defaultIdempotencyKey(input.postId, publishability.account.id, input.scheduledAt.toISOString());
  const job = await createPublishJob({
    postId: input.postId,
    accountId: publishability.account.id,
    provider: publishability.account.provider,
    platform: publishability.content.platform,
    format: publishability.content.format,
    idempotencyKey: key,
    content: { ...publishability.content, scheduledAt: input.scheduledAt },
    status: 'queued',
    scheduledAt: input.scheduledAt,
    requestedBy: input.actorId,
  });
  await updatePostPlanning({ postId: input.postId, scheduledAt: input.scheduledAt, status: 'scheduled' });
  return { job };
}

export async function retryPublishJob(input: { jobId: string; actorId: string | null }): Promise<{ job: SocialPublishJob; result: SocialPublishResult }> {
  const job = await getPublishJob(input.jobId);
  if (!job) throw new HttpError('not_found', 'Job de publication introuvable.');
  const next = nextRetryStatus(job.status);
  await updatePublishJobStatus({ jobId: job.id, status: next, lastError: null });
  return executeDryRunJob(job.id, input.actorId);
}

export async function cancelPublishJob(input: { jobId: string; actorId: string | null }): Promise<{ job: SocialPublishJob }> {
  const job = await getPublishJob(input.jobId);
  if (!job) throw new HttpError('not_found', 'Job de publication introuvable.');
  assertSocialPublishJobTransition(job.status, 'cancelled');
  const updated = await updatePublishJobStatus({ jobId: job.id, status: 'cancelled', lockedAt: null });
  return { job: updated ?? job };
}

export async function listPublishJobsForAdmin(filters: { status?: SocialPublishJob['status']; postId?: string; accountId?: string }) {
  const jobs = await listPublishJobs(filters);
  return Promise.all(jobs.map(enrichJob));
}

export async function getPublishJobForAdmin(jobId: string) {
  const job = await getPublishJob(jobId);
  if (!job) throw new HttpError('not_found', 'Job de publication introuvable.');
  return enrichJob(job);
}

async function resultForExistingJob(job: SocialPublishJob): Promise<{ job: SocialPublishJob; result: SocialPublishResult }> {
  const publications = (await listPublicationsForPost(job.postId)).filter(
    (publication) => publication.jobId === job.id,
  );
  const publication = publications[0];
  if (job.status === 'published' && publication) {
    return {
      job,
      result: {
        ok: true,
        status: 'published',
        response: {
          provider: publication.provider,
          platform: publication.platform,
          remoteId: publication.remoteId,
          permalink: publication.permalink,
          publishedAt: publication.publishedAt.toISOString(),
          raw: publication.metadata,
        },
      },
    };
  }
  if (job.status === 'failed' && job.lastError) {
    return {
      job,
      result: {
        ok: false,
        status: 'failed',
        error: job.lastError,
      },
    };
  }
  return executeDryRunJob(job.id, job.requestedBy);
}

async function executeDryRunJob(jobId: string, actorId: string | null): Promise<{ job: SocialPublishJob; result: SocialPublishResult }> {
  const job = await getPublishJob(jobId);
  if (!job) throw new HttpError('not_found', 'Job de publication introuvable.');
  if (job.status === 'published') {
    return { job, result: { ok: true, status: 'published', response: { provider: job.provider, platform: job.platform, remoteId: 'already-published', publishedAt: (job.publishedAt ?? new Date()).toISOString() } } };
  }
  assertSocialPublishJobTransition(job.status, 'publishing');
  const account = await getSocialAccount(job.accountId);
  if (!account) throw new HttpError('not_found', 'Compte social introuvable.');
  const publishing = await updatePublishJobStatus({ jobId: job.id, status: 'publishing', lockedAt: new Date() });
  const startedAt = Date.now();
  const result = await publishWithAdapter(dryRunAdapter, {
    account,
    content: job.content,
    idempotencyKey: job.idempotencyKey,
    requestedBy: actorId,
    now: new Date(),
  });
  await recordPublishAttempt({
    jobId: job.id,
    provider: account.provider,
    status: result.ok ? 'succeeded' : 'failed',
    request: { accountId: account.id, content: job.content, idempotencyKey: job.idempotencyKey },
    response: result.ok ? ((result.response.raw ?? result.response) as unknown as Record<string, unknown>) : {},
    error: result.ok ? null : result.error,
    durationMs: Date.now() - startedAt,
  });
  if (result.ok) {
    const publishedAt = new Date(result.response.publishedAt);
    await createPublication({
      jobId: job.id,
      postId: job.postId,
      accountId: account.id,
      provider: account.provider,
      platform: account.platform,
      remoteId: result.response.remoteId,
      permalink: result.response.permalink ?? null,
      publishedAt,
      metadata: result.response.raw ?? {},
    });
    await updatePostPlanning({ postId: job.postId, scheduledAt: null, status: 'published' });
    const updated = await updatePublishJobStatus({ jobId: job.id, status: 'published', publishedAt, lockedAt: null, lastError: null });
    return { job: updated ?? publishing ?? job, result };
  }
  const updated = await updatePublishJobStatus({
    jobId: job.id,
    status: 'failed',
    lockedAt: null,
    lastError: {
      code: result.error.code,
      message: result.error.message,
      retryable: result.error.retryable,
    },
  });
  await updatePostPlanning({ postId: job.postId, scheduledAt: null, status: 'failed' });
  return { job: updated ?? publishing ?? job, result };
}

async function enrichJob(job: SocialPublishJob) {
  const [events, publications] = await Promise.all([
    listPublishEvents(job.id),
    listPublicationsForPost(job.postId),
  ]);
  return { job, events, publications: publications.filter((publication) => publication.jobId === job.id) };
}

async function resolvePostDraftAccount(postId: string, accountId: string | null) {
  const post = await getPost(postId);
  if (!post) throw new HttpError('not_found', 'Post introuvable.');
  const draft = await getDraft(post.draftId);
  if (!draft) throw new HttpError('not_found', 'Brouillon introuvable.');
  const account = accountId ? await getSocialAccount(accountId) : await defaultAccountForPlatform(draft.platform);
  if (!account) throw new HttpError('not_found', 'Compte social introuvable.');
  if (account.platform !== draft.platform) {
    throw new HttpError('invalid_input', 'Le compte social ne correspond pas à la plateforme du post.');
  }
  return { post, draft, account };
}

async function defaultAccountForPlatform(platform: SocialPlatform): Promise<SocialAccount | null> {
  const accounts = await listAdminSocialAccounts();
  return accounts.find((account) => account.provider === 'dry_run' && account.platform === platform) ?? null;
}

async function buildSocialContent(postId: string, draft: Awaited<ReturnType<typeof getDraft>> & {}, scheduledAt: Date | null): Promise<SocialPublishContent> {
  if (!draft) throw new HttpError('not_found', 'Brouillon introuvable.');
  const asset = await getPrimaryAsset(draft.id);
  const media = asset ? await getMediaWithRelations(asset.mediaId) : null;
  const url = media ? pickPublicMediaUrl(media) : null;
  const tags = draft.hashtags.map((tag) => tag.replace(/^#/, '')).filter(Boolean);
  return {
    sourcePostId: postId,
    platform: draft.platform,
    format: draft.format as SocialFormat,
    caption: draft.caption,
    media: url
      ? [{
          id: media!.id,
          url: absoluteUrl(url),
          mimeType: media!.originalMime,
          width: media!.originalWidth,
          height: media!.originalHeight,
          alt: draft.altText ?? media!.alt,
        }]
      : [],
    scheduledAt,
    tags,
    metadata: { dryRun: true, contentStudioDraftId: draft.id },
  };
}

function pickPublicMediaUrl(media: Awaited<ReturnType<typeof getMediaWithRelations>>): string | null {
  if (!media || media.deletedAt !== null) return null;
  if (media.status !== 'ready' && media.status !== 'passthrough') return null;
  const preferred = media.variants.find((variant) => variant.format === 'webp' || variant.format === 'jpeg');
  return preferred?.url ?? media.variants[0]?.url ?? media.originalUrl;
}

function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function defaultIdempotencyKey(postId: string, accountId: string, suffix: string): string {
  return `content-studio:${postId}:${accountId}:${suffix}`;
}
