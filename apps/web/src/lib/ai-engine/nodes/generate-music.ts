import { join } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import type { MediaAsset } from '../types/media';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const log = createLogger('node:generate-music');

const MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine');
const MEDIA_URL_PREFIX = '/_media/ai-engine';

function getTargetDuration(state: Record<string, unknown>): number {
  const script = state.script as Record<string, unknown> | null;
  if (script?.estimatedDurationSeconds) {
    return script.estimatedDurationSeconds as number;
  }

  const voiceover = state.voiceover as Record<string, unknown> | null;
  if (voiceover?.durationMs) {
    return Math.ceil((voiceover.durationMs as number) / 1000);
  }

  return 15;
}

async function generateSilentTrack(
  durationSeconds: number,
  jobId: string,
): Promise<{ filePath: string; fileName: string }> {
  await mkdir(MEDIA_DIR, { recursive: true });

  const fileName = `music-${jobId}-${Date.now()}.wav`;
  const filePath = join(MEDIA_DIR, fileName);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`anullsrc=r=44100:cl=stereo`)
      .inputFormat('lavfi')
      .outputOptions(['-t', String(durationSeconds), '-c:a', 'pcm_s16le'])
      .save(filePath)
      .on('end', () => resolve({ filePath, fileName }))
      .on('error', (err) => reject(err));
  });
}

export async function generateMusicNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  const script = state.script as Record<string, unknown> | null;
  const musicMood = (script?.musicMood as string) ?? 'calm';

  log.info('Generating music', { jobId, node: 'generate_music', data: { mood: musicMood } });

  const startTime = Date.now();
  const targetDuration = getTargetDuration(state);

  let music: MediaAsset;
  const costCents = 0;

  try {
    const result = await generateSilentTrack(targetDuration, jobId);
    const fileStat = await stat(result.filePath).catch(() => null);

    music = {
      assetId: `mock-music-${Date.now()}`,
      url: `${MEDIA_URL_PREFIX}/${result.fileName}`,
      mimeType: 'audio/wav',
      durationMs: targetDuration * 1000,
      fileSizeBytes: fileStat?.size ?? 0,
      provider: 'mock',
      generationParams: { mood: musicMood, durationSeconds: targetDuration },
      costCents: 0,
    };
  } catch (err) {
    log.error('Music generation failed', {
      jobId,
      node: 'generate_music',
      data: { error: String(err) },
    });

    music = {
      assetId: `fallback-music-${Date.now()}`,
      url: '',
      mimeType: 'audio/wav',
      durationMs: 0,
      fileSizeBytes: 0,
      provider: 'fallback',
      generationParams: { error: String(err) },
      costCents: 0,
    };
  }

  const durationMs = Date.now() - startTime;
  log.info('Music generated', {
    jobId,
    node: 'generate_music',
    durationMs,
    costCents,
    data: { mood: musicMood, trackDuration: targetDuration },
  });

  const prevCost = state.costTracking as Record<string, unknown> | undefined;
  const prevTotal = (prevCost?.totalCents as number) ?? 0;
  const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};

  void config;

  // ACT-BE-015 (BUG-050) : musique vide/fallback poussée dans state.errors.
  const mu = music as { url?: string; provider?: string; generationParams?: Record<string, unknown> };
  const musicDegraded = !mu.url || mu.provider === 'fallback';

  return {
    music,
    currentStep: 'generate_music',
    costTracking: {
      ...prevCost,
      totalCents: prevTotal + costCents,
      breakdown: { ...prevBreakdown, generate_music: costCents },
    },
    errors: musicDegraded
      ? [
          {
            node: 'generate_music',
            errorType: mu.url ? 'music_degraded' : 'music_empty',
            message: String(mu.generationParams?.error ?? 'musique indisponible (fallback)'),
            timestamp: new Date().toISOString(),
            provider: 'fallback',
            retryable: true,
          },
        ]
      : [],
  };
}
