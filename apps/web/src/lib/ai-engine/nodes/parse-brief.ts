import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:parse-brief');

const briefInputSchema = z.object({
  objective: z.enum(['awareness', 'engagement', 'conversion', 'education', 'entertainment']),
  tone: z.enum(['professional', 'casual', 'playful', 'luxurious', 'educational', 'inspiring']).default('professional'),
  targetAudience: z.string().default('Femmes 25-45 ans intéressées par la beauté japonaise'),
  productFocus: z.string().optional(),
  keyMessage: z.string(),
  constraints: z.array(z.string()).default([]),
  seasonalContext: z.string().optional(),
  trendReference: z.string().optional(),
  language: z.string().default('fr'),
  maxBudgetCents: z.number().int().positive().optional(),
});

export async function parseBriefNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = getEngineConfig();
  const jobId = state.jobId as string;
  log.info('Parsing brief', { jobId, node: 'parse_brief' });

  const raw = state.briefInput as Record<string, unknown>;
  const parsed = briefInputSchema.parse({
    ...raw,
    tone: raw.tone ?? config.defaults.tone,
    language: raw.language ?? config.defaults.language,
    maxBudgetCents: raw.maxBudgetCents ?? config.budget.maxPerJobCents,
  });

  return {
    briefInput: parsed,
    currentStep: 'parse_brief',
    costTracking: {
      totalCents: 0,
      breakdown: {},
      tokensUsed: {},
      budgetRemainingCents: parsed.maxBudgetCents ?? config.budget.maxPerJobCents,
    },
  };
}
