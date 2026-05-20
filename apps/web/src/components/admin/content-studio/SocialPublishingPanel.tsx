'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ContentDraft, ContentPost, ContentStatus } from '@/lib/content-studio/types';
import type {
  SocialAccount,
  SocialPublishContent,
  SocialPublishEvent,
  SocialPublishJob,
  SocialPublication,
} from '@/lib/social-publishing/contracts';
import { getJson, postJson } from './api';
import { SectionTitle } from './SectionTitle';

interface PublishabilityResponse {
  publishability: {
    postId: string;
    account: SocialAccount;
    publishable: boolean;
    content: SocialPublishContent;
    warnings: string[];
    errors: string[];
  };
}

interface JobsResponse {
  jobs: JobEnvelope[];
}

interface JobResponse extends JobEnvelope {}

interface JobEnvelope {
  job: SocialPublishJob;
  events: SocialPublishEvent[];
  publications: SocialPublication[];
}

interface PublishResponse {
  job: SocialPublishJob;
  result: { ok: boolean; status: string };
}

interface ScheduleResponse {
  job: SocialPublishJob;
}

interface Props {
  post: ContentPost | null;
  draft: ContentDraft | null;
  disabled: boolean;
  onPostStatusChange: (postId: string, patch: { status: ContentStatus; scheduledAt?: Date | string | null; publishedAt?: Date | string | null }) => void;
  setMessage: (message: string | null) => void;
}

export function SocialPublishingPanel({
  post,
  draft,
  disabled,
  onPostStatusChange,
  setMessage,
}: Props) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [publishability, setPublishability] = useState<PublishabilityResponse['publishability'] | null>(null);
  const [jobs, setJobs] = useState<JobEnvelope[]>([]);
  const [scheduledAt, setScheduledAt] = useState(defaultDateTimeLocal());
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accounts, accountId],
  );

  useEffect(() => {
    if (!post) return;
    let cancelled = false;
    void refreshAll().catch((err: unknown) => {
      if (!cancelled) setLocalError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  useEffect(() => {
    if (!post || !accountId) return;
    void refreshPublishability().catch((err: unknown) => setLocalError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, post?.id]);

  if (!post || !draft) {
    return (
      <section className="rounded-md border border-stone-200 bg-white p-4">
        <SectionTitle
          eyebrow="Publication"
          title="Publication directe"
          tone="stone"
          description="Sélectionnez un brouillon approuvé pour préparer la publication."
        />
      </section>
    );
  }

  const currentPost = post;
  const currentDraft = draft;
  const isBlocked = disabled || busy;
  const isPublishable = Boolean(publishability?.publishable);

  return (
    <section className="rounded-md border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionTitle
          eyebrow="Publication"
          title="Publication directe"
          tone="teal"
          description="Publier ou programmer depuis Femiglow en dry-run, sans validation Postiz."
        />
        <button
          type="button"
          disabled={isBlocked}
          onClick={() => void runAction(syncAccounts)}
          className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-950 disabled:opacity-50"
        >
          Sync comptes
        </button>
      </div>

      {localError ? (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {localError}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(180px,260px)_1fr]">
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Compte</span>
          <select
            value={accountId}
            disabled={isBlocked || accounts.length === 0}
            onChange={(event) => setAccountId(event.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          >
            {accounts.length === 0 ? <option value="">Aucun compte dry-run</option> : null}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.platform}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-md border border-white bg-white/80 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={currentPost.status} tone={currentPost.status === 'published' ? 'emerald' : currentPost.status === 'failed' ? 'red' : 'stone'} />
            {selectedAccount ? <StatusBadge label={`${selectedAccount.provider}/${selectedAccount.platform}`} tone="stone" /> : null}
            {publishability ? (
              <StatusBadge label={publishability.publishable ? 'publiable' : 'bloqué'} tone={publishability.publishable ? 'emerald' : 'red'} />
            ) : null}
          </div>
          <p className="mt-2 line-clamp-3 text-stone-700">{publishability?.content.caption ?? currentDraft.caption}</p>
          {publishability?.content.media[0] ? (
            <p className="mt-1 truncate text-xs text-stone-500">Média: {publishability.content.media[0].url}</p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">Aucun média public détecté.</p>
          )}
        </div>
      </div>

      {publishability?.errors.length ? (
        <ul className="mt-3 space-y-1 rounded-md border border-red-100 bg-white px-3 py-2 text-sm text-red-800">
          {publishability.errors.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {publishability?.warnings.length ? (
        <ul className="mt-3 space-y-1 rounded-md border border-amber-100 bg-white px-3 py-2 text-sm text-amber-800">
          {publishability.warnings.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Programmer</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            disabled={isBlocked}
            onChange={(event) => setScheduledAt(event.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          />
        </label>
        <button
          type="button"
          disabled={isBlocked || !isPublishable}
          onClick={() => void runAction(schedule)}
          className="self-end rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-950 disabled:opacity-50"
        >
          Programmer
        </button>
        <button
          type="button"
          disabled={isBlocked || !isPublishable || currentPost.status === 'published'}
          onClick={() => {
            if (window.confirm('Publier maintenant en dry-run depuis Femiglow ?')) {
              void runAction(publishNow);
            }
          }}
          className="self-end rounded-md bg-emerald-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Publier maintenant
        </button>
      </div>

      <div className="mt-4 rounded-md border border-emerald-100 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Jobs récents</p>
          <button type="button" disabled={isBlocked} onClick={() => void runAction(refreshJobs)} className="text-xs font-medium text-emerald-900 underline-offset-2 hover:underline">
            Rafraîchir
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Aucun job de publication pour ce post.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {jobs.map((item) => (
              <li key={item.job.id} className="rounded border border-stone-100 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={item.job.status} tone={item.job.status === 'published' ? 'emerald' : item.job.status === 'failed' ? 'red' : item.job.status === 'cancelled' ? 'stone' : 'amber'} />
                    <span className="text-xs text-stone-500">{item.job.platform}/{item.job.format}</span>
                    <span className="text-xs text-stone-500">tentatives: {item.job.attemptCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={isBlocked || item.job.status !== 'failed'} onClick={() => void runAction(() => retry(item.job.id))} className="text-xs font-medium text-emerald-900 disabled:text-stone-400">
                      Retry
                    </button>
                    <button type="button" disabled={isBlocked || item.job.status === 'published' || item.job.status === 'cancelled'} onClick={() => void runAction(() => cancel(item.job.id))} className="text-xs font-medium text-red-700 disabled:text-stone-400">
                      Annuler
                    </button>
                  </div>
                </div>
                {item.publications[0]?.permalink ? (
                  <a href={item.publications[0].permalink} className="mt-1 block truncate text-xs text-emerald-800 underline-offset-2 hover:underline">
                    {item.publications[0].permalink}
                  </a>
                ) : null}
                {item.events.length > 0 ? (
                  <ol className="mt-2 space-y-1 text-xs text-stone-500">
                    {item.events.slice(0, 4).map((event) => (
                      <li key={event.id}>{event.type}: {event.message}</li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  async function refreshAll() {
    await syncAccounts();
    await refreshJobs();
  }

  async function syncAccounts() {
    const value = await postJson<{ accounts: SocialAccount[] }>('/api/admin/social/accounts/sync', {});
    setAccounts(value.accounts);
    const compatible = value.accounts.find((account) => account.platform === currentDraft.platform) ?? value.accounts[0];
    if (compatible) setAccountId((current) => current || compatible.id);
  }

  async function refreshPublishability() {
    if (!accountId) return;
    const value = await getJson<PublishabilityResponse>(`/api/admin/content-studio/posts/${currentPost.id}/publishability?accountId=${encodeURIComponent(accountId)}`);
    setPublishability(value.publishability);
  }

  async function refreshJobs() {
    const value = await getJson<JobsResponse>(`/api/admin/content-studio/publish-jobs?postId=${encodeURIComponent(currentPost.id)}`);
    setJobs(value.jobs);
  }

  async function publishNow() {
    const value = await postJson<PublishResponse>(`/api/admin/content-studio/posts/${currentPost.id}/publish-now`, {
      accountId: accountId || undefined,
      idempotencyKey: `ui:${currentPost.id}:${accountId || 'default'}:now`,
    });
    upsertJob(value.job);
    if (value.job.status === 'published') {
      onPostStatusChange(currentPost.id, { status: 'published', publishedAt: value.job.publishedAt });
    }
    setMessage('Publication dry-run effectuée.');
    await refreshJobs();
  }

  async function schedule() {
    const date = new Date(scheduledAt);
    const value = await postJson<ScheduleResponse>(`/api/admin/content-studio/posts/${currentPost.id}/schedule`, {
      accountId: accountId || undefined,
      scheduledAt: date.toISOString(),
      idempotencyKey: `ui:${currentPost.id}:${accountId || 'default'}:${date.toISOString()}`,
    });
    upsertJob(value.job);
    onPostStatusChange(currentPost.id, { status: 'scheduled', scheduledAt: value.job.scheduledAt });
    setMessage('Publication dry-run programmée.');
    await refreshJobs();
  }

  async function retry(jobId: string) {
    const value = await postJson<PublishResponse>(`/api/admin/content-studio/publish-jobs/${jobId}/retry`, {});
    upsertJob(value.job);
    if (value.job.status === 'published') onPostStatusChange(currentPost.id, { status: 'published', publishedAt: value.job.publishedAt });
    setMessage('Retry dry-run exécuté.');
    await refreshJobs();
  }

  async function cancel(jobId: string) {
    const value = await postJson<ScheduleResponse>(`/api/admin/content-studio/publish-jobs/${jobId}/cancel`, {});
    upsertJob(value.job);
    setMessage('Job de publication annulé.');
    await refreshJobs();
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setLocalError(null);
    try {
      await action();
      await refreshPublishability();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function upsertJob(job: SocialPublishJob) {
    setJobs((current) => {
      const next = current.filter((item) => item.job.id !== job.id);
      return [{ job, events: [], publications: [] }, ...next];
    });
  }
}

function StatusBadge({ label, tone }: { label: string; tone: 'emerald' | 'red' | 'amber' | 'stone' }) {
  const classes = {
    emerald: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    stone: 'bg-stone-100 text-stone-700',
  }[tone];
  return <span className={`rounded px-2 py-1 text-xs font-medium ${classes}`}>{label}</span>;
}

function defaultDateTimeLocal(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
