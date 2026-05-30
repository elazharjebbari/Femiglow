import { join } from 'node:path';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import type { MediaAsset } from '../types/media';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const log = createLogger('node:generate-voiceover');

const MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine');
const MEDIA_URL_PREFIX = '/_media/ai-engine';

function buildVoiceoverText(state: Record<string, unknown>): string {
  const script = state.script as Record<string, unknown> | null;
  if (!script) return 'Le rituel FemiGlow.';

  const hook = (script.hook as string) ?? '';
  const scenes = (script.scenes as Array<Record<string, unknown>>) ?? [];
  const descriptions = scenes
    .map((s) => (s.narration as string) ?? (s.description as string) ?? '')
    .filter(Boolean);

  return [hook, ...descriptions].join('. ');
}

function estimateDurationSeconds(text: string): number {
  const wordsPerSecond = 2.5;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(wordCount / wordsPerSecond));
}

async function generateSilentAudio(
  durationSeconds: number,
  jobId: string,
): Promise<{ filePath: string; fileName: string }> {
  await mkdir(MEDIA_DIR, { recursive: true });

  const fileName = `voiceover-${jobId}-${Date.now()}.wav`;
  const filePath = join(MEDIA_DIR, fileName);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`anullsrc=r=44100:cl=mono`)
      .inputFormat('lavfi')
      .outputOptions(['-t', String(durationSeconds), '-c:a', 'pcm_s16le'])
      .save(filePath)
      .on('end', () => resolve({ filePath, fileName }))
      .on('error', (err) => reject(err));
  });
}

async function generateOpenAITTS(
  text: string,
  apiKey: string,
  jobId: string,
): Promise<{ filePath: string; fileName: string; costCents: number }> {
  await mkdir(MEDIA_DIR, { recursive: true });

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text.slice(0, 4096),
      voice: 'nova',
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `${res.status}`);
    throw new Error(`OpenAI TTS failed: ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName = `voiceover-${jobId}-${Date.now()}.mp3`;
  const filePath = join(MEDIA_DIR, fileName);
  await writeFile(filePath, buffer);

  const charCount = text.slice(0, 4096).length;
  const costCents = (charCount / 1_000_000) * 1500;

  return { filePath, fileName, costCents };
}

async function generateElevenLabsTTS(
  text: string,
  apiKey: string,
  jobId: string,
): Promise<{ filePath: string; fileName: string; costCents: number }> {
  await mkdir(MEDIA_DIR, { recursive: true });

  const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // "Bella" default voice

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text.slice(0, 5000),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `${res.status}`);
    throw new Error(`ElevenLabs TTS failed: ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName = `voiceover-${jobId}-${Date.now()}.mp3`;
  const filePath = join(MEDIA_DIR, fileName);
  await writeFile(filePath, buffer);

  const charCount = text.slice(0, 5000).length;
  const costCents = (charCount / 1000) * 3;

  return { filePath, fileName, costCents };
}

export async function generateVoiceoverNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();

  log.info('Generating voiceover', { jobId, node: 'generate_voiceover', provider: config.providers.tts.default });

  const startTime = Date.now();
  const text = buildVoiceoverText(state);
  const estimatedDuration = estimateDurationSeconds(text);

  let voiceover: MediaAsset;
  let costCents = 0;

  try {
    if (config.providers.tts.default === 'openai' && config.apiKeys.openai) {
      const result = await generateOpenAITTS(text, config.apiKeys.openai, jobId);
      const fileStat = await stat(result.filePath).catch(() => null);
      costCents = result.costCents;

      voiceover = {
        assetId: `openai-vo-${Date.now()}`,
        url: `${MEDIA_URL_PREFIX}/${result.fileName}`,
        mimeType: 'audio/mpeg',
        durationMs: estimatedDuration * 1000,
        fileSizeBytes: fileStat?.size ?? 0,
        provider: 'openai:tts-1',
        generationParams: { textLength: text.length, voice: 'nova' },
        costCents,
      };
    } else if (config.providers.tts.default === 'elevenlabs' && config.apiKeys.elevenlabs) {
      const result = await generateElevenLabsTTS(text, config.apiKeys.elevenlabs, jobId);
      const fileStat = await stat(result.filePath).catch(() => null);
      costCents = result.costCents;

      voiceover = {
        assetId: `elevenlabs-vo-${Date.now()}`,
        url: `${MEDIA_URL_PREFIX}/${result.fileName}`,
        mimeType: 'audio/mpeg',
        durationMs: estimatedDuration * 1000,
        fileSizeBytes: fileStat?.size ?? 0,
        provider: 'elevenlabs:eleven_multilingual_v2',
        generationParams: { textLength: text.length },
        costCents,
      };
    } else {
      const result = await generateSilentAudio(estimatedDuration, jobId);
      const fileStat = await stat(result.filePath).catch(() => null);

      voiceover = {
        assetId: `mock-vo-${Date.now()}`,
        url: `${MEDIA_URL_PREFIX}/${result.fileName}`,
        mimeType: 'audio/wav',
        durationMs: estimatedDuration * 1000,
        fileSizeBytes: fileStat?.size ?? 0,
        provider: 'mock',
        generationParams: { textLength: text.length, silent: true },
        costCents: 0,
      };
    }
  } catch (err) {
    log.warn('TTS failed, generating silent fallback', {
      jobId,
      node: 'generate_voiceover',
      data: { error: String(err) },
    });

    try {
      const result = await generateSilentAudio(estimatedDuration, jobId);
      const fileStat = await stat(result.filePath).catch(() => null);

      voiceover = {
        assetId: `fallback-vo-${Date.now()}`,
        url: `${MEDIA_URL_PREFIX}/${result.fileName}`,
        mimeType: 'audio/wav',
        durationMs: estimatedDuration * 1000,
        fileSizeBytes: fileStat?.size ?? 0,
        provider: 'fallback',
        generationParams: { error: String(err), silent: true },
        costCents: 0,
      };
    } catch (ffmpegErr) {
      log.error('Silent audio fallback also failed', {
        jobId,
        node: 'generate_voiceover',
        data: { error: String(ffmpegErr) },
      });

      voiceover = {
        assetId: `empty-vo-${Date.now()}`,
        url: '',
        mimeType: 'audio/wav',
        durationMs: 0,
        fileSizeBytes: 0,
        provider: 'fallback',
        generationParams: { error: String(ffmpegErr) },
        costCents: 0,
      };
    }
  }

  const durationMs = Date.now() - startTime;
  log.info('Voiceover generated', {
    jobId,
    node: 'generate_voiceover',
    durationMs,
    costCents,
  });

  const prevCost = state.costTracking as Record<string, unknown> | undefined;
  const prevTotal = (prevCost?.totalCents as number) ?? 0;
  const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};

  // ACT-BE-015 (BUG-049) : une voix-off vide (url='') ou dégradée (fallback
  // silencieux) est poussée dans state.errors au lieu de passer pour un succès.
  const vo = voiceover as { url?: string; provider?: string; generationParams?: Record<string, unknown> };
  const voiceoverDegraded = !vo.url || vo.provider === 'fallback';

  return {
    voiceover,
    voiceoverScript: text,
    currentStep: 'generate_voiceover',
    costTracking: {
      ...prevCost,
      totalCents: prevTotal + costCents,
      breakdown: { ...prevBreakdown, generate_voiceover: costCents },
    },
    errors: voiceoverDegraded
      ? [
          {
            node: 'generate_voiceover',
            errorType: vo.url ? 'voiceover_degraded' : 'voiceover_empty',
            message: String(vo.generationParams?.error ?? 'voix-off indisponible (fallback)'),
            timestamp: new Date().toISOString(),
            provider: 'fallback',
            retryable: true,
          },
        ]
      : [],
  };
}
