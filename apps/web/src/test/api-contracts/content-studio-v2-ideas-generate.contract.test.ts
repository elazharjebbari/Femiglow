import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const generateIdeaDrafts = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  generateIdeaDrafts: (...args: unknown[]) => generateIdeaDrafts(...args),
}));

import { POST } from '@/app/api/admin/content-studio/ideas/[id]/generate/route';

function req(body: unknown = {}): Request {
  return new Request('http://test.local/api/admin/content-studio/ideas/idea_1/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/content-studio/ideas/:id/generate — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateIdeaDrafts.mockResolvedValue({
      idea: { id: 'idea_1', status: 'generated' },
      brief: { id: 'brief_1', ideaId: 'idea_1', version: 1 },
      drafts: [
        { id: 'd1', briefId: 'brief_1', variantLabel: 'A' },
        { id: 'd2', briefId: 'brief_1', variantLabel: 'B' },
        { id: 'd3', briefId: 'brief_1', variantLabel: 'C' },
      ],
    });
  });

  it('returns 200 with empty body (legacy callers)', async () => {
    const res = await POST(req({}), { params: { id: 'idea_1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.drafts.length).toBe(3);
  });

  it('passes model through when present (CS v2 Phase 2)', async () => {
    await POST(req({ model: 'gpt-4o' }), { params: { id: 'idea_1' } });
    const call = generateIdeaDrafts.mock.calls[0]?.[0];
    expect((call as { model?: string }).model).toBe('gpt-4o');
  });

  it('passes ideaId from path params', async () => {
    await POST(req({}), { params: { id: 'some_idea_id' } });
    const call = generateIdeaDrafts.mock.calls[0]?.[0];
    expect((call as { ideaId?: string }).ideaId).toBe('some_idea_id');
  });

  it('handles missing body gracefully (no body at all)', async () => {
    const r = new Request(
      'http://test.local/api/admin/content-studio/ideas/idea_1/generate',
      { method: 'POST' },
    );
    const res = await POST(r, { params: { id: 'idea_1' } });
    expect(res.status).toBe(200);
  });

  it('returns 500 when service throws', async () => {
    generateIdeaDrafts.mockRejectedValueOnce(new Error('budget exceeded'));
    const res = await POST(req(), { params: { id: 'idea_1' } });
    expect(res.status).toBe(500);
  });

  it('ignores extra fields in body (Zod optional strict)', async () => {
    // ideasGenerateSchema is .strict() but model is the only field. Extra
    // fields should fail parsing, but the route swallows that as undefined.
    const res = await POST(req({ unknownField: 'x' }), { params: { id: 'idea_1' } });
    expect(res.status).toBe(200);
    const call = generateIdeaDrafts.mock.calls[0]?.[0];
    expect((call as { model?: string }).model).toBeUndefined();
  });
});
