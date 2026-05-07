import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import type { VariantFormat } from '@/lib/db/types';
import { getStorage } from '@/lib/media/storage';
import type { StorageAdapter } from '@/lib/media/storage';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export interface OptimizeVideoInput {
  mediaId: string;
  buffer: Buffer;
}

export interface VideoArtifact {
  format: VariantFormat;
  sizeBytes: number;
  url: string;
  storageKey: string;
  checksum: string;
  width?: number;
  height?: number;
  bitrateKbps?: number;
}

export interface OptimizeVideoResult {
  durationMs: number;
  width: number;
  height: number;
  posterArtifact: VideoArtifact;
  variants: VideoArtifact[];
}

function checksumOf(buffer: Buffer): string {
  return `sha256-${createHash('sha256').update(buffer).digest('hex')}`;
}

async function probe(input: string): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams.find((s) => s.codec_type === 'video');
      const duration = data.format.duration ?? 0;
      resolve({
        width: stream?.width ?? 0,
        height: stream?.height ?? 0,
        durationMs: Math.round(duration * 1000),
      });
    });
  });
}

async function transcode(
  input: string,
  output: string,
  options: { codec: 'libx264' | 'libvpx-vp9'; format: 'mp4' | 'webm' },
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec(options.codec)
      .audioCodec(options.codec === 'libx264' ? 'aac' : 'libopus')
      .outputOptions(['-movflags', '+faststart', '-crf', '28', '-preset', 'fast'])
      .toFormat(options.format)
      .save(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

async function extractPoster(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .seekInput('00:00:01')
      .frames(1)
      .save(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

export async function optimizeVideo(
  input: OptimizeVideoInput,
  storage: StorageAdapter = getStorage(),
): Promise<OptimizeVideoResult> {
  const work = await mkdtemp(join(tmpdir(), 'fgvideo-'));
  try {
    const sourcePath = join(work, 'source');
    await writeFile(sourcePath, input.buffer);
    const meta = await probe(sourcePath);

    const mp4Path = join(work, 'out.mp4');
    const webmPath = join(work, 'out.webm');
    const posterRaw = join(work, 'poster.png');

    await transcode(sourcePath, mp4Path, { codec: 'libx264', format: 'mp4' });
    await transcode(sourcePath, webmPath, { codec: 'libvpx-vp9', format: 'webm' });
    await extractPoster(sourcePath, posterRaw);

    const [mp4Buf, webmBuf, posterBuf] = await Promise.all([
      readFile(mp4Path),
      readFile(webmPath),
      sharp(await readFile(posterRaw)).webp({ quality: 80 }).toBuffer(),
    ]);

    const mp4Key = `media/${input.mediaId}/mp4/master.mp4`;
    const webmKey = `media/${input.mediaId}/webm/master.webm`;
    const posterKey = `media/${input.mediaId}/poster/master.webp`;

    const [mp4Put, webmPut, posterPut] = await Promise.all([
      storage.put({ key: mp4Key, body: mp4Buf, contentType: 'video/mp4' }),
      storage.put({ key: webmKey, body: webmBuf, contentType: 'video/webm' }),
      storage.put({ key: posterKey, body: posterBuf, contentType: 'image/webp' }),
    ]);

    return {
      durationMs: meta.durationMs,
      width: meta.width,
      height: meta.height,
      posterArtifact: {
        format: 'poster',
        sizeBytes: posterBuf.byteLength,
        url: posterPut.url,
        storageKey: posterKey,
        checksum: checksumOf(posterBuf),
      },
      variants: [
        {
          format: 'mp4',
          sizeBytes: mp4Buf.byteLength,
          url: mp4Put.url,
          storageKey: mp4Key,
          checksum: checksumOf(mp4Buf),
          width: meta.width,
          height: meta.height,
        },
        {
          format: 'webm',
          sizeBytes: webmBuf.byteLength,
          url: webmPut.url,
          storageKey: webmKey,
          checksum: checksumOf(webmBuf),
          width: meta.width,
          height: meta.height,
        },
      ],
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export async function extractPosterFromVideo(buffer: Buffer): Promise<Buffer> {
  const work = await mkdtemp(join(tmpdir(), 'fgposter-'));
  try {
    const src = join(work, 'src');
    const png = join(work, 'frame.png');
    await mkdir(work, { recursive: true });
    await writeFile(src, buffer);
    await extractPoster(src, png);
    return readFile(png);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
