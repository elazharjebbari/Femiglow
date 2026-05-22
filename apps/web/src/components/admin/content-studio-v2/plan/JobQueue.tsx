'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCcw, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button } from '../primitives';
import type { PublishJobRow } from './types';

interface JobQueueProps {
  /** Optional initial data (server-rendered first paint). */
  initialJobs?: PublishJobRow[];
  /** Polling interval (ms). Defaults to 30 s. Tests pass 0 to disable. */
  pollIntervalMs?: number;
  /** Test-only fetch injection. */
  fetcher?: typeof fetch;
  /** Endpoint overrides for tests. */
  listEndpoint?: string;
  retryEndpoint?: (jobId: string) => string;
  cancelEndpoint?: (jobId: string) => string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const FOCUS_STATUSES: PublishJobRow['status'][] = ['queued', 'publishing', 'failed'];

function statusTone(
  status: PublishJobRow['status'],
): 'neutral' | 'accent' | 'warning' | 'success' | 'danger' {
  switch (status) {
    case 'queued':
      return 'accent';
    case 'publishing':
      return 'warning';
    case 'published':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function JobQueue({
  initialJobs = [],
  pollIntervalMs = 30_000,
  fetcher = typeof fetch === 'function' ? fetch.bind(globalThis) : undefined,
  listEndpoint = '/api/admin/content-studio/publish-jobs',
  retryEndpoint = (id) => `/api/admin/content-studio/publish-jobs/${id}/retry`,
  cancelEndpoint = (id) => `/api/admin/content-studio/publish-jobs/${id}/cancel`,
}: JobQueueProps) {
  const [jobs, setJobs] = useState<PublishJobRow[]>(initialJobs);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const fetchJobs = useCallback(async () => {
    if (!fetcher) return;
    setLoading(true);
    try {
      const res = await fetcher(listEndpoint);
      if (!res.ok) throw new Error(`http_${res.status}`);
      const json = (await res.json()) as { jobs?: Array<{ job: PublishJobRow }> | PublishJobRow[] };
      const raw = json.jobs ?? [];
      const flattened: PublishJobRow[] = raw.map((entry) =>
        'job' in (entry as object)
          ? ((entry as { job: PublishJobRow }).job)
          : (entry as PublishJobRow),
      );
      const now = Date.now();
      const recent = flattened.filter((job) => {
        const ts = new Date(job.updatedAt ?? job.createdAt).getTime();
        if (!Number.isFinite(ts)) return true;
        return now - ts <= SEVEN_DAYS_MS;
      });
      const focused = recent.filter((job) => FOCUS_STATUSES.includes(job.status));
      if (mountedRef.current) setJobs(focused);
    } catch (err) {
      if (mountedRef.current) {
        toast.error(
          err instanceof Error ? `Échec rafraîchissement jobs : ${err.message}` : 'Échec rafraîchissement jobs.',
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetcher, listEndpoint]);

  useEffect(() => {
    mountedRef.current = true;
    // Initial refresh only if we have no seed data.
    if (initialJobs.length === 0) {
      void fetchJobs();
    }
    if (pollIntervalMs <= 0) return () => undefined;
    const interval = window.setInterval(() => {
      void fetchJobs();
    }, pollIntervalMs);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollIntervalMs]);

  const setBusy = useCallback((jobId: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }, []);

  const handleRetry = useCallback(
    async (job: PublishJobRow) => {
      if (!fetcher) return;
      setBusy(job.id, true);
      try {
        const res = await fetcher(retryEndpoint(job.id), { method: 'POST' });
        if (!res.ok) throw new Error(`http_${res.status}`);
        toast.success('Reprise demandée.');
        await fetchJobs();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Échec retry.');
      } finally {
        setBusy(job.id, false);
      }
    },
    [fetcher, fetchJobs, retryEndpoint, setBusy],
  );

  const handleCancel = useCallback(
    async (job: PublishJobRow) => {
      if (!fetcher) return;
      setBusy(job.id, true);
      try {
        const res = await fetcher(cancelEndpoint(job.id), { method: 'POST' });
        if (!res.ok) throw new Error(`http_${res.status}`);
        toast.success('Job annulé.');
        await fetchJobs();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Échec cancel.');
      } finally {
        setBusy(job.id, false);
      }
    },
    [fetcher, fetchJobs, cancelEndpoint, setBusy],
  );

  return (
    <section
      style={{
        marginTop: 24,
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '16px 18px',
      }}
      aria-labelledby="cs-plan-jobs-heading"
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            id="cs-plan-jobs-heading"
            style={{
              margin: 0,
              fontFamily: 'var(--cs-font-display)',
              fontSize: 'var(--cs-text-lg)',
              fontWeight: 600,
            }}
          >
            File de publication
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cs-fg-secondary)' }}>
            Jobs en attente, en cours ou échoués sur les 7 derniers jours. Refresh toutes les{' '}
            {Math.round(pollIntervalMs / 1000)} s.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={loading ? <Loader2 size={14} className="cs-spin" /> : <RefreshCcw size={14} />}
          onClick={() => void fetchJobs()}
          disabled={loading}
        >
          Rafraîchir
        </Button>
      </header>

      {jobs.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cs-fg-secondary)' }}>
          Aucun job actif dans la file.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {jobs.map((job) => {
            const busy = busyIds.has(job.id);
            return (
              <li
                key={job.id}
                data-testid={`job-row-${job.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--cs-radius-sm)',
                  border: '1px solid var(--cs-border-hair)',
                  background: 'var(--cs-bg-base)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge tone={statusTone(job.status)} size="sm">
                      {job.status}
                    </Badge>
                    <code style={{ fontSize: 11, color: 'var(--cs-fg-secondary)' }}>
                      {job.platform} · {job.format} · {job.provider}
                    </code>
                    <span style={{ fontSize: 11, color: 'var(--cs-fg-secondary)' }}>
                      tent. {job.attemptCount}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--cs-fg-secondary)' }}>
                    post {job.postId.slice(0, 8)} ·{' '}
                    {job.scheduledAt
                      ? new Date(job.scheduledAt).toLocaleString('fr-FR')
                      : 'sans horaire'}
                  </p>
                  {job.lastError ? (
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: 12,
                        color: 'var(--cs-danger)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AlertTriangle size={12} /> {job.lastError.message}
                    </p>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<RefreshCcw size={12} />}
                    onClick={() => void handleRetry(job)}
                    disabled={busy || job.status === 'publishing'}
                    data-testid={`job-retry-${job.id}`}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<XCircle size={12} />}
                    onClick={() => void handleCancel(job)}
                    disabled={busy || job.status === 'publishing'}
                    data-testid={`job-cancel-${job.id}`}
                  >
                    Annuler
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
