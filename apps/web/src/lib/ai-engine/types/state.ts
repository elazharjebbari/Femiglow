import { Annotation } from '@langchain/langgraph';
import type { ContentPillar, ContentPlatform, ContentFormat } from '@/lib/content-studio/types';
import type { MediaAsset, StepError, CostTracking } from './media';
import type { BriefInput, ScriptOutput, ModerationResult, HumanReview } from './schemas';

function concatReducer<T>(left: T[], right: T[]): T[] {
  return left.concat(right);
}

function mergeRecordReducer<V>(
  left: Record<string, V>,
  right: Record<string, V>,
): Record<string, V> {
  return { ...left, ...right };
}

function mergeCostTracking(left: CostTracking, right: CostTracking): CostTracking {
  const mergedBreakdown = { ...left.breakdown, ...right.breakdown };
  const mergedTokens = { ...left.tokensUsed, ...right.tokensUsed };
  return {
    totalCents: left.totalCents + right.totalCents,
    breakdown: mergedBreakdown,
    tokensUsed: mergedTokens,
    budgetRemainingCents: right.budgetRemainingCents ?? left.budgetRemainingCents,
  };
}

// Retries reducer: increments per-node retry count
function mergeRetries(
  left: Record<string, number>,
  right: Record<string, number>,
): Record<string, number> {
  const result = { ...left };
  for (const [key, val] of Object.entries(right)) {
    result[key] = (result[key] ?? 0) + val;
  }
  return result;
}

export interface ContentVariant {
  variantIndex: number;
  label: string;
  script: ScriptOutput | null;
  caption: string;
  hashtags: string[];
  qualityScores: Record<string, number>;
}

export const ContentGenerationState = Annotation.Root({
  // ── Identity ──
  jobId: Annotation<string>,
  tenantId: Annotation<string>,
  createdAt: Annotation<string>,

  // ── Brief input ──
  brief: Annotation<BriefInput>,
  platform: Annotation<ContentPlatform>,
  format: Annotation<ContentFormat>,
  contentType: Annotation<ContentPillar>,

  // ── Knowledge context ──
  knowledgeContext: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  trendContext: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  brandGuidelines: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  performanceContext: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  // ── Text generation ──
  script: Annotation<ScriptOutput | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  caption: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  hashtags: Annotation<string[]>({
    reducer: concatReducer,
    default: () => [],
  }),
  ctaText: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  // ── Visual generation ──
  imagePrompts: Annotation<string[]>({
    reducer: concatReducer,
    default: () => [],
  }),
  images: Annotation<MediaAsset[]>({
    reducer: concatReducer,
    default: () => [],
  }),
  videoPrompts: Annotation<string[]>({
    reducer: concatReducer,
    default: () => [],
  }),
  videos: Annotation<MediaAsset[]>({
    reducer: concatReducer,
    default: () => [],
  }),

  // ── Audio ──
  voiceoverScript: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  voiceover: Annotation<MediaAsset | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  music: Annotation<MediaAsset | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // ── Composition ──
  subtitles: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  composition: Annotation<MediaAsset | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  thumbnails: Annotation<MediaAsset[]>({
    reducer: concatReducer,
    default: () => [],
  }),

  // ── Export ──
  exports: Annotation<Record<string, MediaAsset>>({
    reducer: mergeRecordReducer,
    default: () => ({}),
  }),

  // ── Control ──
  qualityScores: Annotation<Record<string, number>>({
    reducer: mergeRecordReducer,
    default: () => ({}),
  }),
  moderationResult: Annotation<ModerationResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  humanReview: Annotation<HumanReview | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // ── Meta ──
  currentStep: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => 'init',
  }),
  errors: Annotation<StepError[]>({
    reducer: concatReducer,
    default: () => [],
  }),
  retries: Annotation<Record<string, number>>({
    reducer: mergeRetries,
    default: () => ({}),
  }),
  costTracking: Annotation<CostTracking>({
    reducer: mergeCostTracking,
    default: () => ({
      totalCents: 0,
      breakdown: {},
      tokensUsed: {},
    }),
  }),

  // ── Variants ──
  variants: Annotation<ContentVariant[]>({
    reducer: concatReducer,
    default: () => [],
  }),
  selectedVariant: Annotation<number | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type ContentGenerationStateType = typeof ContentGenerationState.State;
export type ContentGenerationUpdateType = typeof ContentGenerationState.Update;
