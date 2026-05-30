import { join } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import type { MediaAsset } from '../types/media';
import { ProviderSelector } from '../providers/selector';
import type { ProviderConfig } from '../providers/types';
import { resolveApiKey } from '../services/api-key-manager';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const log = createLogger('node:generate-video');

const MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine');
const MEDIA_URL_PREFIX = '/_media/ai-engine';

interface SceneBlock {
  sceneNumber: number;
  description: string;
  textOverlay?: string;
  durationSeconds?: number;
}

function extractScenes(state: Record<string, unknown>): SceneBlock[] {
  const script = state.script as Record<string, unknown> | null;
  if (!script) return [{ sceneNumber: 1, description: 'FemiGlow', durationSeconds: 5 }];
  const scenes = (script.scenes as SceneBlock[]) ?? [];
  return scenes.length > 0 ? scenes : [{ sceneNumber: 1, description: 'FemiGlow', durationSeconds: 5 }];
}

function escapeFilterText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

async function generateMockVideo(
  scenes: SceneBlock[],
  width: number,
  height: number,
  jobId: string,
): Promise<{ filePath: string; fileName: string; durationSeconds: number }> {
  await mkdir(MEDIA_DIR, { recursive: true });

  const totalDuration = scenes.reduce((sum, s) => sum + (s.durationSeconds ?? 4), 0);
  const fileName = `video-${jobId}-${Date.now()}.mp4`;
  const filePath = join(MEDIA_DIR, fileName);

  const drawTextFilters: string[] = [];
  let elapsed = 0;
  for (const scene of scenes) {
    const dur = scene.durationSeconds ?? 4;
    const text = escapeFilterText(scene.textOverlay ?? scene.description).slice(0, 80);
    const enable = `between(t,${elapsed},${elapsed + dur})`;
    drawTextFilters.push(
      `drawtext=text='${text}':fontsize=32:fontcolor=0x2f2a26:x=(w-text_w)/2:y=(h-text_h)/2:enable='${enable}'`,
    );
    elapsed += dur;
  }

  const filterComplex = drawTextFilters.join(',');

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(`color=c=0xfbf7f1:s=${width}x${height}:d=${totalDuration}:r=24`)
      .inputFormat('lavfi')
      .input(`anullsrc=r=44100:cl=stereo`)
      .inputFormat('lavfi')
      .outputOptions([
        '-t', String(totalDuration),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-shortest',
      ]);

    if (filterComplex) {
      cmd.videoFilter(filterComplex);
    }

    cmd
      .save(filePath)
      .on('end', () => resolve({ filePath, fileName, durationSeconds: totalDuration }))
      .on('error', (err) => reject(err));
  });
}

export async function generateVideoNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  const format = state.format as string;

  log.info('Generating video', { jobId, node: 'generate_video', provider: config.providers.video.default });

  const startTime = Date.now();
  const scenes = extractScenes(state);
  const isVertical = ['reel', 'story', 'shorts'].includes(format);
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;

  const videos: MediaAsset[] = [];
  let costCents = 0;

  try {
    if (config.providers.video.default !== 'mock') {
      const providerType = config.providers.video.default;
      const apiKey = await resolveApiKey(providerType);

      if (apiKey) {
        try {
          const providerConfig: ProviderConfig = {
            id: `runtime-${providerType}`,
            type: providerType,
            name: providerType,
            apiKeyEnvVar: `AI_ENGINE_${providerType.toUpperCase()}_API_KEY`,
            capabilities: ['video'],
            models: [],
            rateLimitRpm: 60,
            dailyBudgetCents: config.budget.dailyCents,
            circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
            priority: 10,
            isFallback: false,
            isEnabled: true,
            healthStatus: 'healthy',
          };

          const selector = new ProviderSelector([providerConfig]);
          const adapter = selector.selectProvider('generate_video', 'video');
          const totalDuration = scenes.reduce((sum, s) => sum + (s.durationSeconds ?? 4), 0);

          const result = await adapter.generateVideo({
            model: 'higgsfield-video-v1',
            prompt: scenes.map(s => s.description).join('. '),
            durationSeconds: totalDuration,
            width,
            height,
          });

          videos.push({
            assetId: `${providerType}-video-${Date.now()}`,
            url: result.data.videoUrl,
            mimeType: 'video/mp4',
            width,
            height,
            durationMs: totalDuration * 1000,
            fileSizeBytes: 0,
            provider: providerType,
            generationParams: { scenes: scenes.length, totalDuration },
            costCents: result.costCents,
          });
          costCents += result.costCents;

          const durationMs = Date.now() - startTime;
          log.info('Video generated via provider', { jobId, node: 'generate_video', durationMs, costCents, data: { provider: providerType } });

          const prevCost = state.costTracking as Record<string, unknown> | undefined;
          const prevTotal = (prevCost?.totalCents as number) ?? 0;
          const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};

          return {
            videos,
            currentStep: 'generate_video',
            costTracking: {
              ...prevCost,
              totalCents: prevTotal + costCents,
              breakdown: { ...prevBreakdown, generate_video: costCents },
            },
          };
        } catch (providerErr) {
          log.warn('Provider video generation failed, falling back to mock', {
            jobId,
            node: 'generate_video',
            data: { provider: providerType, error: String(providerErr) },
          });
        }
      }
    }

    const result = await generateMockVideo(scenes, width, height, jobId);
    const fileStat = await stat(result.filePath).catch(() => null);

    videos.push({
      assetId: `mock-video-${Date.now()}`,
      url: `${MEDIA_URL_PREFIX}/${result.fileName}`,
      mimeType: 'video/mp4',
      width,
      height,
      durationMs: result.durationSeconds * 1000,
      fileSizeBytes: fileStat?.size ?? 0,
      provider: 'mock',
      generationParams: {
        scenes: scenes.length,
        totalDuration: result.durationSeconds,
        resolution: `${width}x${height}`,
      },
      costCents: 0,
    });
  } catch (err) {
    log.error('Video generation failed', {
      jobId,
      node: 'generate_video',
      data: { error: String(err) },
    });

    videos.push({
      assetId: `fallback-video-${Date.now()}`,
      url: '',
      mimeType: 'video/mp4',
      width,
      height,
      durationMs: 0,
      fileSizeBytes: 0,
      provider: 'fallback',
      generationParams: { error: String(err) },
      costCents: 0,
    });
  }

  const durationMs = Date.now() - startTime;
  log.info('Video generated', {
    jobId,
    node: 'generate_video',
    durationMs,
    costCents,
    data: { count: videos.length },
  });

  const prevCost = state.costTracking as Record<string, unknown> | undefined;
  const prevTotal = (prevCost?.totalCents as number) ?? 0;
  const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};

  // ACT-BE-015 : une vidéo vide (url='') ou en fallback est poussée dans
  // state.errors au lieu de passer pour un succès.
  const vids = videos as Array<{ url?: string; provider?: string; generationParams?: Record<string, unknown> }>;
  const degradedVid = vids.find((v) => !v?.url || v?.provider === 'fallback');

  return {
    videos,
    currentStep: 'generate_video',
    costTracking: {
      ...prevCost,
      totalCents: prevTotal + costCents,
      breakdown: { ...prevBreakdown, generate_video: costCents },
    },
    errors: degradedVid
      ? [
          {
            node: 'generate_video',
            errorType: degradedVid.url ? 'video_degraded' : 'video_empty',
            message: String(degradedVid.generationParams?.error ?? 'vidéo indisponible (fallback)'),
            timestamp: new Date().toISOString(),
            provider: 'fallback',
            retryable: true,
          },
        ]
      : [],
  };
}
