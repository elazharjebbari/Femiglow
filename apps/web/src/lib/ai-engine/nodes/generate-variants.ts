import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:generate-variants');

const variantOutputSchema = z.object({
  variants: z.array(z.object({
    label: z.string(),
    hook: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
  })),
});

interface ContentVariant {
  variantIndex: number;
  label: string;
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
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown>;

  return JSON.stringify({
    task: 'generate_caption_variants',
    count: 3,
    original: {
      hook: script?.hook ?? '',
      caption,
      hashtags,
    },
    brief: {
      objective: brief.objective,
      tone: brief.tone,
      productFocus: brief.productFocus,
    },
    platform,
    variantStrategy: {
      variant1: {
        label: 'hook-alternatif',
        instruction: 'Change complètement l\'angle du hook. Si l\'original est sensoriel, utilise un angle éducatif ou une question. Si l\'original est une question, utilise une affirmation contemplative. Le hook doit être radicalement différent tout en restant fidèle à la marque. Le reste de la caption s\'adapte naturellement au nouveau hook.',
      },
      variant2: {
        label: 'cta-different',
        instruction: 'Garde un hook similaire à l\'original mais change complètement la stratégie du CTA et la structure de la caption. Si le CTA original invite à découvrir, celui-ci invite à sauvegarder ou partager. Si l\'original utilise PAS, celui-ci utilise AIDA. La caption doit mener naturellement vers ce nouveau CTA.',
      },
      variant3: {
        label: 'emotion-different',
        instruction: 'Change le registre émotionnel de toute la caption. Si l\'original est contemplatif, celui-ci est plus chaleureux et intime. Si l\'original est éducatif, celui-ci est poétique et sensoriel. Toute la caption doit respirer cette nouvelle émotion, du hook au CTA.',
      },
    },
    rules: {
      language: 'français',
      noEmoji: true,
      noExclamation: true,
      keepBrandVoice: true,
      eachVariantMustBeTrulyDifferent: 'Ne pas se contenter de reformuler. Chaque variante doit prendre un angle, un ton ou une structure véritablement distinct.',
    },
    outputSchema: {
      variants: [
        {
          label: 'string — "hook-alternatif" ou "cta-different" ou "emotion-different"',
          hook: 'string — le hook de cette variante',
          caption: 'string — la caption complète de cette variante',
          hashtags: ['string — hashtags adaptés à cette variante'],
        },
      ],
    },
  });
}

const VARIANT_LABELS = ['hook-alternatif', 'cta-different', 'emotion-different'] as const;

function generateDeterministicVariants(state: Record<string, unknown>): ContentVariant[] {
  const script = state.script as Record<string, unknown> | null;
  const caption = (state.caption as string) ?? '';
  const hashtags = (state.hashtags as string[]) ?? [];
  const qualityScores = (state.qualityScores as Record<string, number>) ?? {};
  const hook = (script?.hook as string) ?? '';

  const variantDefs: Array<{ label: string; hook: string; captionTransform: (c: string, h: string) => string }> = [
    {
      label: 'hook-alternatif',
      hook: hook
        ? `Saviez-vous que ${hook.charAt(0).toLowerCase()}${hook.slice(1)}`
        : 'Le secret de la J-Beauty, enfin accessible.',
      captionTransform: (c, h) => c ? c.replace(c.split('\n')[0] ?? '', h) : h,
    },
    {
      label: 'cta-different',
      hook: hook || 'Un geste précis, un éclat retrouvé.',
      captionTransform: (c, h) => {
        const lines = c ? c.split('\n') : [];
        const body = lines.slice(1).join('\n');
        return `${h}\n${body}\n\nSauvegarder ce rituel pour plus tard.`;
      },
    },
    {
      label: 'emotion-different',
      hook: hook
        ? `${hook} Chaque geste compte.`
        : 'La patience est le premier ingrédient de la beauté.',
      captionTransform: (c, h) => c ? c.replace(c.split('\n')[0] ?? '', h) : h,
    },
  ];

  return variantDefs.map((def, index) => ({
    variantIndex: index,
    label: def.label,
    script: script ? { ...script, hook: def.hook } : null,
    caption: def.captionTransform(caption, def.hook),
    hashtags: [...hashtags],
    qualityScores,
  }));
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
        `Tu es un copywriter expert pour FemiGlow, maison de soin japonaise.
Tu génères des variantes de captions qui sont véritablement différentes les unes des autres.

Chaque variante doit explorer un angle distinct :
- "hook-alternatif" : un hook radicalement différent (autre angle, autre émotion, autre structure)
- "cta-different" : une stratégie de CTA et de structure différente (autre framework, autre invitation)
- "emotion-different" : un registre émotionnel différent (contemplatif vs chaleureux vs poétique vs éducatif)

Le ton reste celui de FemiGlow : une maison qui murmure plutôt que de crier.
Règles : français, pas d'emoji, pas de point d'exclamation, pas de promesse médicale.

Retourne UNIQUEMENT du JSON valide avec le champ "label" pour chaque variante.`,
      ),
      new HumanMessage(buildVariantPrompt(state)),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parsed = variantOutputSchema.parse(JSON.parse(content));
    const script = state.script as Record<string, unknown> | null;
    const qualityScores = (state.qualityScores as Record<string, number>) ?? {};

    variants = parsed.variants.map((v, index) => ({
      variantIndex: index,
      label: v.label || VARIANT_LABELS[index] || `variant-${index}`,
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
