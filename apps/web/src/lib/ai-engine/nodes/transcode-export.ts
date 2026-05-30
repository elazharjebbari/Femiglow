import { join } from 'node:path';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import { PLATFORM_SPECS } from '../types/platform-specs';
import type { MediaAsset } from '../types/media';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const log = createLogger('node:transcode-export');

const MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine');
const MEDIA_URL_PREFIX = '/_media/ai-engine';

const VIDEO_FORMATS = new Set(['reel', 'story', 'shorts', 'video']);

function lookupSpec(
  platform: string,
  format: string,
): { width: number; height: number; codec?: string; maxFileSizeMb: number } {
  const platformSpecs = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
  if (platformSpecs) {
    const formatSpec = (platformSpecs as Record<string, { width: number; height: number; codec?: string; maxFileSizeMb: number }>)[format];
    if (formatSpec) return formatSpec;
  }
  return { width: 1080, height: 1080, maxFileSizeMb: 30 };
}

async function transcodeVideo(
  sourcePath: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size(`${width}x${height}`)
      .outputOptions([
        '-preset', 'fast',
        '-crf', '23',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

async function extractThumbnail(
  sourcePath: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .seekInput('00:00:01')
      .frames(1)
      .size(`${width}x${height}`)
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

async function transcodeImage(
  sourceBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(sourceBuffer)
    .resize(width, height, { fit: 'cover' })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}

export async function transcodeExportNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const platform = state.platform as string;
  const format = state.format as string;
  const config = getEngineConfig();
  void config;

  log.info('Transcoding and exporting', { jobId, node: 'transcode_export', data: { platform, format } });

  const startTime = Date.now();
  const spec = lookupSpec(platform, format);
  const composition = state.composition as MediaAsset | null;
  const exports: Record<string, MediaAsset> = {};
  const thumbnails: MediaAsset[] = [];
  // ACT-BE-032 (BUG-058) : on retient la raison d'un échec transcode pour ne
  // PAS le masquer derrière un passthrough silencieux (asset non transcodé
  // servi comme un succès). Le fallback est marqué `degraded` + raison.
  let transcodeError: string | null = null;

  await mkdir(MEDIA_DIR, { recursive: true });

  try {
    if (VIDEO_FORMATS.has(format) && composition?.url) {
      const sourcePath = join(MEDIA_DIR, composition.url.replace(MEDIA_URL_PREFIX + '/', ''));

      const exportFileName = `export-${platform}-${format}-${jobId}-${Date.now()}.mp4`;
      const exportPath = join(MEDIA_DIR, exportFileName);
      await transcodeVideo(sourcePath, exportPath, spec.width, spec.height);
      const exportStat = await stat(exportPath).catch(() => null);

      exports[`${platform}_${format}`] = {
        assetId: `export-${Date.now()}`,
        url: `${MEDIA_URL_PREFIX}/${exportFileName}`,
        mimeType: 'video/mp4',
        width: spec.width,
        height: spec.height,
        durationMs: composition.durationMs,
        fileSizeBytes: exportStat?.size ?? 0,
        provider: 'transcode',
        generationParams: {
          codec: 'h264',
          platform,
          format,
        },
        costCents: 0,
      };

      const thumbFileName = `thumb-${jobId}-${Date.now()}.jpg`;
      const thumbPath = join(MEDIA_DIR, thumbFileName);
      try {
        await extractThumbnail(sourcePath, thumbPath, spec.width, spec.height);
        const thumbStat = await stat(thumbPath).catch(() => null);

        thumbnails.push({
          assetId: `thumb-${Date.now()}`,
          url: `${MEDIA_URL_PREFIX}/${thumbFileName}`,
          mimeType: 'image/jpeg',
          width: spec.width,
          height: spec.height,
          fileSizeBytes: thumbStat?.size ?? 0,
          provider: 'transcode',
          generationParams: { type: 'thumbnail', source: 'video' },
          costCents: 0,
        });
      } catch (thumbErr) {
        log.warn('Thumbnail extraction failed', {
          jobId,
          node: 'transcode_export',
          data: { error: String(thumbErr) },
        });
      }
    } else if (composition?.url) {
      const sourcePath = join(MEDIA_DIR, composition.url.replace(MEDIA_URL_PREFIX + '/', ''));
      const sourceBuffer = await readFile(sourcePath).catch(() => null);

      if (sourceBuffer) {
        const exportFileName = `export-${platform}-${format}-${jobId}-${Date.now()}.jpg`;
        const exportPath = join(MEDIA_DIR, exportFileName);
        const exported = await transcodeImage(sourceBuffer, spec.width, spec.height);
        await writeFile(exportPath, exported);

        exports[`${platform}_${format}`] = {
          assetId: `export-img-${Date.now()}`,
          url: `${MEDIA_URL_PREFIX}/${exportFileName}`,
          mimeType: 'image/jpeg',
          width: spec.width,
          height: spec.height,
          fileSizeBytes: exported.byteLength,
          provider: 'transcode',
          generationParams: { platform, format },
          costCents: 0,
        };
      }
    }
  } catch (err) {
    transcodeError = String(err);
    log.error('Transcode/export failed', {
      jobId,
      node: 'transcode_export',
      data: { error: transcodeError },
    });
  }

  if (Object.keys(exports).length === 0 && composition) {
    // Fallback : on conserve la composition pour ne pas tout perdre, MAIS on la
    // marque explicitement DÉGRADÉE (échec transcode) au lieu d'un passthrough
    // muet qui passerait pour un export conforme (ACT-BE-032).
    exports[`${platform}_${format}`] = {
      ...composition,
      assetId: `passthrough-${Date.now()}`,
      generationParams: {
        ...composition.generationParams,
        passthrough: true,
        degraded: true,
        degradedReason: transcodeError ?? 'transcode/export échoué (asset non transcodé)',
      },
    };
  }

  const durationMs = Date.now() - startTime;
  log.info('Transcode/export complete', {
    jobId,
    node: 'transcode_export',
    durationMs,
    data: { exportCount: Object.keys(exports).length, thumbnailCount: thumbnails.length },
  });

  return {
    exports,
    thumbnails,
    currentStep: 'transcode_export',
    // ACT-BE-032 : signale au graphe qu'un export a dû être servi en dégradé.
    transcodeDegraded: transcodeError !== null,
  };
}
