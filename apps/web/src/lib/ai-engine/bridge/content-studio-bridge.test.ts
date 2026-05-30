import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for repository
// ---------------------------------------------------------------------------
const mockCreateIdea = vi.fn().mockResolvedValue({ id: 'ci_test' });
const mockUpdateIdeaStatus = vi.fn().mockResolvedValue(undefined);
const mockCreateBrief = vi.fn().mockResolvedValue({ id: 'cb_test' });
const mockCreateDrafts = vi.fn().mockResolvedValue([{ id: 'cd_test' }]);
const mockUpdateDraft = vi.fn().mockResolvedValue(undefined);
const mockUpsertPrimaryAsset = vi.fn().mockResolvedValue(undefined);
const mockInsertGenerationRun = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/content-studio/repository', () => ({
  createIdea: (...args: unknown[]) => mockCreateIdea(...args),
  updateIdeaStatus: (...args: unknown[]) => mockUpdateIdeaStatus(...args),
  createBrief: (...args: unknown[]) => mockCreateBrief(...args),
  createDrafts: (...args: unknown[]) => mockCreateDrafts(...args),
  updateDraft: (...args: unknown[]) => mockUpdateDraft(...args),
  upsertPrimaryAsset: (...args: unknown[]) => mockUpsertPrimaryAsset(...args),
  insertGenerationRun: (...args: unknown[]) => mockInsertGenerationRun(...args),
}));

import { bridgeToContentStudio } from './content-studio-bridge';
import type { GenerationRequest, GenerationResult } from '../orchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    jobId: 'job-bridge-test',
    status: 'completed',
    script: { hook: 'Discover our secret', body: 'Body text', cta: 'Shop now' },
    caption: 'A beautiful caption about skincare',
    hashtags: ['#beauty', '#skincare'],
    images: [{ url: 'https://cdn.example.com/img.jpg', provider: 'openai', assetId: 'asset-1' }],
    videos: [],
    qualityScores: { average: 0.82, coherence: 0.9, brandAlignment: 0.74 },
    moderationResult: { safe: true },
    costTracking: { totalCents: 15, breakdown: {}, tokensUsed: {} },
    errors: [],
    durationMs: 5000,
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
      keyMessage: 'Discover the ritual of Japanese beauty.',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bridgeToContentStudio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCreateIdea.mockResolvedValue({ id: 'ci_test' });
    mockUpdateIdeaStatus.mockResolvedValue(undefined);
    mockCreateBrief.mockResolvedValue({ id: 'cb_test' });
    mockCreateDrafts.mockResolvedValue([{ id: 'cd_test' }]);
    mockUpdateDraft.mockResolvedValue(undefined);
    mockUpsertPrimaryAsset.mockResolvedValue(undefined);
    mockInsertGenerationRun.mockResolvedValue(undefined);
  });

  it('returns ideaId, briefId, draftId', async () => {
    const result = await bridgeToContentStudio(makeResult(), makeRequest());
    expect(result).toEqual({
      ideaId: 'ci_test',
      briefId: 'cb_test',
      draftId: 'cd_test',
    });
  });

  it('creates idea with sourceType=ai-engine', async () => {
    await bridgeToContentStudio(makeResult(), makeRequest());
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'ai-engine' }),
    );
  });

  it('creates idea with sourceRef=jobId', async () => {
    const genResult = makeResult({ jobId: 'job-xyz-123' });
    await bridgeToContentStudio(genResult, makeRequest());
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ sourceRef: 'job-xyz-123' }),
    );
  });

  it('maps platform correctly (instagram->instagram, tiktok->instagram fallback)', async () => {
    // Known platform
    await bridgeToContentStudio(makeResult(), makeRequest({ platform: 'instagram' }));
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'instagram' }),
    );

    // Unknown platform falls back to 'instagram'
    mockCreateIdea.mockClear();
    await bridgeToContentStudio(makeResult(), makeRequest({ platform: 'tiktok' }));
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'instagram' }),
    );
  });

  it('maps objective correctly (engagement->consideration, conversion->conversion)', async () => {
    await bridgeToContentStudio(
      makeResult(),
      makeRequest({ briefInput: { objective: 'engagement', keyMessage: 'Test' } }),
    );
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ objective: 'consideration' }),
    );

    mockCreateIdea.mockClear();
    await bridgeToContentStudio(
      makeResult(),
      makeRequest({ briefInput: { objective: 'conversion', keyMessage: 'Test' } }),
    );
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ objective: 'conversion' }),
    );
  });

  it('maps contentType/pillar correctly', async () => {
    await bridgeToContentStudio(makeResult(), makeRequest({ contentType: 'rituel' }));
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ pillar: 'rituel' }),
    );

    mockCreateIdea.mockClear();
    await bridgeToContentStudio(makeResult(), makeRequest({ contentType: 'unknown_type' }));
    expect(mockCreateIdea).toHaveBeenCalledWith(
      expect.objectContaining({ pillar: 'produit' }),
    );
  });

  it('creates brief with hook as angle', async () => {
    await bridgeToContentStudio(makeResult(), makeRequest());
    expect(mockCreateBrief).toHaveBeenCalledWith(
      expect.objectContaining({ angle: 'Discover our secret' }),
    );
  });

  it('creates brief with cta', async () => {
    await bridgeToContentStudio(makeResult(), makeRequest());
    expect(mockCreateBrief).toHaveBeenCalledWith(
      expect.objectContaining({ cta: 'Shop now' }),
    );
  });

  it('creates draft with caption', async () => {
    await bridgeToContentStudio(makeResult(), makeRequest());
    expect(mockCreateDrafts).toHaveBeenCalledWith([
      expect.objectContaining({ caption: 'A beautiful caption about skincare' }),
    ]);
  });

  it('creates draft with hashtags', async () => {
    await bridgeToContentStudio(makeResult(), makeRequest());
    expect(mockCreateDrafts).toHaveBeenCalledWith([
      expect.objectContaining({ hashtags: ['#beauty', '#skincare'] }),
    ]);
  });

  it('sets scoreTotal from qualityScores.average * 100', async () => {
    await bridgeToContentStudio(
      makeResult({ qualityScores: { average: 0.82 } }),
      makeRequest(),
    );
    expect(mockUpdateDraft).toHaveBeenCalledWith('cd_test', { scoreTotal: 82 });
  });

  it('skips asset binding for mock images (provider starts with mock)', async () => {
    const mockImages = [
      { url: 'https://mock.local/img.jpg', provider: 'mock-dall-e', assetId: 'mock-asset-1' },
    ];
    await bridgeToContentStudio(makeResult({ images: mockImages }), makeRequest());
    expect(mockUpsertPrimaryAsset).not.toHaveBeenCalled();
  });
});
