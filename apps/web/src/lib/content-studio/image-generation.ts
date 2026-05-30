import { env } from '@/lib/env';
import sharp from 'sharp';
import { HttpError } from '@/lib/errors/http-error';
import { higgsfieldAuthHeader, higgsfieldBaseUrl } from './higgsfield-auth';
import { resolveProviderCredential } from './provider-credentials';
import { imageCostCents } from './pricing';

export interface GenerateStudioImageInput {
  prompt: string;
  size: '1024x1024' | '1024x1536' | '1536x1024';
  quality: 'low' | 'medium' | 'high';
  /** Operator-selected model id (e.g. `hf-flux-pro`). Routes to Higgsfield if `hf-*`. */
  model?: string;
  /** Generation mode propagated from the cookie. `mock` forces SVG fallback. */
  mode?: 'mock' | 'live';
}

export interface GeneratedStudioImage {
  buffer: Buffer;
  mime: 'image/png';
  provider: 'mock' | 'openai' | 'higgsfield';
  model: string;
  usage: Record<string, unknown>;
  estimatedCostCents: number;
}

// Tarifs image centralisés dans ./pricing (ACT-BE-035).

function isOpenAiImageModel(model: string | undefined): boolean {
  if (!model) return false;
  return /^(gpt-image-|dall-e-)/i.test(model);
}

function isMockImageModel(model: string | undefined): boolean {
  if (!model) return false;
  return /^mock-/i.test(model);
}

export async function generateStudioImage(
  input: GenerateStudioImageInput,
): Promise<GeneratedStudioImage> {
  // ---------------------------------------------------------------------------
  // Routing par MODÈLE puis MODE puis ENV (fallback).
  //
  // Règles :
  //  1. mode === 'mock'              → SVG fallback (toujours)
  //  2. model = 'mock-*'             → SVG fallback (modèle explicitement mock)
  //  3. model = 'hf-*'               → Higgsfield API (key requise → erreur claire sinon)
  //  4. model = 'gpt-image-*'/'dall-e-*'
  //                                  → OpenAI API (key requise → erreur claire sinon)
  //  5. pas de model, mode === 'live'→ tenter OpenAI si key, sinon erreur
  //  6. pas de model, mode unset     → fallback env (legacy)
  //
  // Le mode 'live' force le vrai provider du modèle sélectionné. L'env var
  // `CONTENT_STUDIO_IMAGE_PROVIDER=mock` ne masque PLUS un appel live.
  // ---------------------------------------------------------------------------

  // 1. Operator explicitly chose mock mode → SVG.
  if (input.mode === 'mock') {
    return generateMockStudioImage(input);
  }

  // 2. Model id is an explicit mock model.
  if (isMockImageModel(input.model)) {
    return generateMockStudioImage(input);
  }

  // 3. Higgsfield model.
  if (input.model?.startsWith('hf-')) {
    const auth = higgsfieldAuthHeader();
    if (!auth) {
      throw new HttpError(
        'invalid_state',
        `Modèle « ${input.model} » sélectionné mais credential Higgsfield incomplet. ` +
          `Higgsfield exige KEY_ID:KEY_SECRET : fournis AI_ENGINE_HIGGSFIELD_API_SECRET ` +
          `(ou mets AI_ENGINE_HIGGSFIELD_API_KEY au format "KEY_ID:KEY_SECRET"). ` +
          `Sinon passe en mode mock.`,
      );
    }
    return generateHiggsfieldImage(input, auth);
  }

  // Étapes 4-6 (OpenAI) : résolution de credential UNIFIÉE (ACT-ARC-013 / ACT-BE-010).
  // resolveProviderCredential('openai') lit la DB puis la chaîne d'env (incl.
  // OPENAI_API_KEY, déjà valide dans le process), chaîne vide neutralisée — ferme
  // le split d'env de BUG-001 (le create-flow lisait CONTENT_STUDIO_OPENAI_API_KEY
  // seule, vide). Même source que le picker/discovery.
  const openaiKey = await resolveProviderCredential('openai');

  // 4. OpenAI model.
  if (isOpenAiImageModel(input.model)) {
    if (!openaiKey) {
      throw new HttpError(
        'invalid_state',
        `Modèle OpenAI « ${input.model} » sélectionné mais aucune clé OpenAI résolue (CONTENT_STUDIO_OPENAI_API_KEY / OPENAI_API_KEY). Configure la clé ou choisis un modèle Higgsfield (hf-*).`,
      );
    }
    return callOpenAiImage(input, input.model!, openaiKey);
  }

  // 5. Live mode without an explicit model — try OpenAI default if key present.
  if (input.mode === 'live') {
    if (!openaiKey) {
      throw new HttpError(
        'invalid_state',
        'Mode live sans modèle Higgsfield sélectionné et aucune clé OpenAI résolue. Sélectionne un modèle Higgsfield (hf-*) ou configure la clé OpenAI.',
      );
    }
    return callOpenAiImage(input, env.CONTENT_STUDIO_IMAGE_MODEL, openaiKey);
  }

  // 6. Legacy fallback : env-driven.
  if (env.CONTENT_STUDIO_IMAGE_PROVIDER === 'mock') {
    return generateMockStudioImage(input);
  }
  if (!openaiKey) {
    throw new Error('Aucune clé OpenAI résolue (CONTENT_STUDIO_OPENAI_API_KEY / OPENAI_API_KEY)');
  }
  return callOpenAiImage(input, env.CONTENT_STUDIO_IMAGE_MODEL, openaiKey);
}

async function callOpenAiImage(
  input: GenerateStudioImageInput,
  modelId: string,
  apiKey: string,
): Promise<GeneratedStudioImage> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      n: 1,
    }),
  });
  const json = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as {
    data?: Array<{ b64_json?: string }>;
    usage?: Record<string, unknown>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `OpenAI image generation failed: HTTP ${res.status}`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('Réponse image OpenAI invalide : b64_json manquant');
  return {
    buffer: Buffer.from(b64, 'base64'),
    mime: 'image/png',
    provider: 'openai',
    model: modelId,
    usage: json.usage ?? {},
    estimatedCostCents: imageCostCents(modelId, input.quality),
  };
}

async function generateHiggsfieldImage(
  input: GenerateStudioImageInput,
  authHeader: string,
): Promise<GeneratedStudioImage> {
  const { width, height } = parseSize(input.size);
  // Map model ids to Higgsfield's real model names.
  const HF_MODEL_MAP: Record<string, string> = {
    'hf-flux-schnell': 'flux-schnell',
    'hf-flux-1': 'flux-1',
    'hf-flux-pro': 'flux-pro',
  };
  const hfModel = HF_MODEL_MAP[input.model ?? ''] ?? 'flux-1';
  // TODO(higgsfield): l'API réelle utilise un modèle async submit + polling
  // (`/v1/text2image/<model>` puis `/v1/requests/{id}/status`). Ce chemin
  // synchrone `/images/generate` doit être réécrit et validé avec un credential
  // complet. Host + auth sont déjà corrects ci-dessous.
  const res = await fetch(`${higgsfieldBaseUrl()}/v1/images/generate`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: hfModel,
      prompt: input.prompt,
      num_images: 1,
      width,
      height,
      quality: input.quality,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(
      `Higgsfield image generation failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {
    images?: Array<{ url?: string; base64?: string }>;
  };
  const first = json.images?.[0];
  if (!first) {
    throw new Error('Higgsfield: aucune image renvoyée.');
  }
  let buffer: Buffer;
  if (first.base64) {
    buffer = Buffer.from(first.base64, 'base64');
  } else if (first.url) {
    const imgRes = await fetch(first.url, { signal: AbortSignal.timeout(60_000) });
    if (!imgRes.ok) {
      throw new Error(`Higgsfield: téléchargement image échoué (${imgRes.status}).`);
    }
    buffer = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error('Higgsfield: réponse sans url ni base64.');
  }
  // Normaliser en PNG via sharp pour cohérence avec le reste de la chaîne.
  const png = await sharp(buffer).png().toBuffer();
  return {
    buffer: png,
    mime: 'image/png',
    provider: 'higgsfield',
    model: input.model ?? 'hf-flux-1',
    usage: { mode: 'live', model: hfModel },
    estimatedCostCents: imageCostCents(input.model, input.quality),
  };
}

async function generateMockStudioImage(input: GenerateStudioImageInput): Promise<GeneratedStudioImage> {
  const { width, height } = parseSize(input.size);
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fbf7f1"/>
          <stop offset="0.52" stop-color="#f6d7cf"/>
          <stop offset="1" stop-color="#e8efe5"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="${width * 0.22}" cy="${height * 0.22}" r="${Math.min(width, height) * 0.12}" fill="#8f3f4a" opacity="0.16"/>
      <rect x="${width * 0.16}" y="${height * 0.18}" width="${width * 0.68}" height="${height * 0.64}" rx="${Math.min(width, height) * 0.035}" fill="#fffaf5" opacity="0.86"/>
      <path d="M ${width * 0.28} ${height * 0.58} C ${width * 0.4} ${height * 0.46}, ${width * 0.56} ${height * 0.46}, ${width * 0.72} ${height * 0.58}" fill="none" stroke="#2f2a26" stroke-width="${Math.max(8, width * 0.012)}" stroke-linecap="round" opacity="0.52"/>
      <circle cx="${width * 0.5}" cy="${height * 0.43}" r="${Math.min(width, height) * 0.075}" fill="#c98d75" opacity="0.58"/>
      <rect x="${width * 0.35}" y="${height * 0.66}" width="${width * 0.3}" height="${height * 0.035}" rx="${height * 0.018}" fill="#2f2a26" opacity="0.28"/>
    </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    buffer,
    mime: 'image/png',
    provider: 'mock',
    model: 'mock-low-cost-image',
    usage: {
      mode: 'mock',
      promptLength: input.prompt.length,
      size: input.size,
      quality: input.quality,
    },
    estimatedCostCents: 0,
  };
}

function parseSize(size: GenerateStudioImageInput['size']): { width: number; height: number } {
  const [width, height] = size.split('x').map((value) => Number(value));
  return { width: width || 1024, height: height || 1024 };
}

