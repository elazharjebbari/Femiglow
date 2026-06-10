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
  SocialPublishMode,
  SocialPublishResult,
  SocialPublishingAdapter,
} from './contracts';
import { listPostizIntegrations, type PostizIntegration } from '@/lib/content-studio/postiz';
import { DryRunSocialPublishingAdapter } from './adapters/dry-run';
import { PostizSocialPublishingAdapter } from './adapters/postiz';
import { publishWithAdapter } from './service';
import { sendSocialAlert } from './alerts';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import {
  assertSocialPublishJobTransition,
  canTransitionSocialPublishJob,
  nextRetryStatus,
} from './state-machine';
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
  updatePublishJobSchedule,
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
  const base = accounts.length > 0 ? accounts : await syncSocialAccounts();
  // ACT-BE-065 (BUG-065) : capabilities RECALCULÉES à la volée depuis le code
  // adapter (source unique), au lieu de servir les capabilities persistées
  // potentiellement périmées (supportsDraft / reel / story manquants).
  return base.map((account) => ({
    ...account,
    capabilities: adapterFor(account.provider).listCapabilities(account),
  }));
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
  const content = await buildSocialContent(post.id, draft, post.scheduledAt, account.provider);
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
    const asset = await getPrimaryAsset(draft.id);
    if (!asset) {
      errors.push('Aucun média n\'est associé au brouillon. Générez d\'abord un visuel via « Générer le visuel ».');
    } else {
      const media = await getMediaWithRelations(asset.mediaId);
      if (!media || media.deletedAt !== null) {
        errors.push('Le visuel associé au brouillon est introuvable ou supprimé. Re-générez un visuel.');
      } else if (media.status !== 'ready' && media.status !== 'passthrough') {
        errors.push(`Le visuel associé n'est pas encore prêt (statut: ${media.status}). Réessayez dans un instant.`);
      } else {
        errors.push('Le visuel associé n\'a pas d\'URL publique exploitable. Re-générez un visuel.');
      }
    }
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
    content: { ...publishability.content, publishMode: 'now' },
    status: 'queued',
    requestedBy: input.actorId,
  });
  return executeJob({ jobId: job.id, actorId: input.actorId });
}

/**
 * Send a content post to the provider in "review" / draft state, without
 * triggering an actual social publication. The post lands in the provider's
 * native UI (e.g. Postiz draft list) where a human can review and publish
 * it manually. Useful for 4-eyes workflows and final QA on Postiz's preview.
 *
 * Idempotency key suffix is "draft" so the same post can also be queued
 * via publishContentPostNow / scheduleContentPost without collision.
 */
export async function sendContentPostToDraft(input: {
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
  const capability = adapterFor(publishability.account.provider)
    .listCapabilities(publishability.account)
    .find(
      (cap) =>
        cap.platform === publishability.content.platform &&
        cap.format === publishability.content.format,
    );
  if (!capability?.supportsDraft) {
    throw new HttpError(
      'invalid_state',
      'Mode brouillon non supporté pour ce compte / format.',
    );
  }
  const key = explicitKey || defaultIdempotencyKey(input.postId, publishability.account.id, 'draft');
  const job = await createPublishJob({
    postId: input.postId,
    accountId: publishability.account.id,
    provider: publishability.account.provider,
    platform: publishability.content.platform,
    format: publishability.content.format,
    idempotencyKey: key,
    content: { ...publishability.content, publishMode: 'draft', scheduledAt: null },
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
  // Anti-double-publication : une seule programmation active par post. Sans
  // cette purge, deux appels /schedule avec des dates différentes créent deux
  // clés d'idempotence différentes → deux jobs queued → deux publications.
  await cancelPublishJobsForPost({
    postId: input.postId,
    actorId: input.actorId,
    publishModes: ['schedule'],
    reason: 're-programmation',
  });
  const key = input.idempotencyKey?.trim() || defaultIdempotencyKey(input.postId, publishability.account.id, input.scheduledAt.toISOString());
  const job = await createPublishJob({
    postId: input.postId,
    accountId: publishability.account.id,
    provider: publishability.account.provider,
    platform: publishability.content.platform,
    format: publishability.content.format,
    idempotencyKey: key,
    content: { ...publishability.content, publishMode: 'schedule', scheduledAt: input.scheduledAt },
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

/**
 * Annule tous les jobs encore annulables d'un post (queued/failed/draft/
 * approved — jamais un job en vol). Indispensable quand le post est annulé ou
 * re-programmé : sans cette purge, le scheduler exécuterait des jobs orphelins
 * (publication réelle d'un post annulé, double publication après re-schedule).
 */
export async function cancelPublishJobsForPost(input: {
  postId: string;
  actorId: string | null;
  publishModes?: SocialPublishMode[];
  reason?: string;
}): Promise<{ cancelledJobIds: string[] }> {
  const jobs = await listPublishJobs({ postId: input.postId });
  const cancelledJobIds: string[] = [];
  for (const job of jobs) {
    if (!canTransitionSocialPublishJob(job.status, 'cancelled')) continue;
    if (input.publishModes && !input.publishModes.includes(job.content.publishMode ?? 'now')) continue;
    await updatePublishJobStatus({ jobId: job.id, status: 'cancelled', lockedAt: null });
    cancelledJobIds.push(job.id);
  }
  if (cancelledJobIds.length > 0) {
    await logAuditEvent({
      action: 'social.jobs_cancelled',
      actorId: input.actorId,
      resourceType: 'content_post',
      resourceId: input.postId,
      meta: { jobIds: cancelledJobIds, reason: input.reason ?? null },
    });
  }
  return { cancelledJobIds };
}

/**
 * Re-cible les jobs schedule queued d'un post sur une nouvelle date.
 * Les jobs draft/now ne sont pas touchés.
 */
export async function reschedulePublishJobsForPost(input: {
  postId: string;
  scheduledAt: Date;
}): Promise<{ rescheduledJobIds: string[] }> {
  const jobs = await listPublishJobs({ postId: input.postId, status: 'queued' });
  const rescheduledJobIds: string[] = [];
  for (const job of jobs) {
    if ((job.content.publishMode ?? 'now') !== 'schedule') continue;
    await updatePublishJobSchedule({ jobId: job.id, scheduledAt: input.scheduledAt });
    rescheduledJobIds.push(job.id);
  }
  return { rescheduledJobIds };
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

export async function executeJob(input: {
  jobId: string;
  actorId: string | null;
  /** Injectable pour les tests ; la prod lit env.SOCIAL_PUBLISHING_MODE. */
  mode?: 'dry_run' | 'live';
}): Promise<{ job: SocialPublishJob; result: SocialPublishResult }> {
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
  // Kill-switch global (garde la plus externe) : tant que
  // SOCIAL_PUBLISHING_MODE n'est pas "live", aucun job ne peut s'exécuter sur
  // un compte réel — quel que soit le chemin qui a créé le job (publish-now,
  // schedule, retry, scheduler cron).
  const live = (input.mode ?? env.SOCIAL_PUBLISHING_MODE) === 'live';
  if (!live && account.provider !== 'dry_run') {
    const error = {
      code: 'invalid_request' as const,
      message: `Publication réelle bloquée (kill-switch) : SOCIAL_PUBLISHING_MODE≠live, compte "${account.provider}".`,
      retryable: false,
    };
    const blocked = await updatePublishJobStatus({ jobId: locked.id, status: 'failed', lockedAt: null, lastError: error });
    return { job: blocked ?? locked, result: { ok: false, status: 'failed', error } };
  }
  // Le job porte un snapshot figé à sa création ; le post source peut avoir
  // été annulé/archivé entre-temps (cas typique : job schedule exécuté par le
  // cron après une annulation). On re-vérifie l'état réel avant de publier.
  const sourcePost = await getPost(locked.postId);
  if (!sourcePost || sourcePost.status === 'cancelled' || sourcePost.status === 'archived') {
    const error = {
      code: 'invalid_request' as const,
      message: sourcePost
        ? `Post source "${sourcePost.status}" — publication refusée.`
        : 'Post source introuvable — publication refusée.',
      retryable: false,
    };
    const blocked = await updatePublishJobStatus({ jobId: locked.id, status: 'failed', lockedAt: null, lastError: error });
    return { job: blocked ?? locked, result: { ok: false, status: 'failed', error } };
  }
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
    // Draft mode does not actually publish the post on the social network —
    // it only lands in the provider's review queue (e.g. Postiz draft list).
    // Leave content_post.status untouched so the editorial workflow can still
    // queue a real publication (publish-now / schedule) afterwards.
    if (locked.content.publishMode !== 'draft') {
      await updatePostPlanning({ postId: locked.postId, scheduledAt: null, status: 'published' });
    } else {
      await logAuditEvent({
        action: 'social.draft_created',
        actorId: locked.requestedBy,
        resourceType: 'content_post',
        resourceId: locked.postId,
        meta: {
          jobId: locked.id,
          provider: account.provider,
          platform: account.platform,
          remoteId: result.response.remoteId,
          permalink: result.response.permalink ?? null,
        },
      });
    }
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
  if (locked.content.publishMode !== 'draft') {
    await updatePostPlanning({ postId: locked.postId, scheduledAt: null, status: 'failed' });
  }
  logger.error('social.publish.failed', {
    job_id: locked.id,
    post_id: locked.postId,
    provider: account.provider,
    platform: account.platform,
    publish_mode: locked.content.publishMode ?? 'inferred',
    error_code: result.error.code,
    error_message: result.error.message,
    retryable: result.error.retryable,
  });
  // Draft failures stay in the dashboard but do not page operators — they
  // are recoverable by retry from the UI and never affect the live timeline.
  if (locked.content.publishMode !== 'draft') {
    // Non-blocking webhook. We don't await with retries on purpose — if the
    // alert channel is down we still want the worker to make progress.
    void sendSocialAlert({
      title: `Publication ${account.provider}/${account.platform} échouée`,
      detail: result.error.message,
      severity: result.error.retryable ? 'warning' : 'critical',
      fields: [
        { label: 'jobId', value: locked.id },
        { label: 'postId', value: locked.postId },
        { label: 'errorCode', value: result.error.code },
        { label: 'retryable', value: String(result.error.retryable) },
      ],
    });
  }
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
  return resolveDefaultAccount(platform, {
    mode: env.SOCIAL_PUBLISHING_MODE,
    pinnedAccountId: env.SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID,
  });
}

/**
 * Choisit le compte social par défaut pour une plateforme.
 * Exporté avec injection (mode/pinnedAccountId) pour testabilité — la prod
 * appelle via {@link defaultAccountForPlatform} qui lit la config env.
 */
export async function resolveDefaultAccount(
  platform: SocialPlatform,
  opts: { mode?: 'dry_run' | 'live'; pinnedAccountId?: string | null } = {},
): Promise<SocialAccount | null> {
  const live = (opts.mode ?? env.SOCIAL_PUBLISHING_MODE) === 'live';

  let eligible = (await listAdminSocialAccounts()).filter(
    (account) => account.platform === platform && account.status === 'active',
  );

  if (!live) {
    // Mode dry_run (défaut, sécurité staging) : UNIQUEMENT le compte simulé.
    // Jamais de repli sur un compte réel — si aucun compte dry_run n'est actif,
    // on préfère échouer (null) plutôt que cibler un compte Postiz client.
    return eligible.find((account) => account.provider === 'dry_run') ?? null;
  }

  // Mode live : on publie réellement via Postiz. S'assurer que les comptes
  // Postiz sont bien synchronisés (ils ne le sont pas toujours en base si seuls
  // les comptes dry_run ont été persistés auparavant).
  if (!eligible.some((account) => account.provider === 'postiz')) {
    await syncSocialAccounts({ includePostiz: true });
    eligible = (await listSocialAccounts()).filter(
      (account) => account.platform === platform && account.status === 'active',
    );
  }

  // Compte cible explicitement épinglé (id interne OU remoteId Postiz).
  const pinned = opts.pinnedAccountId ?? env.SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID;
  if (pinned) {
    const match = eligible.find(
      (account) => account.id === pinned || account.remoteId === pinned,
    );
    if (match) return match;
  }

  // Sinon : premier compte Postiz actif, puis tout compte réel non-dry_run.
  // En mode live on évite délibérément de retomber sur dry_run.
  return (
    eligible.find((account) => account.provider === 'postiz') ??
    eligible.find((account) => account.provider !== 'dry_run') ??
    null
  );
}

async function buildSocialContent(postId: string, draft: Awaited<ReturnType<typeof getDraft>> & {}, scheduledAt: Date | null, accountProvider: string): Promise<SocialPublishContent> {
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
    // ACT-BE-023 (BUG-063) : dryRun reflète l'adapter RÉELLEMENT résolu, pas un
    // `true` forcé. Un post via l'adapter dry_run = simulé ; via Postiz = réel.
    metadata: { dryRun: accountProvider === 'dry_run', contentStudioDraftId: draft.id },
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
