import { fileTypeFromBuffer } from 'file-type';
import { env } from '@/lib/env';
import type { MediaKind } from '@/lib/db/types';

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const AUDIO_MIME = new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/aac']);

// MP-AR-005 (BUG-004): subtitles are SRT/VTT text tracks.
const SUBTITLE_MIME = new Set(['application/x-subrip', 'text/vtt', 'text/plain']);

const MIME_BY_KIND: Record<MediaKind, Set<string>> = {
  image: IMAGE_MIME,
  video: VIDEO_MIME,
  audio: AUDIO_MIME,
  subtitles: SUBTITLE_MIME,
};

export interface ValidatedUpload {
  kind: MediaKind;
  mime: string;
  ext: string;
  sizeBytes: number;
}

export interface ValidationError {
  code: 'too_large' | 'mime_mismatch' | 'unsupported' | 'corrupt';
  message: string;
}

export class MediaValidationError extends Error {
  code: ValidationError['code'];
  constructor(error: ValidationError) {
    super(error.message);
    this.code = error.code;
  }
}

function detectKindFromMime(mime: string): MediaKind | null {
  if (IMAGE_MIME.has(mime)) return 'image';
  if (VIDEO_MIME.has(mime)) return 'video';
  if (AUDIO_MIME.has(mime)) return 'audio';
  return null;
}

export async function validateUpload(
  buffer: Buffer,
  declaredKind?: MediaKind,
): Promise<ValidatedUpload> {
  if (buffer.byteLength > env.MEDIA_MAX_BYTES) {
    throw new MediaValidationError({
      code: 'too_large',
      message: `fichier > ${env.MEDIA_MAX_BYTES} octets`,
    });
  }

  // SVG = pure XML, file-type ne le détecte pas — fallback signature
  const isSvg = buffer
    .slice(0, Math.min(512, buffer.byteLength))
    .toString('utf8')
    .trimStart()
    .toLowerCase()
    .startsWith('<svg');
  if (isSvg) {
    if (declaredKind && declaredKind !== 'image') {
      throw new MediaValidationError({
        code: 'mime_mismatch',
        message: `attendu ${declaredKind}, détecté image (svg)`,
      });
    }
    return { kind: 'image', mime: 'image/svg+xml', ext: 'svg', sizeBytes: buffer.byteLength };
  }

  const ft = await fileTypeFromBuffer(new Uint8Array(buffer));
  if (!ft) {
    throw new MediaValidationError({ code: 'corrupt', message: 'type non détecté' });
  }

  const kind = detectKindFromMime(ft.mime);
  if (!kind) {
    throw new MediaValidationError({
      code: 'unsupported',
      message: `mime ${ft.mime} non supporté`,
    });
  }
  if (declaredKind && declaredKind !== kind) {
    throw new MediaValidationError({
      code: 'mime_mismatch',
      message: `attendu ${declaredKind}, détecté ${kind}`,
    });
  }
  if (!MIME_BY_KIND[kind].has(ft.mime)) {
    throw new MediaValidationError({
      code: 'unsupported',
      message: `mime ${ft.mime} non whitelist`,
    });
  }
  return { kind, mime: ft.mime, ext: ft.ext, sizeBytes: buffer.byteLength };
}
