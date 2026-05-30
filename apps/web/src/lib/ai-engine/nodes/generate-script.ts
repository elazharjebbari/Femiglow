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

À propos de FemiGlow :
FemiGlow est une maison de soin japonaise spécialisée dans la beauté naturelle des ongles. Ses produits phares incluent :
- Sérum Éclat Naturel — soin quotidien pour ongles lumineux
- Huile Rituel Précieux — huile nourrissante aux extraits de camélia et yuzu
- Baume Réparateur Nuit — soin intensif nocturne à la kératine végétale
- Kit Rituel Complet — coffret découverte du rituel FemiGlow

Le ton est celui d'une maison qui murmure plutôt que de crier. Chaque mot doit respirer le calme, la précision et la sensorialité.

Vocabulaire clé à privilégier :
- Le geste (pas "l'application") — chaque soin est un geste intentionnel
- Le rituel (pas "la routine") — la répétition devient un moment sacré
- L'éclat (pas "la brillance") — la lumière vient de l'intérieur
- La lumière — naturelle, douce, révélée
- La précision — japonaise, délicate, sans excès
- La patience — le temps est un ingrédient du soin

Direction visuelle :
- Palette : tons crème, sauge, blanc chaud, rose poudré, or mat
- Éclairage : lumière naturelle latérale ou golden hour, jamais de flash direct
- Textures : gros plans sur les textures crème, huileuse, nacrée
- Compositions : minimalisme japonais, espace négatif, lignes épurées
- Mains : toujours soignées, gestes lents et intentionnels, ongles naturels

Règles absolues :
- Écrire en français
- Jamais d'emoji
- Jamais de point d'exclamation
- Aucune promesse médicale ou miraculeuse (pas de "guérit", "répare", "transforme")
- Aucune urgence commerciale agressive (pas de "offre limitée", "dernière chance")
- Ton : raffiné, précis, sensoriel, contemplatif
- Valoriser le geste, le rituel, la patience
- Ancrer dans la culture japonaise authentique (wabi-sabi, mono no aware, ikigai)
- Chaque scène doit avoir une intention visuelle claire
- Le hook doit être sensoriel avant d'être informatif

Tu retournes UNIQUEMENT du JSON valide conforme au schema demandé.`;
}

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  instagram: `Instructions spécifiques Instagram :
- Reel : le hook doit être visuel et capturer l'attention en 1,5 seconde maximum. Le mouvement doit commencer dès la première frame.
- Carousel : chaque slide doit apporter une valeur autonome. Un utilisateur qui ne voit qu'une slide doit quand même comprendre le message.
- Story : format vertical, textes lisibles sur mobile, durée max 15s par segment.
- Post statique : la composition doit fonctionner en miniature (feed grid).`,
  tiktok: `Instructions spécifiques TikTok :
- Le hook doit créer de la curiosité en moins de 1 seconde.
- Privilégier un rythme dynamique avec des coupes fréquentes (toutes les 2-3 secondes).
- La narration doit donner envie de regarder jusqu'au bout (rétention).
- Intégrer des trends visuelles ou sonores quand pertinent.`,
  linkedin: `Instructions spécifiques LinkedIn :
- Ton professionnel mais accessible, orienté expertise.
- Le script doit apporter une valeur éducative ou un insight de l'industrie.
- Format carrousel : chaque slide est un point clé, narrative progressive.`,
  pinterest: `Instructions spécifiques Pinterest :
- Format vertical (2:3 ou 9:16), très visuel.
- Le texte overlay doit être minimal et lisible.
- Privilégier l'esthétique et l'aspiration.`,
  facebook: `Instructions spécifiques Facebook :
- Privilégier le storytelling et la connexion émotionnelle.
- Les 3 premières secondes sont décisives pour le reel.
- Pour les posts : texte plus long et narratif accepté.`,
};

function buildUserPrompt(state: Record<string, unknown>): string {
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown>;
  const platform = state.platform as string;
  const format = state.format as string;
  const knowledge = (state.knowledgeContext as string) || '';
  const trends = (state.trendContext as string) || '';
  const brand = (state.brandGuidelines as string) || '';

  const platformInstructions = PLATFORM_INSTRUCTIONS[platform] ?? '';

  const fewShotExample = `
Exemple de script de référence (Instagram Reel, objectif engagement, produit Sérum Éclat Naturel) :
{
  "hook": "Ce geste de trois secondes a changé la lumière de mes ongles.",
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "Gros plan sur des mains posées sur du lin blanc. Lumière naturelle latérale, dorée. Les ongles sont visibles mais pas encore soignés. Ambiance calme, presque méditative.",
      "textOverlay": "Avant le rituel",
      "durationSeconds": 3,
      "transition": "fade"
    },
    {
      "sceneNumber": 2,
      "description": "Une goutte de sérum tombe au ralenti sur un ongle. La texture est nacrée, légèrement dorée. Le geste est lent, précis, intentionnel. On entend presque le silence.",
      "textOverlay": "Sérum Éclat Naturel",
      "durationSeconds": 4,
      "transition": "cut"
    },
    {
      "sceneNumber": 3,
      "description": "Massage circulaire du sérum sur chaque ongle. Les doigts bougent avec la lenteur d'un rituel de thé. La lumière accroche les ongles à chaque passage.",
      "durationSeconds": 4,
      "transition": "slide"
    },
    {
      "sceneNumber": 4,
      "description": "Plan final : les mains reposent près du flacon. Les ongles ont un éclat subtil, naturel. Pas de vernis, juste de la lumière. Le flacon est visible en arrière-plan, flou artistique.",
      "textOverlay": "L'éclat vient de l'intérieur",
      "durationSeconds": 4,
      "transition": "fade"
    }
  ],
  "cta": "Découvrir le Sérum Éclat Naturel",
  "voiceoverRequired": true,
  "musicRequired": true,
  "musicMood": "calm",
  "visualDirection": [
    {
      "element": "texture_closeup",
      "style": "minimal_japanese",
      "colors": ["cream", "gold_matte", "warm_white"],
      "composition": "closeup"
    },
    {
      "element": "hands",
      "style": "bright_natural",
      "colors": ["skin_tone", "nacre", "soft_pink"],
      "composition": "rule_of_thirds"
    }
  ],
  "estimatedDurationSeconds": 15
}
--- Fin de l'exemple ---`;

  return JSON.stringify({
    task: 'generate_structured_script',
    platform,
    format,
    platformInstructions,
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
    knowledgeContext: knowledge.slice(0, 4000),
    trendContext: trends.slice(0, 1500),
    brandGuidelines: brand.slice(0, 1500),
    fewShotExample,
    instructions: [
      'Inspire-toi de l\'exemple ci-dessus pour le niveau de détail et le ton, mais crée un script original adapté au brief.',
      'Chaque description de scène doit inclure : lumière, texture, mouvement, composition.',
      'Le hook doit être sensoriel — il doit faire ressentir, pas juste informer.',
      'Le CTA doit être une invitation douce, jamais une injonction.',
      'Les transitions doivent servir le rythme narratif.',
    ],
    outputSchema: {
      hook: 'Première phrase ou les 3 premières secondes — doit arrêter le scroll',
      scenes: [
        {
          sceneNumber: 'int',
          description: 'Description visuelle détaillée de la scène (lumière, texture, mouvement, composition)',
          textOverlay: 'Texte à incruster (optionnel)',
          durationSeconds: 'Durée en secondes',
          transition: 'cut | fade | slide | zoom',
        },
      ],
      cta: 'Call-to-action final — invitation douce',
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
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown>;
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
