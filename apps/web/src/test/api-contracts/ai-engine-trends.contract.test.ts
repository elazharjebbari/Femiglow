import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — factories are hoisted, so no module-scope variable references inside
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/ai-engine/trends', () => ({
  getTrends: vi.fn().mockResolvedValue([]),
  clearTrendCache: vi.fn(),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/ai-engine/trends/route';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { getTrends } from '@/lib/ai-engine/trends';

// ---------------------------------------------------------------------------
// Test-scoped mock data
// ---------------------------------------------------------------------------

const mockTrends = [
  {
    id: 'trend-001',
    source: 'seasonal',
    category: 'routine',
    title: 'Camellia Oil Night Routine',
    description: 'J-Beauty evening ritual trending on social media',
    brandRelevance: 0.82,
    viralPotential: 0.65,
    timeSensitivity: 0.6,
    contentFeasibility: 0.85,
    compositeScore: 0.75,
    suggestedFormats: ['carousel', 'reel'],
    suggestedHooks: ['Le secret que personne ne vous dit'],
    opportunityWindow: '2 weeks',
    riskAssessment: 'low',
    detectedAt: new Date().toISOString(),
    status: 'new',
  },
  {
    id: 'trend-002',
    source: 'reddit',
    category: 'ingredient',
    title: 'Rice Water for Nails',
    description: 'Reddit community discovers benefits of rice water',
    brandRelevance: 0.7,
    viralPotential: 0.72,
    timeSensitivity: 0.85,
    contentFeasibility: 0.85,
    compositeScore: 0.55,
    suggestedFormats: ['reel', 'carousel'],
    suggestedHooks: ['J\'ai teste ce truc japonais'],
    opportunityWindow: '1 week',
    riskAssessment: 'low',
    detectedAt: new Date().toISOString(),
    status: 'new',
  },
  {
    id: 'trend-003',
    source: 'google_trends',
    category: 'product',
    title: 'Matcha Skincare',
    description: 'Search interest surging for matcha beauty products',
    brandRelevance: 0.6,
    viralPotential: 0.5,
    timeSensitivity: 0.7,
    contentFeasibility: 0.9,
    compositeScore: 0.35,
    suggestedFormats: ['post', 'carousel'],
    suggestedHooks: ['Pourquoi le matcha est partout'],
    opportunityWindow: '1 week',
    riskAssessment: 'low',
    detectedAt: new Date().toISOString(),
    status: 'new',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/admin/ai-engine/trends');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/trends — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTrends as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrends);
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('returns 200 with trends array and meta', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('trends');
    expect(Array.isArray(json.trends)).toBe(true);
    expect(json).toHaveProperty('meta');
  });

  it('each trend has id, title, and compositeScore', async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    for (const trend of json.trends) {
      expect(trend).toHaveProperty('id');
      expect(typeof trend.id).toBe('string');
      expect(trend).toHaveProperty('title');
      expect(typeof trend.title).toBe('string');
      expect(trend).toHaveProperty('compositeScore');
      expect(typeof trend.compositeScore).toBe('number');
    }
  });

  it('meta has count and timestamp', async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.meta).toHaveProperty('count');
    expect(typeof json.meta.count).toBe('number');
    expect(json.meta.count).toBe(mockTrends.length);
    expect(json.meta).toHaveProperty('timestamp');
    expect(Number.isNaN(Date.parse(json.meta.timestamp))).toBe(false);
  });

  it('minScore param is forwarded to getTrends', async () => {
    await GET(makeRequest({ minScore: '0.6' }));

    expect(getTrends).toHaveBeenCalledWith(
      expect.objectContaining({ minScore: 0.6 }),
    );
  });

  it('limit param is forwarded to getTrends', async () => {
    await GET(makeRequest({ limit: '5' }));

    expect(getTrends).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
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
