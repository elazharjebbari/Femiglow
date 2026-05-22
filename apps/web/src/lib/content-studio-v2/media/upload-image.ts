/**
 * Server-side pipeline that takes a raw image upload + a crop region, applies
 * the crop with sharp, produces 2 web variants (preview 1080px wide, thumbnail
 * 320px wide), persists them via the storage adapter, and creates a media DB
 * row that the v2 MediaPicker can consume.
 */
import sharp from 'sharp';
import { createId } from '@/lib/ids';
import { createMedia } from '@/lib/db/queries/media';
import { getStorage } from '@/lib/media/storage';
import { HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import type { ImageCropRequest, StudioV2MediaItem } from './types';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PREVIEW_MAX_WIDTH = 1080;
const THUMB_MAX_WIDTH = 320;
const OUTPUT_QUALITY = 85;

export async function uploadAndCropImage(input: {
  file: Buffer;
  filename: string;
  mime: string;
  crop: ImageCropRequest;
  adminId: string | null;
}): Promise<StudioV2MediaItem> {
  if (input.file.byteLength > MAX_BYTES) {
    throw new HttpError('invalid_input', `Fichier trop volumineux (max ${Math.round(MAX_BYTES / 1024 / 1024)} Mo)`);
  }
  if (!ACCEPTED_MIME.has(input.mime)) {
    throw new HttpError('invalid_input', `Type d'image non supporté (${input.mime})`);
  }
  if (input.crop.width <= 0 || input.crop.height <= 0) {
    throw new HttpError('invalid_input', 'Zone de recadrage invalide.');
  }

  const baseId = createId('mev2');
  const storage = getStorage();

  // 1) Apply rotation (if any), crop, then produce 2 web variants.
  let pipeline = sharp(input.file, { failOn: 'truncated' });
  if (input.crop.rotation && input.crop.rotation !== 0) {
    pipeline = pipeline.rotate(input.crop.rotation);
  }
  pipeline = pipeline.extract({
    left: Math.max(0, Math.floor(input.crop.x)),
    top: Math.max(0, Math.floor(input.crop.y)),
    width: Math.max(1, Math.floor(input.crop.width)),
    height: Math.max(1, Math.floor(input.crop.height)),
  });

  const cropped = await pipeline.toBuffer({ resolveWithObject: true });
  const baseSharp = sharp(cropped.data);

  const previewBuffer = await baseSharp
    .clone()
    .resize({ width: Math.min(PREVIEW_MAX_WIDTH, cropped.info.width), withoutEnlargement: true })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const thumbBuffer = await baseSharp
    .clone()
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer({ resolveWithObject: true });

  // 2) Persist (original kept as-is, then preview + thumb variants).
  const baseExt = input.filename.toLowerCase().endsWith('.png') ? 'png' : input.filename.toLowerCase().endsWith('.webp') ? 'webp' : 'jpg';
  const originalKey = `content-studio-v2/${baseId}/original.${baseExt}`;
  const previewKey = `content-studio-v2/${baseId}/preview.webp`;
  const thumbKey = `content-studio-v2/${baseId}/thumb.webp`;

  const [original, preview, thumb] = await Promise.all([
    storage.put({ key: originalKey, body: input.file, contentType: input.mime }),
    storage.put({ key: previewKey, body: previewBuffer.data, contentType: 'image/webp' }),
    storage.put({ key: thumbKey, body: thumbBuffer.data, contentType: 'image/webp' }),
  ]);

  // 3) Insert DB row in the existing `media` table for cross-module visibility.
  const slug = `cs-v2-${baseId.slice(-8)}`;
  const media = await createMedia({
    kind: 'image',
    source: 'upload',
    slug,
    alt: input.crop.alt,
    caption: null,
    credit: null,
    originalFilename: input.filename,
    originalMime: input.mime,
    originalSizeBytes: input.file.byteLength,
    originalUrl: original.url,
    originalWidth: cropped.info.width,
    originalHeight: cropped.info.height,
    qualityProfile: 'inline',
    loadingStrategy: 'viewport',
    status: 'ready',
    isHero: false,
    overrides: {
      contentStudio: {
        origin: 'imported',
        v2: {
          previewUrl: preview.url,
          thumbnailUrl: thumb.url,
          crop: {
            x: input.crop.x,
            y: input.crop.y,
            width: input.crop.width,
            height: input.crop.height,
            rotation: input.crop.rotation ?? 0,
            aspectRatio: input.crop.aspectRatio ?? null,
          },
        },
      },
    },
    createdBy: input.adminId,
  });

  logger.info('content_studio_v2.image.uploaded', {
    media_id: media.id,
    bytes_original: input.file.byteLength,
    bytes_preview: previewBuffer.data.byteLength,
    aspect_ratio: input.crop.aspectRatio ?? null,
  });

  return {
    id: media.id,
    kind: 'image',
    compartment: 'imported',
    alt: input.crop.alt,
    slug,
    thumbnailUrl: thumb.url,
    previewUrl: preview.url,
    originalUrl: original.url,
    width: previewBuffer.info.width,
    height: previewBuffer.info.height,
    createdAt: media.createdAt.toISOString(),
  };
}
