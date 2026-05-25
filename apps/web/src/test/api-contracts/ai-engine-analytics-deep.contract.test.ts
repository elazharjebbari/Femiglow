import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// Mock DB to return null so the route falls back to mock analytics
vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => null),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineGenerationJobs: {},
  aiEngineCostLedger: {},
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  gte: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/ai-engine/analytics/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(url = 'http://localhost:3000/api/admin/ai-engine/analytics'): NextRequest {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/analytics — deep contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('returns overview object with generation and cost fields', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('overview');
    expect(json.overview).toHaveProperty('generationsToday');
    expect(json.overview).toHaveProperty('generationsWeek');
    expect(json.overview).toHaveProperty('generationsMonth');
    expect(json.overview).toHaveProperty('costTodayCents');
    expect(json.overview).toHaveProperty('costWeekCents');
    expect(json.overview).toHaveProperty('costMonthCents');
    expect(json.overview).toHaveProperty('avgQualityScore');
    expect(json.overview).toHaveProperty('successRate');
    expect(json.overview).toHaveProperty('errorRate');
    expect(typeof json.overview.generationsToday).toBe('number');
    expect(typeof json.overview.avgQualityScore).toBe('number');
  });

  it('includes nodeMetrics array in the response (mock analytics always includes them)', async () => {
    const req = makeGetRequest('http://localhost:3000/api/admin/ai-engine/analytics?includeNodeMetrics=true');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('nodeMetrics');
    expect(Array.isArray(json.nodeMetrics)).toBe(true);
    expect(json.nodeMetrics.length).toBeGreaterThan(0);
  });

  it('each nodeMetric has nodeId, label, provider, avgLatencyMs', async () => {
    const req = makeGetRequest('http://localhost:3000/api/admin/ai-engine/analytics?includeNodeMetrics=true');
    const res = await GET(req);
    const json = await res.json();

    for (const metric of json.nodeMetrics) {
      expect(metric).toHaveProperty('nodeId');
      expect(typeof metric.nodeId).toBe('string');
      expect(metric).toHaveProperty('label');
      expect(typeof metric.label).toBe('string');
      expect(metric).toHaveProperty('provider');
      expect(typeof metric.provider).toBe('string');
      expect(metric).toHaveProperty('avgLatencyMs');
      expect(typeof metric.avgLatencyMs).toBe('number');
    }
  });

  it('period=day is accepted without error', async () => {
    const req = makeGetRequest('http://localhost:3000/api/admin/ai-engine/analytics?period=day');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('overview');
  });

  it('period=week is accepted without error', async () => {
    const req = makeGetRequest('http://localhost:3000/api/admin/ai-engine/analytics?period=week');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('overview');
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });
});
