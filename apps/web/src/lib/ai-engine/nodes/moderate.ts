import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import { reviewDraftContent } from '@/lib/content-studio/brand-rules';

const log = createLogger('node:moderate');

interface ModerationResult {
  safe: boolean;
  flags: string[];
  canRetry: boolean;
  brandScore: number;
}

async function callOpenAIModeration(text: string, apiKey: string): Promise<{ flagged: boolean; categories: string[] }> {
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!res.ok) return { flagged: false, categories: [] };

    const json = (await res.json()) as {
      results?: Array<{
        flagged?: boolean;
        categories?: Record<string, boolean>;
      }>;
    };

    const result = json.results?.[0];
    if (!result) return { flagged: false, categories: [] };

    const flaggedCategories = Object.entries(result.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);

    return { flagged: result.flagged ?? false, categories: flaggedCategories };
  } catch {
    return { flagged: false, categories: [] };
  }
}

export async function moderateNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  log.info('Running moderation', { jobId, node: 'moderate' });

  const startTime = Date.now();
  const caption = (state.caption as string) ?? '';
  const script = state.script as Record<string, unknown> | null;
  const hook = (script?.hook as string) ?? '';
  const fullText = `${hook}\n${caption}`;

  const flags: string[] = [];

  const brandReview = reviewDraftContent({ id: 'moderation', caption: fullText, hashtags: [] });
  if (brandReview.status === 'blocked') {
    for (const v of brandReview.violations) {
      flags.push(`brand:${v.rule}`);
    }
  }

  if (config.apiKeys.openai) {
    const moderation = await callOpenAIModeration(fullText, config.apiKeys.openai);
    if (moderation.flagged) {
      for (const cat of moderation.categories) {
        flags.push(`openai:${cat}`);
      }
    }
  }

  const hasBlockingFlag = flags.some(
    (f) => f.startsWith('openai:') || f.includes('brand:emoji') === false,
  );
  const result: ModerationResult = {
    safe: flags.length === 0,
    flags,
    canRetry: !hasBlockingFlag && flags.length < 3,
    brandScore: brandReview.scoreTotal,
  };

  const durationMs = Date.now() - startTime;
  log.info('Moderation complete', {
    jobId,
    node: 'moderate',
    durationMs,
    data: { safe: result.safe, flagCount: flags.length, brandScore: brandReview.score },
  });

  return {
    moderationResult: result,
    currentStep: 'moderate',
  };
}
