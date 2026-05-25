import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:generate-script');

const sceneBlockSchema = z.object({
  sceneNumber: z.number(),
  description: z.string(),
  textOverlay: z.string().optional(),
  durationSeconds: z.number().optional(),
  transition: z.enum(['cut', 'fade', 'slide', 'zoom']).optional(),
});

const visualNoteSchema = z.object({
  element: z.string(),
  style: z.string(),
  colors: z.array(z.string()),
  composition: z.string(),
});

export const scriptOutputSchema = z.object({
  hook: z.string(),
  scenes: z.array(sceneBlockSchema),
  cta: z.string(),
  voiceoverRequired: z.boolean(),
  musicRequired: z.boolean(),
  musicMood: z.string().optional(),
  visualDirection: z.array(visualNoteSchema),
  estimatedDurationSeconds: z.number().optional(),
});

type ScriptOutput = z.infer<typeof scriptOutputSchema>;

function buildSystemPrompt(): string {
  return `Tu es un créateur de contenu expert spécialisé en J-Beauty (beauté japonaise) pour la marque FemiGlow.
Tu crées des scripts structurés pour du contenu social media de haute qualité.

Règles absolues :
- Écrire en français
- Jamais d'emoji
- Jamais de point d'exclamation
- Aucune promesse médicale ou miraculeuse
- Aucune urgence commerciale agressive
- Ton : raffiné, précis, sensoriel
- Valoriser le geste, le rituel, la patience
- Ancrer dans la culture japonaise authentique

Tu retournes UNIQUEMENT du JSON valide conforme au schema demandé.`;
}

function buildUserPrompt(state: Record<string, unknown>): string {
  const brief = state.briefInput as Record<string, unknown>;
  const platform = state.platform as string;
  const format = state.format as string;
  const knowledge = (state.knowledgeContext as string) || '';
  const trends = (state.trendContext as string) || '';
  const brand = (state.brandGuidelines as string) || '';

  return JSON.stringify({
    task: 'generate_structured_script',
    platform,
    format,
    brief: {
      objective: brief.objective,
      tone: brief.tone,
      targetAudience: brief.targetAudience,
      productFocus: brief.productFocus,
      keyMessage: brief.keyMessage,
      constraints: brief.constraints,
      seasonalContext: brief.seasonalContext,
      trendReference: brief.trendReference,
    },
    knowledgeContext: knowledge.slice(0, 2000),
    trendContext: trends.slice(0, 1000),
    brandGuidelines: brand.slice(0, 1000),
    outputSchema: {
      hook: 'Première phrase ou les 3 premières secondes — doit arrêter le scroll',
      scenes: [
        {
          sceneNumber: 'int',
          description: 'Description visuelle détaillée de la scène',
          textOverlay: 'Texte à incruster (optionnel)',
          durationSeconds: 'Durée en secondes',
          transition: 'cut | fade | slide | zoom',
        },
      ],
      cta: 'Call-to-action final',
      voiceoverRequired: 'boolean — true si une voix-off est nécessaire',
      musicRequired: 'boolean — true si une musique de fond est souhaitée',
      musicMood: 'calm | energetic | luxury | minimal',
      visualDirection: [
        {
          element: 'product_hero | lifestyle | texture_closeup | hands | ritual',
          style: 'minimal_japanese | bright_natural | editorial | warm_cozy',
          colors: ['cream', 'sage', 'warm_white'],
          composition: 'centered | rule_of_thirds | flat_lay | closeup',
        },
      ],
      estimatedDurationSeconds: 'Durée totale estimée',
    },
  });
}

function createLLM(config: ReturnType<typeof getEngineConfig>): ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI {
  const provider = config.providers.text.default;
  const model = config.providers.text.model;

  switch (provider) {
    case 'anthropic': {
      if (!config.apiKeys.anthropic) throw new Error('AI_ENGINE_ANTHROPIC_API_KEY not set');
      return new ChatAnthropic({
        model,
        anthropicApiKey: config.apiKeys.anthropic,
        temperature: 0.7,
        maxTokens: 2000,
      });
    }
    case 'google': {
      if (!config.apiKeys.google) throw new Error('AI_ENGINE_GOOGLE_API_KEY not set');
      return new ChatGoogleGenerativeAI({
        model,
        apiKey: config.apiKeys.google,
        temperature: 0.7,
        maxOutputTokens: 2000,
      });
    }
    default: {
      if (!config.apiKeys.openai) throw new Error('AI_ENGINE_OPENAI_API_KEY not set');
      return new ChatOpenAI({
        model,
        openAIApiKey: config.apiKeys.openai,
        temperature: 0.7,
        maxTokens: 2000,
        modelKwargs: { response_format: { type: 'json_object' } },
      });
    }
  }
}

function fallbackScript(state: Record<string, unknown>): ScriptOutput {
  const brief = state.briefInput as Record<string, unknown>;
  const format = state.format as string;
  const isVideo = ['reel', 'story'].includes(format);

  return {
    hook: 'Un geste lent, une main qui retrouve sa lumière naturelle.',
    scenes: [
      {
        sceneNumber: 1,
        description: 'Gros plan sur les mains, lumière naturelle douce, texture crème visible',
        textOverlay: String(brief.keyMessage ?? 'Le rituel FemiGlow'),
        durationSeconds: isVideo ? 4 : undefined,
        transition: 'fade',
      },
      {
        sceneNumber: 2,
        description: 'Application du produit, geste circulaire lent et précis',
        durationSeconds: isVideo ? 4 : undefined,
        transition: 'fade',
      },
      {
        sceneNumber: 3,
        description: 'Résultat : ongles lumineux, éclat naturel, sourire discret',
        textOverlay: String(brief.productFocus ?? 'FemiGlow'),
        durationSeconds: isVideo ? 4 : undefined,
        transition: 'fade',
      },
    ],
    cta: brief.objective === 'conversion' ? 'Découvrir le rituel' : 'En savoir plus',
    voiceoverRequired: isVideo,
    musicRequired: isVideo,
    musicMood: 'calm',
    visualDirection: [
      {
        element: 'product_hero',
        style: 'minimal_japanese',
        colors: ['cream', 'sage', 'warm_white'],
        composition: 'centered',
      },
      {
        element: 'hands',
        style: 'bright_natural',
        colors: ['skin_tone', 'cream', 'soft_pink'],
        composition: 'closeup',
      },
    ],
    estimatedDurationSeconds: isVideo ? 15 : undefined,
  };
}

export async function generateScriptNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();

  log.info('Generating script', { jobId, node: 'generate_script', provider: config.providers.text.default });

  const startTime = Date.now();
  let script: ScriptOutput;
  let costCents = 0;
  let provider = 'fallback';
  let model = 'deterministic-template';
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    const llm = createLLM(config);
    const messages = [
      new SystemMessage(buildSystemPrompt()),
      new HumanMessage(buildUserPrompt(state)),
    ];

    const response = await llm.invoke(messages);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parsed = JSON.parse(content) as unknown;
    script = scriptOutputSchema.parse(parsed);

    provider = config.providers.text.default;
    model = config.providers.text.model;

    const usage = response.usage_metadata;
    tokensIn = usage?.input_tokens ?? 0;
    tokensOut = usage?.output_tokens ?? 0;
    costCents = estimateCost(provider, model, tokensIn, tokensOut);
  } catch (err) {
    log.warn('LLM failed, using fallback', { jobId, node: 'generate_script', data: { error: String(err) } });
    script = fallbackScript(state);
  }

  const durationMs = Date.now() - startTime;
  log.info('Script generated', {
    jobId,
    node: 'generate_script',
    provider,
    durationMs,
    costCents,
    data: { scenesCount: script.scenes.length },
  });

  const prevCost = state.costTracking as Record<string, unknown> | undefined;
  const prevTotal = (prevCost?.totalCents as number) ?? 0;
  const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};
  const prevTokens = (prevCost?.tokensUsed as Record<string, number>) ?? {};

  return {
    script,
    currentStep: 'generate_script',
    costTracking: {
      totalCents: prevTotal + costCents,
      breakdown: { ...prevBreakdown, generate_script: costCents },
      tokensUsed: { ...prevTokens, [`${provider}:${model}`]: (prevTokens[`${provider}:${model}`] ?? 0) + tokensIn + tokensOut },
      budgetRemainingCents: (prevCost?.budgetRemainingCents as number ?? 100) - costCents,
    },
  };
}

function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const rates: Record<string, [number, number]> = {
    'gpt-4.1': [2.0, 8.0],
    'gpt-4.1-mini': [0.4, 1.6],
    'gpt-4.1-nano': [0.1, 0.4],
    'gpt-4o': [2.5, 10.0],
    'gpt-4o-mini': [0.15, 0.6],
    'claude-sonnet-4-6-20250514': [3.0, 15.0],
    'claude-haiku-4-5-20251001': [1.0, 5.0],
    'gemini-2.5-flash': [0.3, 2.5],
    'gemini-2.5-pro': [2.5, 15.0],
  };

  const [inRate, outRate] = rates[model] ?? [1.0, 4.0];
  return (inputTokens / 1_000_000) * inRate * 100 + (outputTokens / 1_000_000) * outRate * 100;
}
