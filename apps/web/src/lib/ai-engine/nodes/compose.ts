import { join } from 'node:path';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import { PLATFORM_SPECS } from '../types/platform-specs';
import type { MediaAsset } from '../types/media';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const log = createLogger('node:compose');

const MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine');
const MEDIA_URL_PREFIX = '/_media/ai-engine';

const VIDEO_FORMATS = new Set(['reel', 'story', 'shorts', 'video']);
const IMAGE_FORMATS = new Set(['post', 'carousel', 'pin', 'feed']);

function lookupPlatformSpec(
  platform: string,
  format: string,
): { width: number; height: number } {
  const platformSpecs = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
  if (platformSpecs) {
    const formatSpec = (platformSpecs as Record<string, { width: number; height: number }>)[format];
    if (formatSpec) return { width: formatSpec.width, height: formatSpec.height };
  }
  return { width: 1080, height: 1080 };
}

async function composeVideo(
  state: Record<string, unknown>,
  jobId: string,
): Promise<MediaAsset> {
  await mkdir(MEDIA_DIR, { recursive: true });

  const videos = (state.videos as MediaAsset[]) ?? [];
  const voiceover = state.voiceover as MediaAsset | null;
  const music = state.music as MediaAsset | null;
  const subtitles = state.subtitles as string | null;

  const primaryVideo = videos[0];
  if (!primaryVideo?.url) {
    return createEmptyAsset(jobId, 'video/mp4', 'No video source available');
  }

  const videoPath = join(MEDIA_DIR, primaryVideo.url.replace(MEDIA_URL_PREFIX + '/', ''));
  const fileName = `composed-${jobId}-${Date.now()}.mp4`;
  const outputPath = join(MEDIA_DIR, fileName);

  const hasVoiceover = voiceover?.url && voiceover.url.length > 0;
  const hasMusic = music?.url && music.url.length > 0;

  if (!hasVoiceover && !hasMusic) {
    const videoBuffer = await readFile(videoPath).catch(() => null);
    if (videoBuffer) {
      await writeFile(outputPath, videoBuffer);
      const fileStat = await stat(outputPath).catch(() => null);

      return {
        assetId: `composed-${Date.now()}`,
        url: `${MEDIA_URL_PREFIX}/${fileName}`,
        mimeType: 'video/mp4',
        width: primaryVideo.width,
        height: primaryVideo.height,
        durationMs: primaryVideo.durationMs,
        fileSizeBytes: fileStat?.size ?? 0,
        provider: 'compose',
        generationParams: {
          hasSubtitles: Boolean(subtitles),
          audioTracks: 0,
        },
        costCents: 0,
      };
    }
  }

  const inputs: string[] = [videoPath];
  if (hasVoiceover) {
    inputs.push(join(MEDIA_DIR, voiceover!.url.replace(MEDIA_URL_PREFIX + '/', '')));
  }
  if (hasMusic) {
    inputs.push(join(MEDIA_DIR, music!.url.replace(MEDIA_URL_PREFIX + '/', '')));
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    for (const input of inputs) {
      cmd.input(input);
    }

    const filterParts: string[] = [];
    let audioIndex = 1;

    if (hasVoiceover && hasMusic) {
      filterParts.push(`[${audioIndex}:a]volume=1.0[vo]`);
      audioIndex++;
      filterParts.push(`[${audioIndex}:a]volume=0.3[bg]`);
      filterParts.push(`[vo][bg]amix=inputs=2:duration=longest[aout]`);
    } else if (hasVoiceover) {
      filterParts.push(`[${audioIndex}:a]volume=1.0[aout]`);
    } else if (hasMusic) {
      filterParts.push(`[${audioIndex}:a]volume=0.5[aout]`);
    }

    if (filterParts.length > 0) {
      cmd.complexFilter(filterParts.join(';'));
      cmd.outputOptions(['-map', '0:v', '-map', '[aout]']);
    }

    cmd
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-shortest',
      ])
      .save(outputPath)
      .on('end', async () => {
        const fileStat = await stat(outputPath).catch(() => null);
        resolve({
          assetId: `composed-${Date.now()}`,
          url: `${MEDIA_URL_PREFIX}/${fileName}`,
          mimeType: 'video/mp4',
          width: primaryVideo.width,
          height: primaryVideo.height,
          durationMs: primaryVideo.durationMs,
          fileSizeBytes: fileStat?.size ?? 0,
          provider: 'compose',
          generationParams: {
            hasVoiceover: hasVoiceover,
            hasMusic: hasMusic,
            hasSubtitles: Boolean(subtitles),
          },
          costCents: 0,
        });
      })
      .on('error', (err) => reject(err));
  });
}

async function composeImage(
  state: Record<string, unknown>,
  jobId: string,
): Promise<MediaAsset> {
  await mkdir(MEDIA_DIR, { recursive: true });

  const images = (state.images as MediaAsset[]) ?? [];
  const caption = (state.caption as string) ?? '';
  const platform = state.platform as string;
  const format = state.format as string;
  const spec = lookupPlatformSpec(platform, format);

  if (images.length === 0) {
    return createMockImageComposition(jobId, spec.width, spec.height, caption);
  }

  const primaryImage = images[0]!;

  if (primaryImage.provider === 'mock' || !primaryImage.url) {
    return createMockImageComposition(jobId, spec.width, spec.height, caption);
  }

  const imagePath = join(MEDIA_DIR, primaryImage.url.replace(MEDIA_URL_PREFIX + '/', ''));
  const imageBuffer = await readFile(imagePath).catch(() => null);

  if (!imageBuffer) {
    return createMockImageComposition(jobId, spec.width, spec.height, caption);
  }

  const fileName = `composed-${jobId}-${Date.now()}.jpg`;
  const outputPath = join(MEDIA_DIR, fileName);

  const composed = await sharp(imageBuffer)
    .resize(spec.width, spec.height, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer();

  await writeFile(outputPath, composed);

  return {
    assetId: `composed-img-${Date.now()}`,
    url: `${MEDIA_URL_PREFIX}/${fileName}`,
    mimeType: 'image/jpeg',
    width: spec.width,
    height: spec.height,
    fileSizeBytes: composed.byteLength,
    provider: 'compose',
    generationParams: {
      sourceProvider: primaryImage.provider,
      resized: true,
    },
    costCents: 0,
  };
}

async function createMockImageComposition(
  jobId: string,
  width: number,
  height: number,
  caption: string,
): Promise<MediaAsset> {
  const displayText = caption.split('\n')[0]?.slice(0, 60) ?? 'FemiGlow';

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#fbf7f1"/>
        <stop offset="1" stop-color="#e8efe5"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <text x="50%" y="45%" text-anchor="middle" font-family="serif" font-size="36" fill="#2f2a26" opacity="0.8">${escapeXml(displayText)}</text>
    <text x="50%" y="55%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#8f3f4a" opacity="0.6">FemiGlow</text>
  </svg>`;

  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  const fileName = `composed-${jobId}-${Date.now()}.jpg`;
  const filePath = join(MEDIA_DIR, fileName);
  await writeFile(filePath, buffer);

  return {
    assetId: `composed-mock-${Date.now()}`,
    url: `${MEDIA_URL_PREFIX}/${fileName}`,
    mimeType: 'image/jpeg',
    width,
    height,
    fileSizeBytes: buffer.byteLength,
    provider: 'compose:mock',
    generationParams: { mock: true },
    costCents: 0,
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createEmptyAsset(jobId: string, mimeType: string, reason: string): MediaAsset {
  return {
    assetId: `empty-${Date.now()}`,
    url: '',
    mimeType,
    fileSizeBytes: 0,
    provider: 'compose:empty',
    generationParams: { reason },
    costCents: 0,
  };
}

export async function composeNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const format = state.format as string;
  const config = getEngineConfig();
  void config;

  log.info('Composing final output', { jobId, node: 'compose', data: { format } });

  const startTime = Date.now();
  let composition: MediaAsset;

  try {
    if (VIDEO_FORMATS.has(format)) {
      composition = await composeVideo(state, jobId);
    } else if (IMAGE_FORMATS.has(format)) {
      composition = await composeImage(state, jobId);
    } else {
      composition = {
        assetId: `text-${Date.now()}`,
        url: '',
        mimeType: 'text/plain',
        fileSizeBytes: 0,
        provider: 'compose:text-only',
        generationParams: { format },
        costCents: 0,
      };
    }
  } catch (err) {
    log.error('Composition failed', {
      jobId,
      node: 'compose',
      data: { error: String(err) },
    });
    composition = createEmptyAsset(jobId, 'application/octet-stream', String(err));
  }

  const durationMs = Date.now() - startTime;
  log.info('Composition complete', {
    jobId,
    node: 'compose',
    durationMs,
    data: { provider: composition.provider },
  });

  // ACT-BE-015 : une composition vide (échec → createEmptyAsset) ou en fallback
  // est poussée dans state.errors au lieu de passer pour un succès.
  const comp = composition as { url?: string; provider?: string; generationParams?: Record<string, unknown> };
  const composeDegraded = !comp.url || comp.provider === 'fallback';

  return {
    composition,
    currentStep: 'compose',
    errors: composeDegraded
      ? [
          {
            node: 'compose',
            errorType: comp.url ? 'compose_degraded' : 'compose_empty',
            message: String(comp.generationParams?.error ?? 'composition indisponible'),
            timestamp: new Date().toISOString(),
            provider: comp.provider ?? 'compose',
            retryable: true,
          },
        ]
      : [],
  };
}
