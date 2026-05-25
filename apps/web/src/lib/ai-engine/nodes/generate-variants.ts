import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:generate-variants');

const variantOutputSchema = z.object({
  variants: z.array(z.object({
    hook: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
  })),
});

interface ContentVariant {
  variantIndex: number;
  script: Record<string, unknown> | null;
  caption: string;
  hashtags: string[];
  qualityScores: Record<string, number>;
}

function buildVariantPrompt(state: Record<string, unknown>): string {
  const script = state.script as Record<string, unknown> | null;
  const caption = (state.caption as string) ?? '';
  const hashtags = (state.hashtags as string[]) ?? [];
  const platform = state.platform as string;

  return JSON.stringify({
    task: 'generate_caption_variants',
    count: 3,
    original: {
      hook: script?.hook ?? '',
      caption,
      hashtags,
    },
    platform,
    rules: {
      language: 'français',
      noEmoji: true,
      noExclamation: true,
      eachVariantDifferentAngle: true,
      keepBrandVoice: true,
    },
  });
}

function generateDeterministicVariants(state: Record<string, unknown>): ContentVariant[] {
  const script = state.script as Record<string, unknown> | null;
  const caption = (state.caption as string) ?? '';
  const hashtags = (state.hashtags as string[]) ?? [];
  const qualityScores = (state.qualityScores as Record<string, number>) ?? {};
  const hook = (script?.hook as string) ?? '';

  const hookVariations = [
    hook || 'Un geste precis, un eclat retrouve.',
    hook ? `Saviez-vous que ${hook.charAt(0).toLowerCase()}${hook.slice(1)}` : 'Le secret de la J-Beauty, enfin accessible.',
    hook ? `${hook} Chaque geste compte.` : 'La patience est le premier ingredient de la beaute.',
  ];

  return hookVariations.map((variantHook, index) => {
    const variantCaption = index === 0
      ? caption
      : caption.replace(
          caption.split('\n')[0] ?? '',
          variantHook,
        );

    return {
      variantIndex: index,
      script: script ? { ...script, hook: variantHook } : null,
      caption: variantCaption || variantHook,
      hashtags: [...hashtags],
      qualityScores,
    };
  });
}

export async function generateVariantsNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();

  log.info('Generating variants', { jobId, node: 'generate_variants' });

  const startTime = Date.now();
  let variants: ContentVariant[];
  let costCents = 0;

  try {
    if (!config.apiKeys.openai) throw new Error('No API key available');

    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      openAIApiKey: config.apiKeys.openai,
      temperature: 0.9,
      maxTokens: 1500,
      modelKwargs: { response_format: { type: 'json_object' } },
    });

    const response = await llm.invoke([
      new SystemMessage(
        'Tu es un copywriter expert pour FemiGlow, marque J-Beauty. Tu generes des variantes de captions. Retourne uniquement du JSON valide.',
      ),
      new HumanMessage(buildVariantPrompt(state)),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parsed = variantOutputSchema.parse(JSON.parse(content));
    const script = state.script as Record<string, unknown> | null;
    const qualityScores = (state.qualityScores as Record<string, number>) ?? {};

    variants = parsed.variants.map((v, index) => ({
      variantIndex: index,
      script: script ? { ...script, hook: v.hook } : null,
      caption: v.caption,
      hashtags: v.hashtags,
      qualityScores,
    }));

    const usage = response.usage_metadata;
    const tokensIn = usage?.input_tokens ?? 0;
    const tokensOut = usage?.output_tokens ?? 0;
    costCents = (tokensIn / 1_000_000) * 0.15 * 100 + (tokensOut / 1_000_000) * 0.6 * 100;
  } catch (err) {
    log.warn('Variant LLM failed, using deterministic variants', {
      jobId,
      node: 'generate_variants',
      data: { error: String(err) },
    });
    variants = generateDeterministicVariants(state);
  }

  const durationMs = Date.now() - startTime;
  log.info('Variants generated', {
    jobId,
    node: 'generate_variants',
    durationMs,
    costCents,
    data: { count: variants.length },
  });

  const prevCost = state.costTracking as Record<string, unknown> | undefined;
  const prevTotal = (prevCost?.totalCents as number) ?? 0;
  const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};

  return {
    variants,
    selectedVariant: 0,
    currentStep: 'generate_variants',
    costTracking: {
      ...prevCost,
      totalCents: prevTotal + costCents,
      breakdown: { ...prevBreakdown, generate_variants: costCents },
    },
  };
}
