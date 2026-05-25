import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:generate-caption');

const captionOutputSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
});

const PLATFORM_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  pinterest: 500,
  linkedin: 3000,
  twitter: 280,
  threads: 500,
};

function buildCaptionPrompt(state: Record<string, unknown>): string {
  const brief = state.briefInput as Record<string, unknown>;
  const script = state.script as Record<string, unknown>;
  const platform = state.platform as string;
  const format = state.format as string;
  const maxLength = PLATFORM_LIMITS[platform] ?? 2200;

  return JSON.stringify({
    task: 'generate_caption_and_hashtags',
    platform,
    format,
    maxLength,
    script: {
      hook: script.hook,
      cta: script.cta,
    },
    brief: {
      objective: brief.objective,
      tone: brief.tone,
      keyMessage: brief.keyMessage,
      productFocus: brief.productFocus,
    },
    knowledgeContext: (state.knowledgeContext as string)?.slice(0, 500) ?? '',
    rules: {
      language: 'français',
      noEmoji: true,
      noExclamation: true,
      noMedicalClaims: true,
      hashtagCount: platform === 'instagram' ? '8-12' : '3-5',
      firstLineIsHook: true,
      ctaAtEnd: true,
    },
    outputSchema: {
      caption: 'string — caption complète avec line breaks',
      hashtags: ['string — sans le #'],
      cta: 'string — call-to-action',
    },
  });
}

function fallbackCaption(state: Record<string, unknown>): z.infer<typeof captionOutputSchema> {
  const script = state.script as Record<string, unknown> | null;
  const brief = state.briefInput as Record<string, unknown>;
  const hook = (script?.hook as string) ?? 'Le rituel commence ici.';
  const cta = (script?.cta as string) ?? (brief.objective === 'conversion' ? 'Découvrir le rituel' : 'En savoir plus');

  return {
    caption: `${hook}\n\nChez FemiGlow, le soin est un geste précis et patient. Sans vernis, sans abrasion, le rituel accompagne l'éclat naturel.\n\n${cta}.`,
    hashtags: ['femiglow', 'jbeauty', 'rituelbeaute', 'soinnaturel', 'beautejaponaise', 'onglesnaturels'],
    cta,
  };
}

export async function generateCaptionNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  log.info('Generating caption', { jobId, node: 'generate_caption' });

  const startTime = Date.now();
  let result: z.infer<typeof captionOutputSchema>;
  let costCents = 0;

  try {
    if (!config.apiKeys.openai) throw new Error('No API key');

    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      openAIApiKey: config.apiKeys.openai,
      temperature: 0.7,
      maxTokens: 1000,
      modelKwargs: { response_format: { type: 'json_object' } },
    });

    const response = await llm.invoke([
      new SystemMessage(
        'Tu es un copywriter expert pour FemiGlow, marque J-Beauty. Tu écris en français, sans emoji, sans exclamation. Retourne uniquement du JSON valide.',
      ),
      new HumanMessage(buildCaptionPrompt(state)),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    result = captionOutputSchema.parse(JSON.parse(content));

    const usage = response.usage_metadata;
    const tokensIn = usage?.input_tokens ?? 0;
    const tokensOut = usage?.output_tokens ?? 0;
    costCents = (tokensIn / 1_000_000) * 0.15 * 100 + (tokensOut / 1_000_000) * 0.6 * 100;
  } catch {
    log.warn('Caption LLM failed, using fallback', { jobId, node: 'generate_caption' });
    result = fallbackCaption(state);
  }

  const durationMs = Date.now() - startTime;
  log.info('Caption generated', { jobId, node: 'generate_caption', durationMs, costCents });

  const prevCost = state.costTracking as Record<string, unknown> | undefined;
  const prevTotal = (prevCost?.totalCents as number) ?? 0;
  const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};

  return {
    caption: result.caption,
    hashtags: result.hashtags,
    ctaText: result.cta,
    currentStep: 'generate_caption',
    costTracking: {
      ...prevCost,
      totalCents: prevTotal + costCents,
      breakdown: { ...prevBreakdown, generate_caption: costCents },
    },
  };
}
