import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobQueue } from './JobQueue';
import type { PublishJobRow } from './types';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeJob(overrides: Partial<PublishJobRow> = {}): PublishJobRow {
  const nowIso = new Date().toISOString();
  return {
    id: 'job_1',
    postId: 'post_xxx',
    status: 'queued',
    scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    attemptCount: 0,
    lastError: null,
    platform: 'instagram',
    format: 'post',
    provider: 'dry_run',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('<JobQueue />', () => {
  it('rend les jobs initiaux', () => {
    render(
      <JobQueue
        initialJobs={[makeJob({ id: 'j_a' }), makeJob({ id: 'j_b', status: 'failed' })]}
        pollIntervalMs={0}
      />,
    );
    expect(screen.getByTestId('job-row-j_a')).toBeInTheDocument();
    expect(screen.getByTestId('job-row-j_b')).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('Retry appelle l’endpoint POST /retry et rafraîchit la liste', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn()
      // 1) POST retry
      .mockResolvedValueOnce({ ok: true, json: async () => ({ job: makeJob() }) })
      // 2) GET refresh
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [] }) });

    render(
      <JobQueue
        initialJobs={[makeJob({ id: 'j_retry' })]}
        pollIntervalMs={0}
        fetcher={fetcher as unknown as typeof fetch}
      />,
    );

    await user.click(screen.getByTestId('job-retry-j_retry'));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        '/api/admin/content-studio/publish-jobs/j_retry/retry',
        { method: 'POST' },
      );
    });
  });

  it('Cancel appelle l’endpoint POST /cancel', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [] }) });

    render(
      <JobQueue
        initialJobs={[makeJob({ id: 'j_cancel' })]}
        pollIntervalMs={0}
        fetcher={fetcher as unknown as typeof fetch}
      />,
    );

    await user.click(screen.getByTestId('job-cancel-j_cancel'));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        '/api/admin/content-studio/publish-jobs/j_cancel/cancel',
        { method: 'POST' },
      );
    });
  });

  it('filtre les jobs au-delà de 7 jours après refresh', async () => {
    const user = userEvent.setup();
    const oldIso = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const recentIso = new Date().toISOString();
    const fetcher = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          { job: makeJob({ id: 'old', updatedAt: oldIso, status: 'failed' }) },
          { job: makeJob({ id: 'recent', updatedAt: recentIso, status: 'queued' }) },
        ],
      }),
    });

    render(
      <JobQueue
        initialJobs={[makeJob({ id: 'seed' })]}
        pollIntervalMs={0}
        fetcher={fetcher as unknown as typeof fetch}
      />,
    );

    await user.click(screen.getByText('Rafraîchir'));

    await waitFor(() => {
      expect(screen.queryByTestId('job-row-old')).not.toBeInTheDocument();
      expect(screen.getByTestId('job-row-recent')).toBeInTheDocument();
    });
  });
});
