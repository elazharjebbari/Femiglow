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

vi.mock('@/lib/content-studio/repository', () => ({
  getDraft: vi.fn().mockResolvedValue({
    id: 'draft-001',
    briefId: 'brief-001',
    platform: 'instagram',
    format: 'post',
    caption: 'Beautiful skin starts here',
    status: 'draft',
  }),
  getPostForDraft: vi.fn().mockResolvedValue({
    id: 'post-001',
    draftId: 'draft-001',
    status: 'approved',
  }),
}));

vi.mock('@/lib/content-studio/service', () => ({
  approveContentDraft: vi.fn().mockResolvedValue({
    id: 'post-001',
    draftId: 'draft-001',
    status: 'approved',
  }),
}));

vi.mock('@/lib/social-publishing/admin-service', () => ({
  publishContentPostNow: vi.fn().mockResolvedValue({
    job: { id: 'pub-job-001', status: 'completed' },
    result: { postizId: 'pz-001', status: 'published' },
  }),
  scheduleContentPost: vi.fn().mockResolvedValue({
    job: { id: 'pub-job-002', status: 'scheduled' },
  }),
  syncSocialAccounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/admin/ai-engine/publish/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/ai-engine/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests — schedule mode validation
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/publish — schedule mode contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('returns 400 when mode=schedule without scheduledAt', async () => {
    const payload = {
      draftId: 'draft-001',
      mode: 'schedule',
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'invalid_input');
  });

  it('returns 201 when mode=schedule with valid future scheduledAt', async () => {
    const payload = {
      draftId: 'draft-001',
      mode: 'schedule',
      scheduledAt: '2026-12-01T10:00:00.000Z',
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.status).toBe('scheduled');
    expect(json).toHaveProperty('postId');
    expect(json).toHaveProperty('scheduledAt', '2026-12-01T10:00:00.000Z');
    expect(json).toHaveProperty('job');
    expect(json.job).toHaveProperty('id');
  });

  it('returns 201 when mode=schedule with past date (API does not reject past dates)', async () => {
    // The route uses z.string().datetime() which does not validate past/future.
    // This test documents current behavior: the API accepts past dates.
    const payload = {
      draftId: 'draft-001',
      mode: 'schedule',
      scheduledAt: '2020-01-01T10:00:00.000Z',
    };

    const res = await POST(makeRequest(payload));
    // Current behavior: 201 — the route does not enforce future-date check
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.status).toBe('scheduled');
    expect(json.scheduledAt).toBe('2020-01-01T10:00:00.000Z');
  });

  it('returns 201 when mode=now works without scheduledAt', async () => {
    const payload = {
      draftId: 'draft-001',
      mode: 'now',
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.status).toBe('published');
    expect(json).toHaveProperty('postId');
    expect(json).toHaveProperty('draftId', 'draft-001');
  });

  it('returns 400 when mode is an invalid value', async () => {
    const payload = {
      draftId: 'draft-001',
      mode: 'immediately',
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'invalid_input');
  });

  it('returns 400 when draftId is missing', async () => {
    const payload = {
      mode: 'now',
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'invalid_input');
  });
});
