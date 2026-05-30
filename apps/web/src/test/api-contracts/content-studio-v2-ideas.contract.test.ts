import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const createContentIdea = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  createContentIdea: (...args: unknown[]) => createContentIdea(...args),
  listIdeas: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/content-studio/idempotency', () => ({
  getIdempotencyKey: vi.fn().mockReturnValue(null),
  getExistingResponse: vi.fn().mockResolvedValue(null),
  storeIdempotentResponse: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/admin/content-studio/ideas/route';

function makeReq(body: unknown): Request {
  return new Request('http://test.local/api/admin/content-studio/ideas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  pillar: 'rituel',
  objective: 'consideration',
  platform: 'instagram',
  format: 'post',
  prompt: 'Présenter le rituel du soir comme un geste lent et apaisant.',
};

describe('POST /api/admin/content-studio/ideas — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createContentIdea.mockResolvedValue({ id: 'idea_1', ...validBody, status: 'idea' });
  });

  it('returns 201 with valid payload', async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.idea.id).toBe('idea_1');
  });

  it('returns 400 when prompt < 8 chars', async () => {
    const res = await POST(makeReq({ ...validBody, prompt: 'short' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when pillar missing', async () => {
    const { pillar: _p, ...without } = validBody;
    const res = await POST(makeReq(without));
    expect(res.status).toBe(400);
  });

  it('accepts model field (CS v2 Phase 2)', async () => {
    const res = await POST(makeReq({ ...validBody, model: 'gpt-4o' }));
    expect(res.status).toBe(201);
  });

  it('strips model before passing to createContentIdea (not persisted on idea row)', async () => {
    await POST(makeReq({ ...validBody, model: 'gpt-4o' }));
    const call = createContentIdea.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect((call as Record<string, unknown>).model).toBeUndefined();
    expect((call as Record<string, unknown>).pillar).toBe('rituel');
  });

  it('returns 400 on extra unknown field (strict schema)', async () => {
    const res = await POST(makeReq({ ...validBody, randomKey: 'x' }));
    expect(res.status).toBe(400);
  });
});
