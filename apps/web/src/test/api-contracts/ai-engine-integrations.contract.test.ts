import { describe, expect, it, vi, beforeEach } from 'vitest';

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

const mockListPostizIntegrations = vi.fn();

vi.mock('@/lib/content-studio/postiz', () => ({
  listPostizIntegrations: (...args: unknown[]) => mockListPostizIntegrations(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/ai-engine/integrations/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockIntegrations = [
  {
    id: 'int-001',
    provider: 'instagram',
    identifier: 'femiglow_ig',
    name: 'FemiGlow Instagram',
    disabled: false,
  },
  {
    id: 'int-002',
    provider: 'facebook',
    identifier: 'femiglow_fb',
    name: 'FemiGlow Facebook',
    disabled: true,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/integrations — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
    mockListPostizIntegrations.mockResolvedValue(mockIntegrations);
  });

  it('returns integrations array', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('integrations');
    expect(Array.isArray(json.integrations)).toBe(true);
    expect(json.integrations.length).toBe(2);
  });

  it('each integration has id, platform, name, disabled', async () => {
    const res = await GET();
    const json = await res.json();

    for (const integration of json.integrations) {
      expect(integration).toHaveProperty('id');
      expect(typeof integration.id).toBe('string');
      expect(integration).toHaveProperty('platform');
      expect(typeof integration.platform).toBe('string');
      expect(integration).toHaveProperty('name');
      expect(typeof integration.name).toBe('string');
      expect(integration).toHaveProperty('disabled');
      expect(typeof integration.disabled).toBe('boolean');
    }

    // Verify specific values
    expect(json.integrations[0].platform).toBe('instagram');
    expect(json.integrations[1].disabled).toBe(true);
  });

  it('returns empty array when Postiz returns no integrations', async () => {
    mockListPostizIntegrations.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.integrations).toEqual([]);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await GET();
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });
});
