import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — factories are hoisted, no module-scope variable references
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/ai-engine/jobs', () => ({
  listJobs: vi.fn().mockResolvedValue([]),
  getJobStats: vi.fn().mockResolvedValue({ totalJobs: 0, totalCostCents: 0, averageDurationMs: 0 }),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/ai-engine/jobs/route';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { listJobs, getJobStats } from '@/lib/ai-engine/jobs';

// ---------------------------------------------------------------------------
// Test-scoped mock data
// ---------------------------------------------------------------------------

const mockJobs = [
  {
    id: 'job-001',
    ideaId: 'idea-001',
    status: 'completed',
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    currentStep: 'generateVariants',
    briefInput: { objective: 'engagement', keyMessage: 'Test' },
    caption: 'Beautiful skin starts here',
    hashtags: ['#beauty', '#skincare'],
    totalCostCents: 12,
    qualityScores: { average: 0.85 },
    durationMs: 3200,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'job-002',
    ideaId: null,
    status: 'failed',
    platform: 'tiktok',
    format: 'reel',
    contentType: 'rituel',
    currentStep: 'generateScript',
    briefInput: { objective: 'awareness', keyMessage: 'J-Beauty' },
    caption: '',
    hashtags: [],
    totalCostCents: 3,
    qualityScores: null,
    durationMs: 1100,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
];

const mockStats = { totalJobs: 42, totalCostCents: 560, averageDurationMs: 3500 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/admin/ai-engine/jobs');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/jobs — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listJobs as ReturnType<typeof vi.fn>).mockResolvedValue(mockJobs);
    (getJobStats as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('returns 200 with jobs array', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('jobs');
    expect(Array.isArray(json.jobs)).toBe(true);
    expect(json.jobs.length).toBe(2);
  });

  it('includes daily/weekly/monthly stats when stats=true', async () => {
    const res = await GET(makeRequest({ stats: 'true' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('stats');
    expect(json.stats).toHaveProperty('daily');
    expect(json.stats).toHaveProperty('weekly');
    expect(json.stats).toHaveProperty('monthly');
    expect(getJobStats).toHaveBeenCalledTimes(3);
  });

  it('each job has id, status, platform, and format', async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    for (const job of json.jobs) {
      expect(job).toHaveProperty('id');
      expect(typeof job.id).toBe('string');
      expect(job).toHaveProperty('status');
      expect(typeof job.status).toBe('string');
      expect(job).toHaveProperty('platform');
      expect(typeof job.platform).toBe('string');
      expect(job).toHaveProperty('format');
      expect(typeof job.format).toBe('string');
    }
  });

  it('status param is forwarded to listJobs', async () => {
    await GET(makeRequest({ status: 'completed' }));

    expect(listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('limit param is forwarded to listJobs', async () => {
    await GET(makeRequest({ limit: '10' }));

    expect(listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });
});
