import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import { reviewDraftContent } from '@/lib/content-studio/brand-rules';
import type { ContentBrandReview } from '@/lib/content-studio/types';

const log = createLogger('node:quality-check');

interface QualityDimension {
  name: string;
  weight: number;
  evaluate: (state: Record<string, unknown>) => number;
}

const QUALITY_DIMENSIONS: QualityDimension[] = [
  {
    name: 'text_quality',
    weight: 0.3,
    evaluate: (state) => {
      const caption = (state.caption as string) ?? '';
      const script = state.script as Record<string, unknown> | null;
      const hook = (script?.hook as string) ?? '';

      let score = 0.5;
      if (caption.length > 50) score += 0.1;
      if (caption.length > 150) score += 0.1;
      if (hook.length > 10) score += 0.1;
      if (caption.includes('\n')) score += 0.05;
      const hashtags = (state.hashtags as string[]) ?? [];
      if (hashtags.length >= 3 && hashtags.length <= 15) score += 0.1;
      if (!caption.includes('!')) score += 0.05;
      return Math.min(score, 1);
    },
  },
  {
    name: 'visual_quality',
    weight: 0.3,
    evaluate: (state) => {
      const images = (state.images as Array<Record<string, unknown>>) ?? [];
      const videos = (state.videos as Array<Record<string, unknown>>) ?? [];
      const format = state.format as string;

      let score = 0.5;
      if (images.length > 0 || videos.length > 0) score += 0.2;
      if (format === 'carousel' && images.length >= 3) score += 0.1;
      if (images.some((img) => img.provider !== 'mock')) score += 0.1;
      if (videos.some((v) => v.provider !== 'mock')) score += 0.1;
      return Math.min(score, 1);
    },
  },
  {
    name: 'brand_compliance',
    weight: 0.25,
    evaluate: (state) => {
      const caption = (state.caption as string) ?? '';
      try {
        const review: ContentBrandReview = reviewDraftContent({
          id: 'quality-check',
          caption,
          hashtags: [],
        });
        return review.scoreTotal / 100;
      } catch {
        return 0.7;
      }
    },
  },
  {
    name: 'hook_strength',
    weight: 0.15,
    evaluate: (state) => {
      const script = state.script as Record<string, unknown> | null;
      const hook = (script?.hook as string) ?? '';
      const caption = (state.caption as string) ?? '';
      const firstLine = caption.split('\n')[0] ?? '';

      let score = 0.5;
      if (hook.length > 20 && hook.length < 100) score += 0.15;
      if (firstLine.length > 10) score += 0.1;
      if (/\?/.test(firstLine)) score += 0.1;
      if (!/!/.test(firstLine)) score += 0.05;
      if (hook !== firstLine && firstLine.length > 0) score += 0.1;
      return Math.min(score, 1);
    },
  },
];

export async function qualityCheckNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  log.info('Running quality check', { jobId, node: 'quality_check' });

  const startTime = Date.now();
  const scores: Record<string, number> = {};
  let weightedTotal = 0;
  let weightSum = 0;

  for (const dim of QUALITY_DIMENSIONS) {
    const score = dim.evaluate(state);
    scores[dim.name] = Math.round(score * 100) / 100;
    weightedTotal += score * dim.weight;
    weightSum += dim.weight;
  }

  const averageScore = weightSum > 0 ? weightedTotal / weightSum : 0;
  scores.average = Math.round(averageScore * 100) / 100;

  const threshold = config.quality.threshold;
  const passed = averageScore >= threshold;

  const durationMs = Date.now() - startTime;
  log.info('Quality check complete', {
    jobId,
    node: 'quality_check',
    durationMs,
    data: { scores, passed, threshold },
  });

  return {
    qualityScores: scores,
    currentStep: 'quality_check',
  };
}
