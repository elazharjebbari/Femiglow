import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { parseBuffer } from 'music-metadata';
import type { VariantFormat } from '@/lib/db/types';
import { getStorage } from '@/lib/media/storage';
import type { StorageAdapter } from '@/lib/media/storage';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export interface OptimizeAudioInput {
  mediaId: string;
  buffer: Buffer;
}

export interface AudioArtifact {
  format: VariantFormat;
  sizeBytes: number;
  url: string;
  storageKey: string;
  checksum: string;
  bitrateKbps?: number;
}

export interface OptimizeAudioResult {
  durationMs: number;
  variants: AudioArtifact[];
}

function checksumOf(buffer: Buffer): string {
  return `sha256-${createHash('sha256').update(buffer).digest('hex')}`;
}

async function transcode(
  input: string,
  output: string,
  codec: 'libmp3lame' | 'libopus',
  bitrate: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .audioCodec(codec)
      .audioBitrate(bitrate)
      .save(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

export async function optimizeAudio(
  input: OptimizeAudioInput,
  storage: StorageAdapter = getStorage(),
): Promise<OptimizeAudioResult> {
  const meta = await parseBuffer(input.buffer);
  const durationMs = Math.round((meta.format.duration ?? 0) * 1000);

  const work = await mkdtemp(join(tmpdir(), 'fgaudio-'));
  try {
    const src = join(work, 'src');
    const mp3 = join(work, 'out.mp3');
    const opus = join(work, 'out.opus');
    await writeFile(src, input.buffer);
    await Promise.all([
      transcode(src, mp3, 'libmp3lame', '128k'),
      transcode(src, opus, 'libopus', '96k'),
    ]);
    const [mp3Buf, opusBuf] = await Promise.all([readFile(mp3), readFile(opus)]);

    const mp3Key = `media/${input.mediaId}/mp3/master.mp3`;
    const opusKey = `media/${input.mediaId}/opus/master.opus`;

    const [mp3Put, opusPut] = await Promise.all([
      storage.put({ key: mp3Key, body: mp3Buf, contentType: 'audio/mpeg' }),
      storage.put({ key: opusKey, body: opusBuf, contentType: 'audio/ogg' }),
    ]);

    return {
      durationMs,
      variants: [
        {
          format: 'mp3',
          sizeBytes: mp3Buf.byteLength,
          url: mp3Put.url,
          storageKey: mp3Key,
          checksum: checksumOf(mp3Buf),
          bitrateKbps: 128,
        },
        {
          format: 'opus',
          sizeBytes: opusBuf.byteLength,
          url: opusPut.url,
          storageKey: opusKey,
          checksum: checksumOf(opusBuf),
          bitrateKbps: 96,
        },
      ],
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
