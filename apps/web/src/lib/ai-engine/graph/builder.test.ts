import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all node imports to avoid pulling in real LLM / DB dependencies.
// Each node mock returns a minimal state update.
// ---------------------------------------------------------------------------
vi.mock('../nodes/parse-brief', () => ({ parseBriefNode: vi.fn(async () => ({ currentStep: 'parse_brief' })) }));
vi.mock('../nodes/enrich-knowledge', () => ({ enrichKnowledgeNode: vi.fn(async () => ({ currentStep: 'enrich_knowledge' })) }));
vi.mock('../nodes/enrich-trends', () => ({ enrichTrendsNode: vi.fn(async () => ({ currentStep: 'enrich_trends' })) }));
vi.mock('../nodes/generate-script', () => ({ generateScriptNode: vi.fn(async () => ({ currentStep: 'generate_script' })) }));
vi.mock('../nodes/generate-caption', () => ({ generateCaptionNode: vi.fn(async () => ({ currentStep: 'generate_caption' })) }));
vi.mock('../nodes/generate-images', () => ({ generateImagesNode: vi.fn(async () => ({ currentStep: 'generate_images' })) }));
vi.mock('../nodes/generate-video', () => ({ generateVideoNode: vi.fn(async () => ({ currentStep: 'generate_video' })) }));
vi.mock('../nodes/generate-voiceover', () => ({ generateVoiceoverNode: vi.fn(async () => ({ currentStep: 'generate_voiceover' })) }));
vi.mock('../nodes/generate-music', () => ({ generateMusicNode: vi.fn(async () => ({ currentStep: 'generate_music' })) }));
vi.mock('../nodes/generate-subtitles', () => ({ generateSubtitlesNode: vi.fn(async () => ({ currentStep: 'generate_subtitles' })) }));
vi.mock('../nodes/compose', () => ({ composeNode: vi.fn(async () => ({ currentStep: 'compose' })) }));
vi.mock('../nodes/transcode-export', () => ({ transcodeExportNode: vi.fn(async () => ({ currentStep: 'transcode_export' })) }));
vi.mock('../nodes/quality-check', () => ({ qualityCheckNode: vi.fn(async () => ({ currentStep: 'quality_check' })) }));
vi.mock('../nodes/moderate', () => ({ moderateNode: vi.fn(async () => ({ currentStep: 'moderate' })) }));
vi.mock('../nodes/human-review', () => ({ humanReviewNode: vi.fn(async () => ({ currentStep: 'human_review' })) }));
vi.mock('../nodes/generate-variants', () => ({ generateVariantsNode: vi.fn(async () => ({ currentStep: 'generate_variants' })) }));

vi.mock('../config', () => ({
  getEngineConfig: () => ({
    enabled: true,
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    budget: { dailyCents: 1000, maxPerJobCents: 200 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    providers: {
      text: { default: 'openai', model: 'gpt-4' },
      image: { default: 'mock', model: 'mock' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: {},
  }),
}));

import { buildContentGraph } from './builder';
import { START, END } from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildContentGraph', () => {
  const graph = buildContentGraph();

  const EXPECTED_NODES = [
    'parseBrief',
    'enrichKnowledge',
    'enrichTrends',
    'generateScript',
    'generateCaption',
    'generateImages',
    'generateVideo',
    'generateVoiceover',
    'generateMusic',
    'generateSubtitles',
    'compose',
    'transcodeExport',
    'qualityCheck',
    'moderate',
    'reviewGate',
    'generateVariants',
  ];

  it('buildContentGraph returns a StateGraph', () => {
    expect(graph).toBeDefined();
    expect(typeof graph.compile).toBe('function');
  });

  it('graph has all 16 nodes registered', () => {
    // Access nodes through the graph's internal structure
    const nodes = (graph as unknown as Record<string, unknown>).nodes as Map<string, unknown> | Record<string, unknown>;
    const nodeNames = nodes instanceof Map ? Array.from(nodes.keys()) : Object.keys(nodes);
    for (const name of EXPECTED_NODES) {
      expect(nodeNames).toContain(name);
    }
    // Exactly 16 custom nodes
    const customNodes = nodeNames.filter((n) => n !== '__start__' && n !== '__end__');
    expect(customNodes).toHaveLength(16);
  });

  it('graph compiles without error', () => {
    expect(() => graph.compile()).not.toThrow();
  });

  it('graph has edge from START to parseBrief', () => {
    const edges = (graph as unknown as Record<string, unknown>).edges as Set<[string, string]> | Array<[string, string]>;
    const edgeArray = edges instanceof Set ? Array.from(edges) : edges;
    const hasStartEdge = edgeArray.some(
      ([from, to]) => from === '__start__' && to === 'parseBrief',
    );
    expect(hasStartEdge).toBe(true);
  });

  it('graph has edge from parseBrief to enrichKnowledge', () => {
    const edges = (graph as unknown as Record<string, unknown>).edges as Set<[string, string]> | Array<[string, string]>;
    const edgeArray = edges instanceof Set ? Array.from(edges) : edges;
    const hasEdge = edgeArray.some(
      ([from, to]) => from === 'parseBrief' && to === 'enrichKnowledge',
    );
    expect(hasEdge).toBe(true);
  });

  it('graph has conditional edges after generateScript', () => {
    // Conditional edges are stored in the graph's branches
    const branches = (graph as unknown as Record<string, Record<string, unknown>>).branches as Record<string, unknown>;
    expect(branches).toBeDefined();
    expect(branches['generateScript']).toBeDefined();
  });

  it('graph has conditional edges after qualityCheck', () => {
    const branches = (graph as unknown as Record<string, Record<string, unknown>>).branches as Record<string, unknown>;
    expect(branches).toBeDefined();
    expect(branches['qualityCheck']).toBeDefined();
  });

  it('graph has edge from generateVariants to END', () => {
    const edges = (graph as unknown as Record<string, unknown>).edges as Set<[string, string]> | Array<[string, string]>;
    const edgeArray = edges instanceof Set ? Array.from(edges) : edges;
    const hasEndEdge = edgeArray.some(
      ([from, to]) => from === 'generateVariants' && to === '__end__',
    );
    expect(hasEndEdge).toBe(true);
  });
});
