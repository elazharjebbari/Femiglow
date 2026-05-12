/**
 * Pipeline d'upload des photos d'un témoignage :
 *  - validation mime + dimensions
 *  - EXIF strip
 *  - génération display + thumbnail
 *  - upload Vercel Blob (production) ou fallback local (dev)
 *  - check vision ML en async (le wizard reçoit pendingCheck)
 *
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 6.2
 */
import sharp from 'sharp';
import { createId } from '@/lib/ids';
import { checkFacesWithTimeout } from './vision-ml-faces';

export interface ProcessedPhoto {
  blobKey: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  byteSize: number;
  mime: string;
  facesStatus: 'OK' | 'MANUAL_REVIEW' | 'REJECTED_FACE' | 'PENDING_CHECK';
  facesCount: number;
}

export interface PhotoPipelineOptions {
  /** Vision ML synchrone ou async (non bloquant). */
  visionMlMode?: 'sync' | 'async';
  /** Timeout vision ML en ms. */
  visionMlTimeoutMs?: number;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIMENSION = 400; // 600 idéal, 400 minimum accepté
const ACCEPTED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

export class PhotoValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PhotoValidationError';
  }
}

/**
 * Process un buffer d'image :
 *  1. Détection mime via Sharp metadata (magic bytes)
 *  2. Validation taille / dimensions
 *  3. EXIF strip (rotate + withMetadata vide)
 *  4. Generate display (1200px) + thumb (240px) en WebP
 *  5. Upload Blob (ou fallback path)
 *  6. Vision ML : sync (bloque) ou async (return PENDING_CHECK + déclenche check)
 */
export async function processPhoto(
  buffer: Buffer,
  declaredMime: string,
  options: PhotoPipelineOptions = {},
): Promise<ProcessedPhoto> {
  if (buffer.length === 0) {
    throw new PhotoValidationError('Fichier vide', 'EMPTY_FILE');
  }
  if (buffer.length > MAX_BYTES) {
    throw new PhotoValidationError(
      `Photo trop volumineuse (${buffer.length} octets, max ${MAX_BYTES}).`,
      'PHOTO_TOO_LARGE',
    );
  }
  if (!ACCEPTED_MIMES.has(declaredMime)) {
    throw new PhotoValidationError(
      `Format ${declaredMime} non accepté. JPEG, PNG, WebP ou HEIC.`,
      'INVALID_MIME',
    );
  }

  // Validation magic bytes via Sharp metadata
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch (e) {
    throw new PhotoValidationError(
      `Image corrompue ou non lisible : ${e instanceof Error ? e.message : String(e)}`,
      'CORRUPT_IMAGE',
    );
  }
  if (!meta.width || !meta.height) {
    throw new PhotoValidationError('Dimensions inconnues.', 'NO_DIMENSIONS');
  }
  if (meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
    throw new PhotoValidationError(
      `Image trop petite (${meta.width}×${meta.height}, min ${MIN_DIMENSION}×${MIN_DIMENSION}).`,
      'IMAGE_TOO_SMALL',
    );
  }

  // EXIF strip + auto-rotate
  const stripped = await sharp(buffer)
    .rotate()
    .withMetadata({ exif: {} })
    .toBuffer();

  // Display : 1200 max, WebP 75
  const display = await sharp(stripped)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  // Thumb : 240×240, WebP 70
  const thumb = await sharp(stripped)
    .resize(240, 240, { fit: 'cover' })
    .webp({ quality: 70 })
    .toBuffer();

  // Storage : Vercel Blob si BLOB_READ_WRITE_TOKEN ; sinon stub local URL
  const slug = createId();
  const blobKey = `rituals/${slug}`;
  const useBlob =
    !!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV !== 'test';

  let displayUrl: string;
  let thumbUrl: string;

  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const displayBlob = await put(`${blobKey}-display.webp`, display, {
      access: 'public',
      contentType: 'image/webp',
    });
    const thumbBlob = await put(`${blobKey}-thumb.webp`, thumb, {
      access: 'public',
      contentType: 'image/webp',
    });
    displayUrl = displayBlob.url;
    thumbUrl = thumbBlob.url;
  } else {
    // Fallback local / test — URL data: pour les preview-only en dev sans Blob
    displayUrl = `data:image/webp;base64,${display.toString('base64').slice(0, 24)}…/display`;
    thumbUrl = `data:image/webp;base64,${thumb.toString('base64').slice(0, 24)}…/thumb`;
  }

  // Vision ML
  const mode = options.visionMlMode ?? 'sync';
  let facesStatus: ProcessedPhoto['facesStatus'] = 'PENDING_CHECK';
  let facesCount = 0;
  if (mode === 'sync') {
    const result = await checkFacesWithTimeout(
      { buffer: stripped, url: displayUrl },
      options.visionMlTimeoutMs ?? 5000,
    );
    facesStatus = result.status;
    facesCount = result.facesCount;
  } else {
    // Async : on retourne PENDING_CHECK, le caller (CRON ou job) finira plus tard.
    facesStatus = 'PENDING_CHECK';
  }

  return {
    blobKey,
    url: displayUrl,
    thumbUrl,
    width: meta.width,
    height: meta.height,
    byteSize: stripped.byteLength,
    mime: 'image/webp',
    facesStatus,
    facesCount,
  };
}
