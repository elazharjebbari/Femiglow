import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — factories are hoisted, no module-scope variable references
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

// -- DB mock (select, insert, update chains) --

const mockDbReturning = vi.fn().mockResolvedValue([]);
const mockDbWhere = vi.fn().mockReturnValue({ returning: mockDbReturning });
const mockDbSet = vi.fn().mockReturnValue({ where: mockDbWhere });
const mockDbValues = vi.fn().mockReturnValue({ returning: mockDbReturning });
const mockDbLimit = vi.fn().mockResolvedValue([]);
const mockDbSelectWhere = vi.fn().mockReturnValue({ limit: mockDbLimit });
const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectWhere, orderBy: vi.fn().mockResolvedValue([]) });

const mockDbOrderBy = vi.fn().mockResolvedValue([]);
const mockDbFrom = vi.fn().mockReturnValue({ orderBy: mockDbOrderBy });
const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbFrom });
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbValues });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbSet });

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => ({
    select: (...args: unknown[]) => {
      mockDbSelect(...args);
      return { from: (...fArgs: unknown[]) => {
        mockDbFrom(...fArgs);
        return {
          orderBy: mockDbOrderBy,
          where: (...wArgs: unknown[]) => {
            mockDbSelectWhere(...wArgs);
            return { limit: mockDbLimit };
          },
        };
      }};
    },
    insert: mockDbInsert,
    update: mockDbUpdate,
  })),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEnginePromptTemplates: { id: 'id', createdAt: 'createdAt', isActive: 'isActive', version: 'version' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ col: _col, val })),
  desc: vi.fn((col: unknown) => ({ col, dir: 'desc' })),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/admin/ai-engine/config/prompts/route';
import { DELETE } from '@/app/api/admin/ai-engine/config/prompts/[id]/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Test-scoped mock data
// ---------------------------------------------------------------------------

const mockPrompt = {
  id: 'prompt-001',
  nodeName: 'brief_analysis',
  name: 'Analyse de brief',
  systemPrompt: 'Tu es un directeur de creation...',
  userPromptTemplate: 'Analyse ce brief:\n\n{{objective}}',
  variables: ['objective', 'platform'],
  version: 1,
  isActive: true,
  parentId: null,
  avgQualityScore: null,
  usageCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/ai-engine/config/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/admin/ai-engine/config/prompts/${id}`, {
    method: 'DELETE',
  });
}

const validPromptPayload = {
  nodeName: 'brief_analysis',
  name: 'Test Prompt',
  systemPrompt: 'Tu es un expert en analyse.',
  userPromptTemplate: 'Analyse le contenu:\n\n{{content}}',
  variables: ['content'],
};

// ---------------------------------------------------------------------------
// Tests — GET /api/admin/ai-engine/config/prompts
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/config/prompts — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbOrderBy.mockResolvedValue([]);
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

  it('returns prompts array with status 200', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('prompts');
    expect(Array.isArray(json.prompts)).toBe(true);
  });

  it('returns default prompts when DB is empty', async () => {
    mockDbOrderBy.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.prompts.length).toBeGreaterThan(0);
    const nodeNames = json.prompts.map((p: { nodeName: string }) => p.nodeName);
    expect(nodeNames).toContain('brief_analysis');
    expect(nodeNames).toContain('script_writer');
    expect(nodeNames).toContain('caption_gen');
    expect(nodeNames).toContain('image_gen');
    expect(nodeNames).toContain('quality_gate');
  });

  it('each default prompt has correct shape', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    for (const prompt of json.prompts) {
      expect(prompt).toHaveProperty('id');
      expect(prompt).toHaveProperty('nodeName');
      expect(prompt).toHaveProperty('name');
      expect(prompt).toHaveProperty('systemPrompt');
      expect(prompt).toHaveProperty('userPromptTemplate');
      expect(prompt).toHaveProperty('variables');
      expect(prompt).toHaveProperty('version');
      expect(prompt).toHaveProperty('isActive');
      expect(prompt).toHaveProperty('createdAt');
      expect(Array.isArray(prompt.variables)).toBe(true);
      expect(typeof prompt.systemPrompt).toBe('string');
      expect(typeof prompt.userPromptTemplate).toBe('string');
    }
  });

  it('returns DB prompts when DB has rows', async () => {
    mockDbOrderBy.mockResolvedValue([mockPrompt]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.prompts.length).toBe(1);
    expect(json.prompts[0].id).toBe('prompt-001');
    expect(json.prompts[0].nodeName).toBe('brief_analysis');
    expect(json.prompts[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('default prompts have version 1', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    for (const prompt of json.prompts) {
      expect(prompt.version).toBe(1);
    }
  });

  it('default prompts have isActive true', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    for (const prompt of json.prompts) {
      expect(prompt.isActive).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/admin/ai-engine/config/prompts
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/config/prompts — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbReturning.mockResolvedValue([{
      id: 'prompt-new-001',
      ...validPromptPayload,
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: null,
      usageCount: 0,
      createdAt: new Date(),
    }]);
    mockDbLimit.mockResolvedValue([]);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await POST(makePostRequest(validPromptPayload));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 400 when name is missing', async () => {
    const { name: _, ...noName } = validPromptPayload;
    const res = await POST(makePostRequest(noName));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makePostRequest({ ...validPromptPayload, name: '' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when systemPrompt is missing', async () => {
    const { systemPrompt: _, ...noSys } = validPromptPayload;
    const res = await POST(makePostRequest(noSys));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when systemPrompt is empty string', async () => {
    const res = await POST(makePostRequest({ ...validPromptPayload, systemPrompt: '' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when nodeName is missing', async () => {
    const { nodeName: _, ...noNode } = validPromptPayload;
    const res = await POST(makePostRequest(noNode));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when nodeName is empty string', async () => {
    const res = await POST(makePostRequest({ ...validPromptPayload, nodeName: '' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when userPromptTemplate is missing', async () => {
    const { userPromptTemplate: _, ...noTemplate } = validPromptPayload;
    const res = await POST(makePostRequest(noTemplate));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when userPromptTemplate is empty string', async () => {
    const res = await POST(makePostRequest({ ...validPromptPayload, userPromptTemplate: '' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when variables is not an array', async () => {
    const res = await POST(makePostRequest({ ...validPromptPayload, variables: 'not-an-array' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('creates prompt with all required fields and returns 201', async () => {
    const res = await POST(makePostRequest(validPromptPayload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('prompt');
    expect(json.prompt).toHaveProperty('id');
  });

  it('creates prompt with empty variables array', async () => {
    const payload = { ...validPromptPayload, variables: [] };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('prompt');
  });

  it('creates prompt with isActive defaulting to true', async () => {
    const res = await POST(makePostRequest(validPromptPayload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.prompt.isActive).toBe(true);
  });

  it('creates prompt with explicit isActive=false', async () => {
    mockDbReturning.mockResolvedValue([{
      id: 'prompt-new-002',
      ...validPromptPayload,
      isActive: false,
      version: 1,
      parentId: null,
      avgQualityScore: null,
      usageCount: 0,
      createdAt: new Date(),
    }]);

    const res = await POST(makePostRequest({ ...validPromptPayload, isActive: false }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('prompt');
  });

  it('updates existing prompt and creates new version when id is provided', async () => {
    // The existing prompt returned by the select().from().where().limit() chain
    mockDbLimit.mockResolvedValue([{ ...mockPrompt, version: 2 }]);
    mockDbReturning.mockResolvedValue([{
      id: 'prompt-v3',
      ...validPromptPayload,
      version: 3,
      isActive: true,
      parentId: 'prompt-001',
      avgQualityScore: null,
      usageCount: 0,
      createdAt: new Date(),
    }]);

    const payload = { id: 'prompt-001', ...validPromptPayload };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('prompt');
  });

  it('creates prompt with parentId', async () => {
    const payload = { ...validPromptPayload, parentId: 'prompt-parent' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('prompt');
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE /api/admin/ai-engine/config/prompts/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/ai-engine/config/prompts/:id — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbReturning.mockResolvedValue([{
      id: 'prompt-001',
      isActive: false,
    }]);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await DELETE(makeDeleteRequest('prompt-001'), { params: Promise.resolve({ id: 'prompt-001' }) });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 200 with success:true on soft delete', async () => {
    const res = await DELETE(makeDeleteRequest('prompt-001'), { params: Promise.resolve({ id: 'prompt-001' }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 404 when prompt not found', async () => {
    mockDbReturning.mockResolvedValue([]);

    const res = await DELETE(makeDeleteRequest('nonexistent'), { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Prompt non trouve.');
  });
});
