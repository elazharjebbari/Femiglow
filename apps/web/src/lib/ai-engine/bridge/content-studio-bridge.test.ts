import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for repository
// ---------------------------------------------------------------------------
const mockCreateIdea = vi.fn().mockResolvedValue({ id: 'ci_test' });
const mockUpdateIdeaStatus = vi.fn().mockResolvedValue(undefined);
const mockCreateBrief = vi.fn().mockResolvedValue({ id: 'cb_test' });
const mockCreateDrafts = vi.fn().mockResolvedValue([{ id: 'cd_test' }]);
const mockUpdateDraft = vi.fn().mockResolvedValue(undefined);
const mockUpsertBundleAssets = vi.fn().mockResolvedValue([]);
const mockInsertGenerationRun = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/content-studio/repository', () => ({
  createIdea: (...args: unknown[]) => mockCreateIdea(...args),
  updateIdeaStatus: (...args: unknown[]) => mockUpdateIdeaStatus(...args),
  createBrief: (...args: unknown[]) => mockCreateBrief(...args),
  createDrafts: (...args: unknown[]) => mockCreateDrafts(...args),
  updateDraft: (...args: unknown[]) => mockUpdateDraft(...args),
  upsertBundleAssets: (...args: unknown[]) => mockUpsertBundleAssets(...args),
  insertGenerationRun: (...args: unknown[]) => mockInsertGenerationRun(...args),
}));

/** Extract the {role->mediaId/meta} bundle from the single upsertBundleAssets call. */
function bundleFromCall(): Array<{ mediaId: string; role: string; meta?: Record<string, unknown> }> {
  const call = mockUpsertBundleAssets.mock.calls[0];
  if (!call) return [];
  return (call[0] as { assets: Array<{ mediaId: string; role: string; meta?: Record<string, unknown> }> }).assets;
}

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
    mockUpsertBundleAssets.mockClear();
    mockUpsertBundleAssets.mockResolvedValue([]);
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
    // no real visual → no bundle write at all (MP-AR-002 keeps the legacy skip).
    expect(mockUpsertBundleAssets).not.toHaveBeenCalled();
  });

  // ── MP-AR-002 (BUG-004): full media bundle by role ───────────────────────
  it('binds a real image as primary_image', async () => {
    await bridgeToContentStudio(makeResult(), makeRequest());
    const bundle = bundleFromCall();
    expect(bundle).toContainEqual({ mediaId: 'asset-1', role: 'primary_image' });
  });

  it('surfaces voiceover, music and composed video by role (no longer dropped)', async () => {
    await bridgeToContentStudio(
      makeResult({
        voiceover: { assetId: 'vo-1', provider: 'openai' },
        music: { assetId: 'mu-1', provider: 'mock-music' },
        composedVideo: { assetId: 'cmp-1', provider: 'ffmpeg' },
      }),
      makeRequest(),
    );
    const roles = bundleFromCall();
    expect(roles).toContainEqual({ mediaId: 'vo-1', role: 'voiceover' });
    // audio/composed mocks are deterministic → must surface (unlike mock visuals).
    expect(roles).toContainEqual({ mediaId: 'mu-1', role: 'music' });
    expect(roles).toContainEqual({ mediaId: 'cmp-1', role: 'composed_video' });
  });

  it('carries SRT subtitle text into the subtitles binding meta (not dropped)', async () => {
    const srt = '1\n00:00:00,000 --> 00:00:02,000\nBonjour\n';
    await bridgeToContentStudio(makeResult({ subtitles: srt }), makeRequest());
    const sub = bundleFromCall().find((a) => a.role === 'subtitles');
    expect(sub?.meta?.srt).toBe(srt);
  });

  it('binds the raw video clip as primary_video', async () => {
    await bridgeToContentStudio(
      makeResult({ images: [], videos: [{ assetId: 'vid-1', provider: 'higgsfield' }] }),
      makeRequest(),
    );
    expect(bundleFromCall()).toContainEqual({ mediaId: 'vid-1', role: 'primary_video' });
  });
});
