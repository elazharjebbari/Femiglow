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
  SocialProviderId,
  SocialPublishContent,
  SocialPublishJob,
  SocialPublishResult,
  SocialPublishingAdapter,
} from './contracts';
import { listPostizIntegrations, type PostizIntegration } from '@/lib/content-studio/postiz';
import { DryRunSocialPublishingAdapter } from './adapters/dry-run';
import { PostizSocialPublishingAdapter } from './adapters/postiz';
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
  tryAcquirePublishJobLock,
  updatePublishJobStatus,
  upsertSocialAccount,
} from './repository';

const dryRunAdapter = new DryRunSocialPublishingAdapter();
const postizAdapter = new PostizSocialPublishingAdapter();

const adapters: Record<SocialProviderId, SocialPublishingAdapter | null> = {
  dry_run: dryRunAdapter,
  postiz: postizAdapter,
  meta_graph: null,
};

function adapterFor(provider: SocialProviderId): SocialPublishingAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new HttpError('invalid_state', `Provider ${provider} non disponible`);
  }
  return adapter;
}

export interface SyncSocialAccountsOptions {
  fetchPostizIntegrations?: () => Promise<PostizIntegration[]>;
  includePostiz?: boolean;
}

export async function syncSocialAccounts(
  options: SyncSocialAccountsOptions = {},
): Promise<SocialAccount[]> {
  const dryRun = await syncDryRunSocialAccounts();
  if (options.includePostiz === false) return dryRun;
  const postiz = await syncPostizSocialAccounts(options.fetchPostizIntegrations);
  return [...dryRun, ...postiz];
}

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

export async function syncPostizSocialAccounts(
  fetcher: (() => Promise<PostizIntegration[]>) | undefined = listPostizIntegrations,
): Promise<SocialAccount[]> {
  let integrations: PostizIntegration[] = [];
  try {
    integrations = await fetcher();
  } catch (err) {
    // Postiz peut être indisponible (clé manquante, réseau) ; on ne bloque pas
    // l'admin — les comptes dry_run restent utilisables. On log et on continue.
    console.warn('[social-publishing] listPostizIntegrations failed:', err instanceof Error ? err.message : err);
    return [];
  }
  const accounts: SocialAccount[] = [];
  for (const integration of integrations) {
    // Postiz expose la plateforme via `identifier` (ex: 'instagram', 'facebook',
    // 'instagram-business', 'facebook-page'). Le champ `provider` est rarement
    // peuplé. On essaie les deux pour la robustesse.
    const platform = mapPostizProviderToPlatform(integration.identifier ?? integration.provider);
    if (!platform) continue;
    const name = integration.name?.trim() || `Postiz ${platform}`;
    const account = await upsertSocialAccount({
      provider: 'postiz',
      platform,
      remoteId: integration.id,
      name,
      status: integration.disabled ? 'disabled' : 'active',
      capabilities: postizAdapter.listCapabilities({
        id: integration.id,
        provider: 'postiz',
        platform,
        remoteId: integration.id,
        name,
        status: integration.disabled ? 'disabled' : 'active',
        capabilities: [],
      }),
    });
    accounts.push(account);
  }
  return accounts;
}

function mapPostizProviderToPlatform(value: string | undefined): SocialPlatform | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'instagram' || lower.startsWith('instagram-')) return 'instagram';
  if (lower === 'facebook' || lower.startsWith('facebook-') || lower === 'facebook-page') return 'facebook';
  return null;
}

export async function listAdminSocialAccounts(): Promise<SocialAccount[]> {
  const accounts = await listSocialAccounts();
  return accounts.length > 0 ? accounts : syncSocialAccounts();
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
  const capability = adapterFor(account.provider)
    .listCapabilities(account)
    .find((item) => item.platform === content.platform && item.format === content.format);
  if (!capability) errors.push('Le compte social ne supporte pas ce format.');
  if (capability?.mediaRequired && content.media.length === 0) {
    errors.push('Aucun média n\'est associé au brouillon. Générez d\'abord un visuel via « Générer le visuel ».');
  }
  if (capability?.maxCaptionLength && content.caption.length > capability.maxCaptionLength) {
    errors.push(`La légende dépasse la limite de ${capability.maxCaptionLength} caractères.`);
  }
  if (content.media.some((media) => !media.url.startsWith('https://'))) {
    errors.push('Les médias doivent être servis en HTTPS public (vérifier NEXT_PUBLIC_SITE_URL et le stockage médias).');
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
  return executeJob({ jobId: job.id, actorId: input.actorId });
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
  return executeJob({ jobId: job.id, actorId: input.actorId });
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
  return executeJob({ jobId: job.id, actorId: job.requestedBy });
}

export async function executeJob(input: { jobId: string; actorId: string | null }): Promise<{ job: SocialPublishJob; result: SocialPublishResult }> {
  const existing = await getPublishJob(input.jobId);
  if (!existing) throw new HttpError('not_found', 'Job de publication introuvable.');
  if (existing.status === 'published') {
    return resultForExistingJob(existing);
  }
  const locked = await tryAcquirePublishJobLock({
    jobId: input.jobId,
    allowedFromStatuses: ['queued', 'failed'],
  });
  if (!locked) {
    const current = await getPublishJob(input.jobId);
    return {
      job: current ?? existing,
      result: {
        ok: false,
        status: 'failed',
        error: {
          code: 'invalid_request',
          message: 'Job not available for execution (locked or terminal)',
          retryable: false,
        },
      },
    };
  }
  const account = await getSocialAccount(locked.accountId);
  if (!account) throw new HttpError('not_found', 'Compte social introuvable.');
  const adapter = adapterFor(account.provider);
  const publishing = locked;
  const startedAt = Date.now();
  const result = await publishWithAdapter(adapter, {
    account,
    content: locked.content,
    idempotencyKey: locked.idempotencyKey,
    requestedBy: input.actorId,
    now: new Date(),
  });
  await recordPublishAttempt({
    jobId: locked.id,
    provider: account.provider,
    status: result.ok ? 'succeeded' : 'failed',
    request: { accountId: account.id, content: locked.content, idempotencyKey: locked.idempotencyKey },
    response: result.ok ? ((result.response.raw ?? result.response) as unknown as Record<string, unknown>) : {},
    error: result.ok ? null : result.error,
    durationMs: Date.now() - startedAt,
  });
  if (result.ok) {
    const publishedAt = new Date(result.response.publishedAt);
    await createPublication({
      jobId: locked.id,
      postId: locked.postId,
      accountId: account.id,
      provider: account.provider,
      platform: account.platform,
      remoteId: result.response.remoteId,
      permalink: result.response.permalink ?? null,
      publishedAt,
      metadata: result.response.raw ?? {},
    });
    await updatePostPlanning({ postId: locked.postId, scheduledAt: null, status: 'published' });
    const updated = await updatePublishJobStatus({ jobId: locked.id, status: 'published', publishedAt, lockedAt: null, lastError: null });
    return { job: updated ?? publishing, result };
  }
  const updated = await updatePublishJobStatus({
    jobId: locked.id,
    status: 'failed',
    lockedAt: null,
    lastError: {
      code: result.error.code,
      message: result.error.message,
      retryable: result.error.retryable,
    },
  });
  await updatePostPlanning({ postId: locked.postId, scheduledAt: null, status: 'failed' });
  return { job: updated ?? publishing, result };
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
  // Préférence dry_run actif (sécurité staging), puis premier compte actif compatible.
  const eligible = accounts.filter((account) => account.platform === platform && account.status === 'active');
  return (
    eligible.find((account) => account.provider === 'dry_run') ??
    eligible[0] ??
    null
  );
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
