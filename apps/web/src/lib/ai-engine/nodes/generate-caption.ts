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

const PLATFORM_CAPTION_GUIDANCE: Record<string, string> = {
  instagram: `Instagram : Utilise l'espace disponible (jusqu'a 2200 caractères) pour maximiser l'engagement. Les captions longues et riches performent mieux que les courtes. Structure : hook percutant en premiere ligne (visible avant "...plus"), puis développement narratif, puis CTA. Les sauts de ligne améliorent la lisibilité.`,
  tiktok: `TikTok : Caption courte et percutante. Maximum 2-3 lignes. Le ton peut etre plus direct et conversationnel tout en restant raffiné. La caption doit compléter la vidéo, pas la répéter.`,
  linkedin: `LinkedIn : Narrative professionnelle et éducative. Partager un insight, une expertise, un point de vue sur l'industrie de la beauté. Structure en paragraphes courts. Ton expert mais accessible.`,
  pinterest: `Pinterest : Caption descriptive et optimisée pour la recherche. Inclure des mots-clés pertinents naturellement. Maximum 500 caractères, chaque mot compte.`,
  facebook: `Facebook : Storytelling émotionnel. Le format permet des textes longs mais la première phrase doit captiver. Encourager le partage et les commentaires.`,
  twitter: `Twitter/X : Maximum 280 caractères. Chaque mot doit porter. Privilégier une pensée unique et mémorable.`,
  threads: `Threads : Conversationnel et authentique. Maximum 500 caractères. Ton plus intime et personnel.`,
};

const CTA_BY_OBJECTIVE: Record<string, string> = {
  conversion: `CTA de conversion : invitation douce vers l'achat. Exemples : "Découvrir le rituel", "Commencer votre rituel". Jamais d'urgence ("Achetez maintenant").`,
  engagement: `CTA d'engagement : poser une question ouverte ou inviter au partage. Exemples : "Et vous, quel est votre geste du matin", "Partagez votre rituel".`,
  awareness: `CTA de notoriété : inviter à explorer ou suivre. Exemples : "En savoir plus sur la J-Beauty", "Suivre le rituel FemiGlow".`,
  traffic: `CTA de trafic : guider vers le lien. Exemples : "Lien dans la bio", "Découvrir sur femiglow.com".`,
  education: `CTA éducatif : inviter à approfondir. Exemples : "Sauvegarder pour votre prochain rituel", "Partager à quelqu'un qui en a besoin".`,
};

function buildSystemPrompt(): string {
  return `Tu es un copywriter expert pour FemiGlow, maison de soin japonaise spécialisée en beauté naturelle des ongles.

Tu maitrises les frameworks de copywriting suivants et tu les appliques selon le contexte :
- PAS (Problem-Agitation-Solution) : identifier le problème, amplifier la frustration, présenter la solution FemiGlow
- AIDA (Attention-Interest-Desire-Action) : capter l'attention, susciter l'intérêt, créer le désir, appeler à l'action
- BAB (Before-After-Bridge) : montrer l'avant, projeter l'après, présenter FemiGlow comme le pont

Le ton est celui d'une maison qui murmure plutôt que de crier. Chaque mot doit respirer le calme, la précision et la sensorialité.

Règles de rédaction :
- Écrire en français, toujours
- Jamais d'emoji, jamais de point d'exclamation
- Aucune promesse médicale ou miraculeuse
- Aucune urgence commerciale agressive
- La première ligne est le hook — c'est la seule ligne visible avant "...plus" ou "...more". Elle doit arrêter le scroll.
- Le CTA est toujours une invitation douce, jamais une injonction
- Les sauts de ligne créent du rythme et de la respiration

Stratégie hashtags :
- 3 hashtags de niche (#soindesongles, #jbeauty, #rituelbeaute)
- 3 hashtags moyens (#beautejaponaise, #onglesnaturels, #soinnaturel)
- 3 hashtags larges (#beaute, #skincare, #selfcare)
- Adapter le nombre total selon la plateforme
- Les hashtags sont en minuscules, sans accents problématiques, sans espaces

Tu retournes UNIQUEMENT du JSON valide conforme au schema demandé.`;
}

function buildCaptionPrompt(state: Record<string, unknown>): string {
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown>;
  const script = state.script as Record<string, unknown>;
  const platform = state.platform as string;
  const format = state.format as string;
  const maxLength = PLATFORM_LIMITS[platform] ?? 2200;
  const objective = (brief.objective as string) ?? 'engagement';

  const platformGuidance = PLATFORM_CAPTION_GUIDANCE[platform] ?? '';
  const ctaGuidance = CTA_BY_OBJECTIVE[objective] ?? CTA_BY_OBJECTIVE['engagement'];

  return JSON.stringify({
    task: 'generate_caption_and_hashtags',
    platform,
    format,
    maxLength,
    platformGuidance,
    ctaGuidance,
    script: {
      hook: script.hook,
      cta: script.cta,
    },
    brief: {
      objective: brief.objective,
      tone: brief.tone,
      keyMessage: brief.keyMessage,
      productFocus: brief.productFocus,
      targetAudience: brief.targetAudience,
    },
    knowledgeContext: (state.knowledgeContext as string)?.slice(0, 1500) ?? '',
    rules: {
      language: 'français',
      noEmoji: true,
      noExclamation: true,
      noMedicalClaims: true,
      hashtagStrategy: {
        niche: '3 hashtags de niche (ex: soindesongles, jbeauty, rituelbeaute)',
        mid: '3 hashtags moyens (ex: beautejaponaise, onglesnaturels, soinnaturel)',
        broad: '3 hashtags larges (ex: beaute, skincare, selfcare)',
        totalCount: platform === 'instagram' ? '8-12' : platform === 'twitter' ? '1-3' : '3-5',
      },
      firstLineIsHook: 'La première ligne doit captiver — c\'est la seule visible avant "...plus". Elle doit fonctionner seule.',
      ctaAtEnd: true,
      copywritingFramework: 'Choisis le framework le plus adapté à l\'objectif : PAS pour conversion, AIDA pour awareness, BAB pour engagement.',
    },
    outputSchema: {
      caption: 'string — caption complète avec line breaks. La première ligne est le hook visible.',
      hashtags: ['string — sans le #, en minuscules'],
      cta: 'string — call-to-action adapté à l\'objectif',
    },
  });
}

function fallbackCaption(state: Record<string, unknown>): z.infer<typeof captionOutputSchema> {
  const script = state.script as Record<string, unknown> | null;
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown>;
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
      new SystemMessage(buildSystemPrompt()),
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
