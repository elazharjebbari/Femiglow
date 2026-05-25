/**
 * Gap #18 — Bridge database operations integrity test.
 *
 * Tests the bridgeToContentStudio flow with mocked repository functions
 * to verify correct creation order and data handling.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock content-studio repository
// ---------------------------------------------------------------------------
const mockCreateIdea = vi.fn();
const mockUpdateIdeaStatus = vi.fn();
const mockCreateBrief = vi.fn();
const mockCreateDrafts = vi.fn();
const mockUpdateDraft = vi.fn();
const mockInsertGenerationRun = vi.fn();
const mockUpsertPrimaryAsset = vi.fn();

vi.mock('@/lib/content-studio/repository', () => ({
  createIdea: (...args: unknown[]) => mockCreateIdea(...args),
  updateIdeaStatus: (...args: unknown[]) => mockUpdateIdeaStatus(...args),
  createBrief: (...args: unknown[]) => mockCreateBrief(...args),
  createDrafts: (...args: unknown[]) => mockCreateDrafts(...args),
  updateDraft: (...args: unknown[]) => mockUpdateDraft(...args),
  insertGenerationRun: (...args: unknown[]) => mockInsertGenerationRun(...args),
  upsertPrimaryAsset: (...args: unknown[]) => mockUpsertPrimaryAsset(...args),
}));

import { bridgeToContentStudio } from '../bridge/content-studio-bridge';
import type { GenerationResult, GenerationRequest } from '../orchestrator';

function makeResult(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    jobId: 'test-bridge-job-1',
    status: 'completed',
    script: { hook: 'Discover the secret', body: 'A beautiful ritual', cta: 'Shop now', visualDirection: [] },
    caption: 'Test caption for bridge',
    hashtags: ['femiglow', 'jbeauty', 'skincare'],
    images: [{ assetId: 'img-1', url: '/img.png', provider: 'mock', costCents: 0 }],
    videos: [],
    qualityScores: { average: 0.82, text_quality: 0.85, visual_quality: 0.79 },
    moderationResult: { safe: true },
    costTracking: { totalCents: 5, breakdown: {}, tokensUsed: {} },
    errors: [],
    durationMs: 1200,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      keyMessage: 'Test bridge message',
    },
    ...overrides,
  };
}

describe('integration: db-transaction (bridge)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    mockCreateIdea.mockResolvedValue({ id: 'idea-1' });
    mockUpdateIdeaStatus.mockResolvedValue(undefined);
    mockCreateBrief.mockResolvedValue({ id: 'brief-1' });
    mockCreateDrafts.mockResolvedValue([{ id: 'draft-1' }]);
    mockUpdateDraft.mockResolvedValue(undefined);
    mockInsertGenerationRun.mockResolvedValue(undefined);
    mockUpsertPrimaryAsset.mockResolvedValue(undefined);
  });

  it('bridgeToContentStudio creates idea, brief, draft in order', async () => {
    const callOrder: string[] = [];
    mockCreateIdea.mockImplementation(async () => {
      callOrder.push('createIdea');
      return { id: 'idea-1' };
    });
    mockCreateBrief.mockImplementation(async () => {
      callOrder.push('createBrief');
      return { id: 'brief-1' };
    });
    mockCreateDrafts.mockImplementation(async () => {
      callOrder.push('createDrafts');
      return [{ id: 'draft-1' }];
    });

    const result = await bridgeToContentStudio(makeResult(), makeRequest());

    expect(result.ideaId).toBe('idea-1');
    expect(result.briefId).toBe('brief-1');
    expect(result.draftId).toBe('draft-1');
    expect(callOrder).toEqual(['createIdea', 'createBrief', 'createDrafts']);
  });

  it('if draft creation fails, idea and brief still exist (no rollback)', async () => {
    mockCreateDrafts.mockRejectedValue(new Error('Draft insert failed'));

    await expect(
      bridgeToContentStudio(makeResult(), makeRequest()),
    ).rejects.toThrow();

    // Idea and brief were created before the draft failure
    expect(mockCreateIdea).toHaveBeenCalledTimes(1);
    expect(mockCreateBrief).toHaveBeenCalledTimes(1);
  });

  it('generation run is created with correct provider and cost', async () => {
    const genResult = makeResult({ costTracking: { totalCents: 12, breakdown: {}, tokensUsed: {} } });
    await bridgeToContentStudio(genResult, makeRequest());

    expect(mockInsertGenerationRun).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ai-engine-langgraph',
        model: 'langgraph-v1',
        costCents: 12,
        status: 'succeeded',
      }),
    );
  });

  it('mock image with provider=mock is skipped for asset binding', async () => {
    const result = makeResult({
      images: [{ assetId: 'img-1', url: '/img.png', provider: 'mock', costCents: 0 }],
    });

    await bridgeToContentStudio(result, makeRequest());

    // upsertPrimaryAsset should NOT be called for mock images
    expect(mockUpsertPrimaryAsset).not.toHaveBeenCalled();
  });

  it('scoreTotal is correctly calculated (average * 100)', async () => {
    const result = makeResult({
      qualityScores: { average: 0.82, text_quality: 0.85, visual_quality: 0.79 },
    });

    await bridgeToContentStudio(result, makeRequest());

    expect(mockUpdateDraft).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({ scoreTotal: 82 }),
    );
  });

  it('bridge failure does not crash (generation_run insert is non-critical)', async () => {
    mockInsertGenerationRun.mockRejectedValue(new Error('DB write failed'));

    // Should not throw — insertGenerationRun failure is caught
    const result = await bridgeToContentStudio(makeResult(), makeRequest());
    expect(result.ideaId).toBe('idea-1');
    expect(result.briefId).toBe('brief-1');
    expect(result.draftId).toBe('draft-1');
  });
});
