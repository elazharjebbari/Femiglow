/**
 * Server-side pipeline that takes a raw video upload + a trim range, runs
 * ffmpeg to extract the segment, generates a JPEG poster (frame at 50%),
 * persists both via the storage adapter, and creates a media DB row that
 * the v2 MediaPicker can consume.
 *
 * Constraints:
 *  - Max upload size : 200 MB.
 *  - Max kept duration : 90 s (Instagram Reels constraint).
 *  - Accepts: video/mp4, video/quicktime, video/webm.
 *  - Output: H.264 (libx264) + AAC, mp4 container — broadest compatibility.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createId } from '@/lib/ids';
import { createMedia } from '@/lib/db/queries/media';
import { getStorage } from '@/lib/media/storage';
import { HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import type { StudioV2MediaItem, VideoTrimRequest } from './types';

const MAX_BYTES = 200 * 1024 * 1024;
const MAX_DURATION_SEC = 90;
const ACCEPTED_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);
const FFMPEG_BIN = process.env.FFMPEG_PATH ?? 'ffmpeg';

interface FfmpegRunResult {
  stdout: string;
  stderr: string;
  code: number;
}

function runFfmpeg(args: string[], timeoutMs = 60_000): Promise<FfmpegRunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg timeout'));
    }, timeoutMs);
    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}

export async function uploadAndTrimVideo(input: {
  file: Buffer;
  filename: string;
  mime: string;
  trim: VideoTrimRequest;
  adminId: string | null;
}): Promise<StudioV2MediaItem> {
  if (input.file.byteLength > MAX_BYTES) {
    throw new HttpError('invalid_input', `Vidéo trop volumineuse (max ${Math.round(MAX_BYTES / 1024 / 1024)} Mo)`);
  }
  if (!ACCEPTED_MIME.has(input.mime)) {
    throw new HttpError('invalid_input', `Type vidéo non supporté (${input.mime})`);
  }
  const duration = input.trim.endSec - input.trim.startSec;
  if (duration <= 0) {
    throw new HttpError('invalid_input', 'La plage de découpe est vide.');
  }
  if (duration > MAX_DURATION_SEC) {
    throw new HttpError('invalid_input', `Durée trop longue (max ${MAX_DURATION_SEC}s)`);
  }

  const baseId = createId('mev2');
  const workDir = await mkdtemp(join(tmpdir(), `cs-v2-vid-${baseId}-`));
  const inputPath = join(workDir, 'input');
  const outputPath = join(workDir, 'output.mp4');
  const posterPath = join(workDir, 'poster.jpg');

  try {
    await writeFile(inputPath, input.file);

    // 1) Trim + re-encode to mp4 (H.264/AAC), strip metadata, ensure web-friendly.
    const trimRes = await runFfmpeg([
      '-y',
      '-ss', input.trim.startSec.toFixed(3),
      '-t', duration.toFixed(3),
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-map_metadata', '-1',
      outputPath,
    ], 90_000);
    if (trimRes.code !== 0) {
      logger.error('content_studio_v2.video.trim_failed', {
        ffmpeg_stderr: trimRes.stderr.slice(-2000),
        code: trimRes.code,
      });
      throw new HttpError('invalid_state', 'Échec de la découpe ffmpeg.');
    }

    // 2) Poster: extract frame at 0.5s into the trimmed segment.
    const posterRes = await runFfmpeg([
      '-y',
      '-ss', '0.5',
      '-i', outputPath,
      '-frames:v', '1',
      '-q:v', '4',
      posterPath,
    ], 30_000);
    if (posterRes.code !== 0) {
      logger.warn('content_studio_v2.video.poster_failed', { code: posterRes.code });
      // Non-fatal: we ship without a poster.
    }

    const [trimmedBuf, posterBuf] = await Promise.all([
      readFile(outputPath),
      readFile(posterPath).catch(() => null),
    ]);

    // 3) Persist.
    const storage = getStorage();
    const originalKey = `content-studio-v2/${baseId}/original-source`;
    const trimmedKey = `content-studio-v2/${baseId}/trimmed.mp4`;
    const posterKey = `content-studio-v2/${baseId}/poster.jpg`;

    const [, trimmed, poster] = await Promise.all([
      storage.put({ key: originalKey, body: input.file, contentType: input.mime }),
      storage.put({ key: trimmedKey, body: trimmedBuf, contentType: 'video/mp4' }),
      posterBuf ? storage.put({ key: posterKey, body: posterBuf, contentType: 'image/jpeg' }) : Promise.resolve(null),
    ]);

    const slug = `cs-v2-vid-${baseId.slice(-8)}`;
    const media = await createMedia({
      kind: 'video',
      source: 'upload',
      slug,
      alt: input.trim.alt,
      caption: null,
      credit: null,
      originalFilename: input.filename,
      originalMime: 'video/mp4',
      originalSizeBytes: trimmedBuf.byteLength,
      originalUrl: trimmed.url,
      originalDurationMs: Math.round(duration * 1000),
      qualityProfile: 'inline',
      loadingStrategy: 'viewport',
      status: 'ready',
      isHero: false,
      overrides: {
        contentStudio: {
          origin: 'imported',
          v2: {
            previewUrl: trimmed.url,
            thumbnailUrl: poster?.url ?? null,
            trim: { startSec: input.trim.startSec, endSec: input.trim.endSec },
          },
        },
      },
      createdBy: input.adminId,
    });

    logger.info('content_studio_v2.video.uploaded', {
      media_id: media.id,
      duration_sec: Math.round(duration),
      bytes: trimmedBuf.byteLength,
    });

    return {
      id: media.id,
      kind: 'video',
      compartment: 'imported',
      alt: input.trim.alt,
      slug,
      thumbnailUrl: poster?.url ?? null,
      previewUrl: trimmed.url,
      originalUrl: trimmed.url,
      durationSec: duration,
      createdAt: media.createdAt.toISOString(),
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
