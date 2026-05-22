/**
 * Shared types between the v2 media endpoints and the React components.
 */

export type StudioV2MediaKind = 'image' | 'video';
export type StudioV2Compartment = 'imported' | 'ai_generated';

export interface StudioV2MediaItem {
  id: string;
  kind: StudioV2MediaKind;
  compartment: StudioV2Compartment;
  alt: string;
  slug: string;
  /** URL of a small thumbnail (typically 320px wide). */
  thumbnailUrl: string | null;
  /** URL of the editable / preview-quality variant (typically 1080px wide). */
  previewUrl: string;
  /** Original full-quality URL (1:1 with what was uploaded after the optional crop / trim). */
  originalUrl: string;
  /** For videos: duration in seconds. */
  durationSec?: number | null;
  /** Pixel dimensions of the preview variant. */
  width?: number | null;
  height?: number | null;
  /** Server-side timestamp of the upload. */
  createdAt: string;
}

export interface ImageCropRequest {
  /** Top-left x in source-image pixels. */
  x: number;
  /** Top-left y in source-image pixels. */
  y: number;
  /** Crop width in source-image pixels. */
  width: number;
  /** Crop height in source-image pixels. */
  height: number;
  /** Optional rotation in degrees (CW). 0 if absent. */
  rotation?: number;
  /** Optional aspect-ratio hint for UI tracking (e.g. '4:5'). Not enforced server-side. */
  aspectRatio?: string;
  /** Alt text for accessibility. */
  alt: string;
}

export interface VideoTrimRequest {
  /** Start of the kept segment, in seconds. */
  startSec: number;
  /** End of the kept segment, in seconds. Max delta enforced server-side (90s). */
  endSec: number;
  /** Alt text for accessibility (used for poster alt). */
  alt: string;
}
