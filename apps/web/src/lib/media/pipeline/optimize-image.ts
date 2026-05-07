import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { VariantBreakpoint, VariantFormat } from '@/lib/db/types';
import {
  BREAKPOINT_WIDTHS,
  DEFAULT_BREAKPOINTS,
  DEFAULT_FORMATS,
  DEFAULT_QUALITIES,
} from './breakpoints';
import { computeBlurhash } from './blurhash';
import { computePalette } from './palette';
import { computePhash } from './phash';
import { computeCropRegion, type CropRegion } from './crop-region';
import { getStorage } from '@/lib/media/storage';
import type { StorageAdapter } from '@/lib/media/storage';

export interface OptimizeImageInput {
  mediaId: string;
  buffer: Buffer;
  breakpoints?: VariantBreakpoint[];
  formats?: ReadonlyArray<'avif' | 'webp' | 'jpeg'>;
  qualities?: Partial<Record<VariantFormat, number>>;
  /**
   * Si fourni, le pipeline cropera physiquement la source à ce ratio
   * (centré sur le focal point, ou sur le centre par défaut) AVANT de
   * générer les variants. Permet d'éliminer définitivement le letterbox
   * sur des slots à ratio fixe (cartes journal en 4/5, par ex.).
   *
   * Format : `'4/5'`, `'16/9'`, `'1/1'`. Le séparateur `:` est aussi accepté.
   */
  targetAspectRatio?: string;
  /** Focal point en % (0-100). Défaut 50/50 = centre. */
  focalX?: number | null;
  focalY?: number | null;
  /**
   * Couleur de fond aplatie sous l'image avant l'encodage. Utile quand on
   * encode en JPEG (qui n'a pas d'alpha) à partir d'un PNG transparent :
   * sans ça, sharp comble par du noir → vilain. Format hex (`#FBF8F1`)
   * ou rgb/rgba CSS. Si absent, on utilise `'#FBF8F1'` (creme).
   */
  flattenBackground?: string;
}

export interface VariantArtifact {
  format: VariantFormat;
  breakpoint: VariantBreakpoint;
  width: number;
  height: number;
  sizeBytes: number;
  url: string;
  checksum: string;
  storageKey: string;
  quality: number;
}

export interface OptimizeImageResult {
  width: number;
  height: number;
  blurhash: string;
  palette: Awaited<ReturnType<typeof computePalette>>;
  phash: string;
  variants: VariantArtifact[];
}

function checksumOf(buffer: Buffer): string {
  return `sha256-${createHash('sha256').update(buffer).digest('hex')}`;
}

function variantKey(mediaId: string, format: VariantFormat, breakpoint: VariantBreakpoint): string {
  return `media/${mediaId}/${format}/${breakpoint}.${format}`;
}

interface EncodeOptions {
  cropRegion?: CropRegion | null;
  flattenBackground?: string;
}

async function encode(
  buffer: Buffer,
  format: 'avif' | 'webp' | 'jpeg',
  width: number,
  quality: number,
  options: EncodeOptions = {},
): Promise<{ data: Buffer; width: number; height: number }> {
  let pipeline = sharp(buffer).rotate();
  // Crop physique AVANT le resize : on garde toute la précision sharp.
  if (options.cropRegion) {
    pipeline = pipeline.extract({
      left: options.cropRegion.left,
      top: options.cropRegion.top,
      width: options.cropRegion.width,
      height: options.cropRegion.height,
    });
  }
  pipeline = pipeline.resize(width, undefined, { withoutEnlargement: true });
  // JPEG ne sait pas gérer l'alpha → on aplatit sur la couleur fournie pour
  // ne pas avoir de noir disgracieux sur les PNG transparents.
  if (format === 'jpeg') {
    pipeline = pipeline.flatten({ background: options.flattenBackground ?? '#FBF8F1' });
    pipeline = pipeline.jpeg({ quality, progressive: true });
  } else if (format === 'avif') {
    pipeline = pipeline.avif({ quality });
  } else {
    pipeline = pipeline.webp({ quality });
  }
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function optimizeImage(
  input: OptimizeImageInput,
  storage: StorageAdapter = getStorage(),
): Promise<OptimizeImageResult> {
  const { buffer, mediaId } = input;
  const breakpoints = input.breakpoints ?? DEFAULT_BREAKPOINTS;
  const formats = input.formats ?? DEFAULT_FORMATS;

  const meta = await sharp(buffer).metadata();
  const origWidth = meta.width ?? 0;
  const origHeight = meta.height ?? 0;

  // Calcul de la région de crop (une seule fois, partagée par tous les
  // variants — évite de re-calculer à chaque encodage).
  const cropRegion = input.targetAspectRatio
    ? computeCropRegion({
        sourceWidth: origWidth,
        sourceHeight: origHeight,
        targetAspectRatio: input.targetAspectRatio,
        focalX: input.focalX,
        focalY: input.focalY,
      })
    : null;

  // Dimensions effectives après crop (ou source si pas de crop).
  const effectiveWidth = cropRegion?.width ?? origWidth;
  const effectiveHeight = cropRegion?.height ?? origHeight;

  // Si on crope, on calcule blurhash/palette/phash sur la VARIANTE cropée
  // pour que le placeholder reflète vraiment ce que l'utilisateur verra.
  const baseBuffer = cropRegion
    ? await sharp(buffer)
        .rotate()
        .extract(cropRegion)
        .toBuffer()
    : buffer;

  const [blurhash, palette, phash] = await Promise.all([
    computeBlurhash(baseBuffer),
    computePalette(baseBuffer),
    computePhash(baseBuffer),
  ]);

  const variants: VariantArtifact[] = [];
  for (const bp of breakpoints) {
    const targetWidth = Math.min(
      BREAKPOINT_WIDTHS[bp],
      effectiveWidth || BREAKPOINT_WIDTHS[bp],
    );
    for (const format of formats) {
      const quality = input.qualities?.[format] ?? DEFAULT_QUALITIES[format];
      const { data, width, height } = await encode(buffer, format, targetWidth, quality, {
        cropRegion,
        flattenBackground: input.flattenBackground,
      });
      const key = variantKey(mediaId, format, bp);
      const checksum = checksumOf(data);
      const put = await storage.put({
        key,
        body: data,
        contentType: `image/${format === 'jpeg' ? 'jpeg' : format}`,
      });
      variants.push({
        format,
        breakpoint: bp,
        width,
        height,
        sizeBytes: data.byteLength,
        url: put.url,
        checksum,
        storageKey: key,
        quality,
      });
    }
  }

  return {
    width: effectiveWidth,
    height: effectiveHeight,
    blurhash,
    palette,
    phash,
    variants,
  };
}
