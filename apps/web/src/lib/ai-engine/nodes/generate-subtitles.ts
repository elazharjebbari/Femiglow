import { join } from 'node:path';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:generate-subtitles');

const MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine');

interface SceneBlock {
  sceneNumber: number;
  description: string;
  narration?: string;
  onScreenText?: string;
  textOverlay?: string;
  durationSeconds?: number;
}

function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.round((totalSeconds % 1) * 1000);

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + ',' + String(millis).padStart(3, '0');
}

function generateSRT(scenes: SceneBlock[], hook: string): string {
  const entries: string[] = [];
  let elapsed = 0;
  let index = 1;

  if (hook) {
    const hookDuration = Math.min(3, scenes[0]?.durationSeconds ?? 3);
    entries.push(
      `${index}`,
      `${formatTimestamp(elapsed)} --> ${formatTimestamp(elapsed + hookDuration)}`,
      hook,
      '',
    );
    elapsed += hookDuration;
    index++;
  }

  for (const scene of scenes) {
    const duration = scene.durationSeconds ?? 4;
    const text = scene.narration ?? scene.onScreenText ?? scene.textOverlay ?? scene.description;
    if (!text) continue;

    const subtitleText = text.length > 120 ? text.slice(0, 117) + '...' : text;

    entries.push(
      `${index}`,
      `${formatTimestamp(elapsed)} --> ${formatTimestamp(elapsed + duration)}`,
      subtitleText,
      '',
    );

    elapsed += duration;
    index++;
  }

  return entries.join('\n');
}

export async function generateSubtitlesNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  void config;

  log.info('Generating subtitles', { jobId, node: 'generate_subtitles' });

  const startTime = Date.now();
  const script = state.script as Record<string, unknown> | null;
  const scenes = (script?.scenes as SceneBlock[]) ?? [];
  const hook = (script?.hook as string) ?? '';

  let subtitles: string;

  try {
    subtitles = generateSRT(scenes, hook);

    if (subtitles.trim()) {
      await mkdir(MEDIA_DIR, { recursive: true });
      const fileName = `subtitles-${jobId}-${Date.now()}.srt`;
      const filePath = join(MEDIA_DIR, fileName);
      await writeFile(filePath, subtitles, 'utf-8');
      await stat(filePath);
    }
  } catch (err) {
    log.warn('Subtitle generation failed, using empty subtitles', {
      jobId,
      node: 'generate_subtitles',
      data: { error: String(err) },
    });
    subtitles = '';
  }

  const durationMs = Date.now() - startTime;
  log.info('Subtitles generated', {
    jobId,
    node: 'generate_subtitles',
    durationMs,
    data: { entryCount: subtitles.split('\n\n').filter(Boolean).length },
  });

  return {
    subtitles,
    currentStep: 'generate_subtitles',
  };
}
