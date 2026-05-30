import { z } from 'zod';
import { env } from '@/lib/env';
import type { ContentIdea } from './types';
import { HttpError } from '@/lib/errors/http-error';
import { resolveProviderCredential } from './provider-credentials';

const generatedBriefSchema = z.object({
  angle: z.string(),
  proof: z.string(),
  cta: z.string(),
  mediaDirection: z.string(),
  constraints: z.record(z.unknown()).default({}),
});

const generatedDraftSchema = z.object({
  variantLabel: z.string(),
  hook: z.string(),
  caption: z.string(),
  cta: z.string(),
  altText: z.string().default(''),
  hashtags: z.array(z.string()).default([]),
});

const generationOutputSchema = z.object({
  brief: generatedBriefSchema,
  drafts: z.array(generatedDraftSchema).min(1),
});

export { generationOutputSchema };

export interface GeneratedBrief {
  angle: string;
  proof: string;
  cta: string;
  mediaDirection: string;
  constraints: Record<string, unknown>;
}

export interface GeneratedDraft {
  variantLabel: string;
  hook: string;
  caption: string;
  cta: string;
  altText: string;
  hashtags: string[];
}

export interface GenerationResult {
  provider: 'openai' | 'fallback';
  model: string;
  promptVersion: string;
  brief: GeneratedBrief;
  drafts: GeneratedDraft[];
  raw: Record<string, unknown>;
}

const PROMPT_VERSION = 'content-studio-v0-2026-05-14';

/**
 * CS v2 create-audit Phase 2 — caller can override the text model id for a
 * single generation run. Falls back to env.CONTENT_STUDIO_TEXT_MODEL when not
 * provided. Logged on the resulting `content_generation_run.model` row.
 */
export interface GenerateForIdeaOptions {
  model?: string;
  /**
   * Mode de génération propagé depuis le cookie `cs_generation_mode`
   * (ACT-BE-013). `mock` force le fallback déterministe (jamais d'appel LLM,
   * même si une clé est présente dans le process) ; `live` exige une clé
   * résolue (sinon erreur explicite, pas une dégradation silencieuse).
   */
  mode?: 'mock' | 'live';
}

export async function generateForIdea(
  idea: ContentIdea,
  opts: GenerateForIdeaOptions = {},
): Promise<GenerationResult> {
  const model = opts.model ?? env.CONTENT_STUDIO_TEXT_MODEL;

  // En mode mock explicite : résultat déterministe assumé, on ne touche jamais
  // le LLM (sinon le mode mock partirait en live au déploiement, là où une clé
  // OPENAI_API_KEY est présente dans le process).
  if (opts.mode === 'mock') {
    return fallbackGeneration(idea);
  }

  // Résolution de clé UNIFIÉE (ACT-ARC-013 / ACT-BE-010-texte) : chaîne d'env
  // incl. OPENAI_API_KEY, chaîne vide neutralisée — ferme le split BUG-005
  // (le `??` historique laissait passer une chaîne vide et n'allait jamais
  // chercher OPENAI_API_KEY).
  const apiKey = await resolveProviderCredential('openai');

  // Mode live explicite sans clé : erreur claire (pas un fallback silencieux
  // qui ferait croire que le live fonctionne).
  if (opts.mode === 'live' && !apiKey) {
    throw new HttpError(
      'invalid_state',
      'Mode live : aucune clé OpenAI résolue (CONTENT_STUDIO_OPENAI_API_KEY / OPENAI_API_KEY). Configure la clé ou repasse en mode mock.',
    );
  }

  if (!apiKey) return fallbackGeneration(idea);

  try {
    const body = buildOpenAIBody(idea, model);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return fallbackGeneration(idea, { providerError: await safeText(res) });
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? '';
    const raw = JSON.parse(content) as unknown;
    const parsed = generationOutputSchema.parse(raw);
    return {
      provider: 'openai',
      model,
      promptVersion: PROMPT_VERSION,
      brief: parsed.brief,
      drafts: parsed.drafts.slice(0, 3),
      raw: json as Record<string, unknown>,
    };
  } catch (err) {
    return fallbackGeneration(idea, { providerError: String(err) });
  }
}

function buildOpenAIBody(idea: ContentIdea, model: string): Record<string, unknown> {
  return {
    model,
    temperature: 0.65,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          "Tu aides FemiGlow à préparer du contenu social. Tu écris en français, sans emoji, sans point d’exclamation, sans urgence commerciale, sans promesse médicale. Retourne uniquement du JSON valide.",
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'generate_content_studio_brief_and_three_drafts',
          outputShape: {
            brief: {
              angle: 'string',
              proof: 'string',
              cta: 'string',
              mediaDirection: 'string',
              constraints: {},
            },
            drafts: [
              {
                variantLabel: 'sobre|sensorielle|conversion douce',
                hook: 'string',
                caption: 'string',
                cta: 'string',
                altText: 'string',
                hashtags: ['string'],
              },
            ],
          },
          idea,
        }),
      },
    ],
  };
}

function fallbackGeneration(
  idea: ContentIdea,
  raw: Record<string, unknown> = {},
): GenerationResult {
  const pillarLabel = label(idea.pillar);
  const brief: GeneratedBrief = {
    angle: `Relier ${pillarLabel} à un geste simple et fidèle à la maison.`,
    proof:
      idea.pillar === 'produit'
        ? 'Le rituel FemiGlow révèle l’éclat naturel sans vernis ni abrasion.'
        : 'La maison privilégie le geste, la précision et la patience.',
    cta: idea.objective === 'conversion' ? 'Découvrir le rituel' : 'Lire la suite',
    mediaDirection:
      'Mains, geste lent, lumière naturelle, crème chaud, accent sauge discret, produit fidèle.',
    constraints: {
      forbidden: ['emoji', 'point_exclamation', 'urgence_commerciale', 'promesse_medicale'],
      platform: idea.platform,
      format: idea.format,
    },
  };

  const base = idea.prompt.replace(/\s+/g, ' ').trim();

  // ACT-BE-013 (variation du fallback) — hooks VARIÉS par format et hashtags
  // par pilier, au lieu d'un bloc figé identique pour tout (un reel ne reçoit
  // plus le hook d'un post). Combiné au prompt (présent dans la caption), deux
  // idées de format/pilier/prompt distincts produisent des textes distincts —
  // ce qui permet aussi à la régénération de variation (BE-014) de différer.
  const hooksByFormat: Record<string, [string, string, string]> = {
    reel: [
      'Un geste lent capté en mouvement : la main retrouve sa lumière.',
      'Quelques secondes au ralenti, et l’éclat naturel revient.',
      'Le rituel en mouvement : un soin qui ne triche pas.',
    ],
    story: [
      'Un instant suspendu : la main, la lumière, le geste.',
      'Le temps d’une story, ralentir pour retrouver l’éclat.',
      'À garder près de soi : le rituel qui prend soin sans abîmer.',
    ],
    carousel: [
      'Étape par étape, la main retrouve sa lumière.',
      'Trois gestes, une routine : l’éclat naturel se construit.',
      'À faire défiler : le rituel FemiGlow, pas à pas.',
    ],
    post: [
      'Un geste lent, une main qui retrouve sa lumière.',
      'La lumière revient quand le geste ralentit.',
      'Recevoir le rituel, c’est choisir un soin qui ne triche pas.',
    ],
  };
  const hooks = hooksByFormat[idea.format] ?? hooksByFormat.post;
  const hashtagsByPillar: Record<string, string[]> = {
    produit: ['femiglow', 'kitfemiglow', 'soindesongles'],
    rituel: ['femiglow', 'rituel', 'ritueldebeaute'],
    education: ['femiglow', 'conseilsongles', 'soindesongles'],
  };
  const pillarTags = hashtagsByPillar[idea.pillar] ?? ['femiglow', 'maisonfemiglow', 'soindesongles'];

  const drafts: GeneratedDraft[] = [
    {
      variantLabel: 'sobre',
      hook: hooks[0],
      caption: `${base}. Chez FemiGlow, le soin commence par un geste précis et patient. Sans vernis, sans abrasion, le rituel accompagne l’éclat naturel de l’ongle.\n\n${brief.cta}.`,
      cta: brief.cta,
      altText: 'Main posée près du rituel FemiGlow dans une lumière naturelle.',
      hashtags: [...pillarTags],
    },
    {
      variantLabel: 'sensorielle',
      hook: hooks[1],
      caption: `${base}. Une texture, une pause, un éclat qui ne cherche pas à couvrir. Le rituel FemiGlow se transmet comme une attention discrète, avec soin.\n\n${brief.cta}.`,
      cta: brief.cta,
      altText: 'Détail de mains et de matière dans une ambiance crème et sauge.',
      hashtags: [pillarTags[0]!, 'maisonfemiglow', 'ritueldebeaute'],
    },
    {
      variantLabel: 'conversion douce',
      hook: hooks[2],
      caption: `${base}. Le kit FemiGlow accompagne les ongles avec précision, sans vernis ni abrasion. Une routine courte, mais pensée pour durer dans le geste.\n\n${brief.cta}.`,
      cta: brief.cta,
      altText: 'Kit FemiGlow présenté avec des mains dans une lumière douce.',
      hashtags: [pillarTags[0]!, 'kitfemiglow', 'onglesnaturels'],
    },
  ];

  return {
    provider: 'fallback',
    model: 'deterministic-template',
    promptVersion: PROMPT_VERSION,
    brief,
    drafts,
    raw,
  };
}

function label(value: string): string {
  return value.replace(/-/g, ' ');
}

async function safeText(res: Response): Promise<string> {
  return res.text().catch(() => `${res.status}`);
}

