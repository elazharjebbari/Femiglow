import { env } from '@/lib/env';
import { HttpError } from '@/lib/errors/http-error';
import type { ContentFormat } from './types';
import { higgsfieldAuthHeader, higgsfieldBaseUrl } from './higgsfield-auth';

const HIGGSFIELD_VIDEO_PRICING_CENTS: Record<string, number> = {
  'hf-video-mini': 400,
  'hf-video-lite': 1200,
  'hf-video-standard': 2800,
  'hf-video-turbo': 6500,
};
const HIGGSFIELD_POLL_INTERVAL_MS = 5_000;
const HIGGSFIELD_POLL_TIMEOUT_MS = 300_000;

/**
 * CS v2 create-audit Phase 4 — Video generation service.
 *
 * Today the only path is the **mock provider**, which serves a pre-rendered
 * MP4 from `/public/_media/content-studio/mock/`. Real video providers
 * (Veo, Sora, HiggsField) are tracked in the audit backlog and would plug
 * in here without changing the calling service.
 */

export interface GenerateStudioVideoInput {
  /** Used to pick the right aspect ratio (reel/story → 9:16). */
  format: ContentFormat;
  /** Free-text prompt — recorded on the generation_run for audit. */
  prompt: string;
  /** Optional model id override. Falls back to env.CONTENT_STUDIO_VIDEO_MODEL. */
  model?: string;
  /** Generation mode propagated from cookie. `mock` forces the static asset. */
  mode?: 'mock' | 'live';
}

export interface GeneratedStudioVideo {
  /** Public-facing URL playable by an HTML5 <video> element. */
  publicUrl: string;
  /** URL of a still frame usable as poster. */
  posterUrl: string;
  /** Container mime type — always `video/mp4` in mock mode. */
  mime: 'video/mp4';
  /** Pixel width (denormalized for media table). */
  width: number;
  /** Pixel height (denormalized for media table). */
  height: number;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Approximate file size, useful for the media row. Computed lazily — 0 in mock. */
  sizeBytes: number;
  provider: 'mock' | 'higgsfield';
  model: string;
  usage: Record<string, unknown>;
  /** Always 0 in mock; real providers will populate it. */
  estimatedCostCents: number;
}

interface MockVideoAsset {
  publicUrl: string;
  posterUrl: string;
  width: number;
  height: number;
  durationMs: number;
}

/**
 * Static mock asset registry, keyed by format. Only `reel` and `story` ship
 * a video today — `post` and `carousel` are image-only by design.
 */
const MOCK_ASSETS: Partial<Record<ContentFormat, MockVideoAsset>> = {
  reel: {
    publicUrl: '/_media/content-studio/mock/reel-9x16.mp4',
    posterUrl: '/_media/content-studio/mock/poster-9x16.jpg',
    width: 1080,
    height: 1920,
    durationMs: 5_000,
  },
  story: {
    publicUrl: '/_media/content-studio/mock/story-9x16.mp4',
    posterUrl: '/_media/content-studio/mock/poster-9x16.jpg',
    width: 1080,
    height: 1920,
    durationMs: 3_000,
  },
};

export async function generateStudioVideo(
  input: GenerateStudioVideoInput,
): Promise<GeneratedStudioVideo> {
  // Routing par MODÈLE puis MODE puis ENV (fallback).
  //  1. mode === 'mock'            → mock asset
  //  2. model = 'mock-*'           → mock asset (modèle explicite)
  //  3. model = 'hf-video-*' + key → Higgsfield (sinon erreur claire)
  //  4. mode === 'live' sans hf-*  → erreur (pas d'autre provider vidéo live)
  //  5. fallback env               → mock

  if (input.mode === 'mock') {
    return generateMockStudioVideo(input);
  }

  if (input.model && /^mock-/i.test(input.model)) {
    return generateMockStudioVideo(input);
  }

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
    return generateHiggsfieldStudioVideo(input, auth);
  }

  // Mode live sans modèle Higgsfield = pas d'autre provider vidéo branché.
  if (input.mode === 'live') {
    throw new HttpError(
      'invalid_state',
      'Mode live actif mais aucun modèle vidéo live disponible. Sélectionne un modèle Higgsfield (hf-video-*).',
    );
  }

  // Legacy fallback : env-driven.
  if (env.CONTENT_STUDIO_V2_MOCK_MODE === 'true') {
    return generateMockStudioVideo(input);
  }
  const provider = env.CONTENT_STUDIO_VIDEO_PROVIDER;
  if (provider !== 'mock') {
    throw new HttpError(
      'invalid_state',
      `Le provider vidéo « ${provider} » n'est pas encore implémenté — choisis un modèle Higgsfield (hf-video-*) ou passe en mode mock.`,
    );
  }
  return generateMockStudioVideo(input);
}

async function generateHiggsfieldStudioVideo(
  input: GenerateStudioVideoInput,
  authHeader: string,
): Promise<GeneratedStudioVideo> {
  const HF_MODEL_MAP: Record<string, string> = {
    'hf-video-mini': 'mini',
    'hf-video-lite': 'lite',
    'hf-video-standard': 'standard',
    'hf-video-turbo': 'turbo',
  };
  const hfModel = HF_MODEL_MAP[input.model ?? ''] ?? 'lite';
  const durationSec = hfModel === 'turbo' || hfModel === 'standard' ? 10 : 5;

  // TODO(higgsfield): l'API réelle utilise `/v1/image2video/<model>` + polling
  // `/v1/requests/{id}/status`. Ces chemins doivent être réécrits et validés
  // avec un credential complet. Host + auth sont déjà corrects ci-dessous.
  // Step 1 — submit the job
  const submitRes = await fetch(`${higgsfieldBaseUrl()}/v1/videos/generate`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: hfModel,
      prompt: input.prompt,
      duration_seconds: durationSec,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => `HTTP ${submitRes.status}`);
    throw new Error(
      `Higgsfield video submit failed (${submitRes.status}): ${text.slice(0, 200)}`,
    );
  }
  const submitJson = (await submitRes.json()) as { job_id?: string; jobId?: string };
  const jobId = submitJson.job_id ?? submitJson.jobId;
  if (!jobId) {
    throw new Error('Higgsfield video : job_id manquant dans la réponse.');
  }

  // Step 2 — poll for completion
  const deadline = Date.now() + HIGGSFIELD_POLL_TIMEOUT_MS;
  let videoUrl: string | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, HIGGSFIELD_POLL_INTERVAL_MS));
    const pollRes = await fetch(`${higgsfieldBaseUrl()}/v1/videos/status/${jobId}`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(30_000),
    });
    if (!pollRes.ok) {
      if (pollRes.status >= 500) continue;
      const text = await pollRes.text().catch(() => `HTTP ${pollRes.status}`);
      throw new Error(`Higgsfield poll failed (${pollRes.status}): ${text.slice(0, 200)}`);
    }
    const pollJson = (await pollRes.json()) as {
      status?: string;
      video_url?: string;
      error?: string;
    };
    if (pollJson.status === 'completed' && pollJson.video_url) {
      videoUrl = pollJson.video_url;
      break;
    }
    if (pollJson.status === 'failed') {
      throw new Error(
        `Higgsfield video failed: ${pollJson.error ?? 'unknown error'}`,
      );
    }
  }
  if (!videoUrl) {
    throw new Error(`Higgsfield video timed out after ${HIGGSFIELD_POLL_TIMEOUT_MS}ms.`);
  }

  return {
    publicUrl: videoUrl,
    posterUrl: '/_media/content-studio/mock/poster-9x16.jpg',
    mime: 'video/mp4',
    width: 1080,
    height: 1920,
    durationMs: durationSec * 1000,
    sizeBytes: 0,
    provider: 'higgsfield',
    model: input.model ?? 'hf-video-lite',
    usage: { mode: 'live', hfModel, jobId },
    estimatedCostCents: HIGGSFIELD_VIDEO_PRICING_CENTS[input.model ?? ''] ?? 1200,
  };
}

export function isFormatVideoCapable(format: ContentFormat): boolean {
  return MOCK_ASSETS[format] !== undefined;
}

async function generateMockStudioVideo(
  input: GenerateStudioVideoInput,
): Promise<GeneratedStudioVideo> {
  const asset = MOCK_ASSETS[input.format];
  if (!asset) {
    // ACT-BE-033 (BUG-067) : erreur MÉTIER (409) et non une 500 opaque quand
    // kind=video est forcé sur un format non-vidéo (post/carousel). Seuls reel
    // et story ont un asset mock ; isFormatVideoCapable() reflète ce contrat.
    throw new HttpError(
      'invalid_state',
      `La vidéo n'est pas disponible pour le format « ${input.format} ». Seuls les formats reel et story produisent une vidéo — choisis reel/story ou bascule en image.`,
    );
  }
  const model = input.model ?? env.CONTENT_STUDIO_VIDEO_MODEL;
  return {
    publicUrl: asset.publicUrl,
    posterUrl: asset.posterUrl,
    mime: 'video/mp4',
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    sizeBytes: 0,
    provider: 'mock',
    model,
    usage: {
      mode: 'mock',
      promptLength: input.prompt.length,
      format: input.format,
    },
    estimatedCostCents: 0,
  };
}
