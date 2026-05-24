import { z } from 'zod';
import { env } from '@/lib/env';
import type { ContentIdea } from './types';

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

export async function generateForIdea(idea: ContentIdea): Promise<GenerationResult> {
  const apiKey = env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY;
  if (!apiKey) return fallbackGeneration(idea);

  try {
    const body = buildOpenAIBody(idea);
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
      model: env.CONTENT_STUDIO_TEXT_MODEL,
      promptVersion: PROMPT_VERSION,
      brief: parsed.brief,
      drafts: parsed.drafts.slice(0, 3),
      raw: json as Record<string, unknown>,
    };
  } catch (err) {
    return fallbackGeneration(idea, { providerError: String(err) });
  }
}

function buildOpenAIBody(idea: ContentIdea): Record<string, unknown> {
  return {
    model: env.CONTENT_STUDIO_TEXT_MODEL,
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
  const drafts: GeneratedDraft[] = [
    {
      variantLabel: 'sobre',
      hook: 'Un geste lent, une main qui retrouve sa lumière.',
      caption: `${base}. Chez FemiGlow, le soin commence par un geste précis et patient. Sans vernis, sans abrasion, le rituel accompagne l’éclat naturel de l’ongle.\n\n${brief.cta}.`,
      cta: brief.cta,
      altText: 'Main posée près du rituel FemiGlow dans une lumière naturelle.',
      hashtags: ['femiglow', 'rituel', 'soindesongles'],
    },
    {
      variantLabel: 'sensorielle',
      hook: 'La lumière revient quand le geste ralentit.',
      caption: `${base}. Une texture, une pause, un éclat qui ne cherche pas à couvrir. Le rituel FemiGlow se transmet comme une attention discrète, avec soin.\n\n${brief.cta}.`,
      cta: brief.cta,
      altText: 'Détail de mains et de matière dans une ambiance crème et sauge.',
      hashtags: ['femiglow', 'maisonfemiglow', 'ritueldebeaute'],
    },
    {
      variantLabel: 'conversion douce',
      hook: 'Recevoir le rituel, c’est choisir un soin qui ne triche pas.',
      caption: `${base}. Le kit FemiGlow accompagne les ongles avec précision, sans vernis ni abrasion. Une routine courte, mais pensée pour durer dans le geste.\n\n${brief.cta}.`,
      cta: brief.cta,
      altText: 'Kit FemiGlow présenté avec des mains dans une lumière douce.',
      hashtags: ['femiglow', 'kitfemiglow', 'onglesnaturels'],
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

