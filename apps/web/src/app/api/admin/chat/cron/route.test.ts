/**
 * Tests route admin trigger manuel des crons chat.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/services/kb-sync', () => ({
  syncKnowledgeSources: vi.fn(),
}));

vi.mock('@/lib/chat/services/intent-recompute', () => ({
  recomputeAllCentroids: vi.fn(),
}));

vi.mock('@/lib/chat/services/budget-watch', () => ({
  watchProviderBudgets: vi.fn(),
}));

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { watchProviderBudgets } from '@/lib/chat/services/budget-watch';
import { recomputeAllCentroids } from '@/lib/chat/services/intent-recompute';
import { syncKnowledgeSources } from '@/lib/chat/services/kb-sync';
import { POST } from './route';

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const syncMock = syncKnowledgeSources as unknown as ReturnType<typeof vi.fn>;
const recomputeMock = recomputeAllCentroids as unknown as ReturnType<typeof vi.fn>;
const budgetMock = watchProviderBudgets as unknown as ReturnType<typeof vi.fn>;

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/cron', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formReq(body: Record<string, string>): NextRequest {
  const form = new URLSearchParams(body);
  return new NextRequest('http://localhost/api/admin/chat/cron', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/admin/chat/cron', () => {
  it('rejette si non authentifié (401)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await POST(jsonReq({ job: 'kb-sync' }));
    expect(res.status).toBe(401);
  });

  it('rejette un job inconnu (400)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    const res = await POST(jsonReq({ job: 'bogus' }));
    expect(res.status).toBe(400);
  });

  it('rejette payload sans job (400)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(400);
  });

  it('lance kb-sync et renvoie le rapport', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    syncMock.mockResolvedValueOnce({
      scanned: 3,
      refreshed: 2,
      unchanged: 1,
      errors: 0,
      errorDetails: [],
    });
    const res = await POST(jsonReq({ job: 'kb-sync' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { job: string; report: { scanned: number } };
    expect(body.job).toBe('kb-sync');
    expect(body.report.scanned).toBe(3);
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('lance budget-watch et renvoie le rapport', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    budgetMock.mockResolvedValueOnce({
      scanned: 2,
      warned: 1,
      disabled: 0,
      alerts: [],
    });
    const res = await POST(jsonReq({ job: 'budget-watch' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { job: string; report: { scanned: number } };
    expect(body.job).toBe('budget-watch');
    expect(body.report.scanned).toBe(2);
    expect(budgetMock).toHaveBeenCalledTimes(1);
    expect(syncMock).not.toHaveBeenCalled();
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('lance intent-recompute et renvoie le rapport', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    recomputeMock.mockResolvedValueOnce({
      examplesScanned: 12,
      intentsTouched: 4,
      centroidsInserted: 1,
      centroidsUpdated: 3,
      embeddingModel: 'text-embedding-3-small',
      skipped: null,
    });
    const res = await POST(jsonReq({ job: 'intent-recompute' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      job: string;
      report: { intentsTouched: number };
    };
    expect(body.report.intentsTouched).toBe(4);
    expect(recomputeMock).toHaveBeenCalledTimes(1);
  });

  it('form-encoded redirige 303 vers /admin/chat/system', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    syncMock.mockResolvedValueOnce({
      scanned: 0,
      refreshed: 0,
      unchanged: 0,
      errors: 0,
      errorDetails: [],
    });
    const res = await POST(formReq({ job: 'kb-sync' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(
      '/admin/chat/system?ok=cron-kb-sync',
    );
  });

  it('renvoie 500 si la job throws', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    syncMock.mockRejectedValueOnce(new Error('db down'));
    const res = await POST(jsonReq({ job: 'kb-sync' }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe('job-failed');
    expect(body.reason).toBe('db down');
  });
});
