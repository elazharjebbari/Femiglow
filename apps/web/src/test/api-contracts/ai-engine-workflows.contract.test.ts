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

const mockDbOrderBy = vi.fn().mockResolvedValue([]);
const mockDbFrom = vi.fn().mockReturnValue({ orderBy: mockDbOrderBy });
const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbFrom });
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbValues });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbSet });

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => ({
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  })),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineWorkflowConfigs: { id: 'id', createdAt: 'createdAt', isActive: 'isActive', updatedAt: 'updatedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ col: _col, val })),
  desc: vi.fn((col: unknown) => ({ col, dir: 'desc' })),
}));

vi.mock('@/lib/ai-engine/config', () => ({
  getEngineConfig: vi.fn().mockReturnValue({
    enabled: true,
    providers: {
      text: { default: 'openai', model: 'gpt-4o' },
      image: { default: 'openai', model: 'dall-e-3' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: {
      openai: 'sk-test',
      anthropic: undefined,
      google: undefined,
      elevenlabs: undefined,
      ollamaBaseUrl: undefined,
    },
    budget: { dailyCents: 10000, maxPerJobCents: 500 },
    quality: { threshold: 0.7, humanReviewRequired: true },
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  }),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/admin/ai-engine/config/workflows/route';
import { DELETE } from '@/app/api/admin/ai-engine/config/workflows/[id]/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Test-scoped mock data
// ---------------------------------------------------------------------------

const mockWorkflow = {
  id: 'wf-001',
  name: 'Reel Instagram',
  description: 'Pipeline complet pour reels',
  platform: 'instagram',
  format: 'reel',
  graphConfig: { nodes: ['brief_analysis', 'script_writer'], edges: [['brief_analysis', 'script_writer']] },
  defaultTone: 'professional',
  defaultLanguage: 'fr',
  qualityThreshold: '0.70',
  maxRetries: 3,
  maxBudgetCents: 500,
  humanReviewRequired: true,
  autoPublish: false,
  providerOverrides: null,
  version: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/ai-engine/config/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/admin/ai-engine/config/workflows/${id}`, {
    method: 'DELETE',
  });
}

const validWorkflowPayload = {
  name: 'Test Workflow',
  graphConfig: { nodes: ['brief_analysis'], edges: [] },
  defaultTone: 'professional',
  defaultLanguage: 'fr',
  qualityThreshold: '0.70',
  maxRetries: 3,
  maxBudgetCents: 100,
  humanReviewRequired: true,
  autoPublish: false,
};

// ---------------------------------------------------------------------------
// Tests — GET /api/admin/ai-engine/config/workflows
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/config/workflows — contract tests', () => {
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

  it('returns workflows array with status 200', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('workflows');
    expect(Array.isArray(json.workflows)).toBe(true);
  });

  it('returns default workflows when DB is empty', async () => {
    mockDbOrderBy.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.workflows.length).toBeGreaterThan(0);
    // Default workflows include Reel Instagram, Carrousel Instagram, Post TikTok
    const names = json.workflows.map((w: { name: string }) => w.name);
    expect(names).toContain('Reel Instagram');
    expect(names).toContain('Carrousel Instagram');
    expect(names).toContain('Post TikTok');
  });

  it('each default workflow has correct shape', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    for (const wf of json.workflows) {
      expect(wf).toHaveProperty('id');
      expect(wf).toHaveProperty('name');
      expect(wf).toHaveProperty('graphConfig');
      expect(wf).toHaveProperty('defaultTone');
      expect(wf).toHaveProperty('defaultLanguage');
      expect(wf).toHaveProperty('qualityThreshold');
      expect(wf).toHaveProperty('maxRetries');
      expect(wf).toHaveProperty('maxBudgetCents');
      expect(wf).toHaveProperty('humanReviewRequired');
      expect(wf).toHaveProperty('autoPublish');
      expect(wf).toHaveProperty('version');
      expect(wf).toHaveProperty('isActive');
      expect(wf).toHaveProperty('createdAt');
      expect(wf).toHaveProperty('updatedAt');
    }
  });

  it('returns DB workflows when DB has rows', async () => {
    mockDbOrderBy.mockResolvedValue([mockWorkflow]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.workflows.length).toBe(1);
    expect(json.workflows[0].id).toBe('wf-001');
    expect(json.workflows[0].name).toBe('Reel Instagram');
    expect(json.workflows[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns empty array concept — defaults when DB empty', async () => {
    mockDbOrderBy.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    // Even when DB is empty, defaults are returned
    expect(json.workflows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/admin/ai-engine/config/workflows
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/config/workflows — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbReturning.mockResolvedValue([{
      id: 'wf-new-001',
      ...validWorkflowPayload,
      description: null,
      platform: null,
      format: null,
      providerOverrides: null,
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await POST(makePostRequest(validWorkflowPayload));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 400 when name is missing', async () => {
    const { name: _, ...noName } = validWorkflowPayload;
    const res = await POST(makePostRequest(noName));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makePostRequest({ ...validWorkflowPayload, name: '' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when graphConfig is missing', async () => {
    const { graphConfig: _, ...noGraph } = validWorkflowPayload;
    const res = await POST(makePostRequest(noGraph));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when maxRetries is negative', async () => {
    const res = await POST(makePostRequest({ ...validWorkflowPayload, maxRetries: -1 }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when maxBudgetCents is negative', async () => {
    const res = await POST(makePostRequest({ ...validWorkflowPayload, maxBudgetCents: -50 }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('creates workflow with required fields and returns 201', async () => {
    const res = await POST(makePostRequest(validWorkflowPayload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
    expect(json.workflow).toHaveProperty('id');
  });

  it('creates workflow with optional description', async () => {
    const payload = { ...validWorkflowPayload, description: 'A test workflow' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });

  it('creates workflow with platform and format', async () => {
    const payload = { ...validWorkflowPayload, platform: 'instagram', format: 'reel' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });

  it('updates existing workflow when id is provided', async () => {
    mockDbReturning.mockResolvedValue([{
      id: 'wf-001',
      ...validWorkflowPayload,
      name: 'Updated Workflow',
      description: null,
      platform: null,
      format: null,
      providerOverrides: null,
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const payload = { id: 'wf-001', ...validWorkflowPayload, name: 'Updated Workflow' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });

  it('uses default values for optional fields', async () => {
    // Only required fields: name + graphConfig
    const minimal = {
      name: 'Minimal Workflow',
      graphConfig: { nodes: ['brief_analysis'], edges: [] },
    };
    const res = await POST(makePostRequest(minimal));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });

  it('accepts maxRetries as 0', async () => {
    const res = await POST(makePostRequest({ ...validWorkflowPayload, maxRetries: 0 }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });

  it('accepts maxBudgetCents as 0', async () => {
    const res = await POST(makePostRequest({ ...validWorkflowPayload, maxBudgetCents: 0 }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });

  it('accepts providerOverrides as null', async () => {
    const res = await POST(makePostRequest({ ...validWorkflowPayload, providerOverrides: null }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });

  it('accepts providerOverrides as an object', async () => {
    const res = await POST(makePostRequest({
      ...validWorkflowPayload,
      providerOverrides: { text: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' } },
    }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('workflow');
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE /api/admin/ai-engine/config/workflows/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/ai-engine/config/workflows/:id — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbReturning.mockResolvedValue([{
      id: 'wf-001',
      isActive: false,
      updatedAt: new Date(),
    }]);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await DELETE(makeDeleteRequest('wf-001'), { params: Promise.resolve({ id: 'wf-001' }) });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 200 with success:true on soft delete', async () => {
    const res = await DELETE(makeDeleteRequest('wf-001'), { params: Promise.resolve({ id: 'wf-001' }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 404 when workflow not found', async () => {
    mockDbReturning.mockResolvedValue([]);

    const res = await DELETE(makeDeleteRequest('nonexistent'), { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Workflow non trouve.');
  });
});
