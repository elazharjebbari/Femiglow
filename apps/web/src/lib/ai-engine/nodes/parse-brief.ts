import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:parse-brief');

const briefInputSchema = z.object({
  objective: z.enum(['awareness', 'engagement', 'conversion', 'education', 'entertainment']),
  // ACT-BE-017 (BUG-014) : aligné sur l'enum du DTO de la route /generate et de
  // l'UI AI-Engine, qui proposent aussi empowering/authentic/urgent. Sans cet
  // alignement, parse-brief levait une ZodError → job status:failed avant toute
  // génération. Le ton n'est qu'interpolé dans les prompts (pas de switch métier).
  tone: z
    .enum([
      'professional',
      'casual',
      'playful',
      'luxurious',
      'educational',
      'inspiring',
      'empowering',
      'authentic',
      'urgent',
    ])
    .default('professional'),
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
  let config: ReturnType<typeof getEngineConfig>;
  try {
    config = getEngineConfig();
  } catch {
    config = { defaults: { tone: 'professional', language: 'fr', maxRetries: 3 }, budget: { dailyCents: 1000, maxPerJobCents: 100 } } as ReturnType<typeof getEngineConfig>;
  }
  const jobId = state.jobId as string;
  log.info('Parsing brief', { jobId, node: 'parse_brief' });

  const raw = ((state.brief ?? state.briefInput) as Record<string, unknown>) ?? {};
  const parsed = briefInputSchema.parse({
    ...raw,
    tone: raw.tone ?? config.defaults?.tone ?? 'professional',
    language: raw.language ?? config.defaults?.language ?? 'fr',
    maxBudgetCents: raw.maxBudgetCents ?? config.budget?.maxPerJobCents ?? 100,
  });

  return {
    brief: parsed,
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
