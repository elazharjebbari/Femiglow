import type {
  MediaLoadingStrategy,
  MediaQualityProfile,
  MediaWithRelations,
  MediaOverrides,
  VariantBreakpoint,
  VariantFormat,
  FetchPriority,
} from '@/lib/db/types';
import {
  BREAKPOINT_WIDTHS,
  DEFAULT_BREAKPOINTS,
  DEFAULT_FORMATS,
} from '@/lib/media/pipeline/breakpoints';

export type MediaContextHint = 'hero' | 'inline' | 'thumb' | 'og';

export interface ResolvedMediaConfig {
  loadingStrategy: MediaLoadingStrategy;
  qualityProfile: MediaQualityProfile;
  fetchPriority: FetchPriority;
  breakpoints: VariantBreakpoint[];
  formats: ReadonlyArray<VariantFormat>;
  sizes: string;
  alt: string;
  decoding: 'async' | 'sync' | 'auto';
}

const DEFAULT_SIZES = '(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 33vw';

export interface ResolveInput {
  media: Pick<MediaWithRelations, 'overrides' | 'qualityProfile' | 'loadingStrategy' | 'isHero' | 'alt'>;
  context: MediaContextHint;
  props?: {
    priority?: boolean;
    loading?: MediaLoadingStrategy;
    sizes?: string;
    alt?: string;
  };
}

function pickStrategy(input: ResolveInput): MediaLoadingStrategy {
  if (input.props?.priority) return 'eager';
  if (input.props?.loading) return input.props.loading;
  const overrides = input.media.overrides as MediaOverrides | undefined;
  if (overrides?.loadingStrategy) return overrides.loadingStrategy;
  if (input.context === 'hero' || input.media.isHero) return 'eager';
  return input.media.loadingStrategy;
}

function pickQuality(input: ResolveInput): MediaQualityProfile {
  const overrides = input.media.overrides as MediaOverrides | undefined;
  if (overrides?.qualityProfile) return overrides.qualityProfile;
  if (input.context === 'hero') return 'hero';
  if (input.context === 'thumb') return 'thumb';
  return input.media.qualityProfile;
}

export function resolveConfig(input: ResolveInput): ResolvedMediaConfig {
  const overrides = input.media.overrides as MediaOverrides | undefined;
  const loadingStrategy = pickStrategy(input);
  const qualityProfile = pickQuality(input);
  return {
    loadingStrategy,
    qualityProfile,
    fetchPriority: loadingStrategy === 'eager' ? 'high' : 'auto',
    breakpoints: overrides?.breakpoints ?? DEFAULT_BREAKPOINTS,
    formats: overrides?.formats ?? DEFAULT_FORMATS,
    sizes: input.props?.sizes ?? DEFAULT_SIZES,
    alt: input.props?.alt ?? input.media.alt,
    decoding: loadingStrategy === 'eager' ? 'sync' : 'async',
  };
}

export interface PickedVariants {
  bestFormat: VariantFormat;
  byFormat: Map<VariantFormat, Array<{ width: number; url: string }>>;
}

export function pickVariants(
  variants: MediaWithRelations['variants'],
  config: ResolvedMediaConfig,
): PickedVariants {
  const byFormat = new Map<VariantFormat, Array<{ width: number; url: string }>>();
  for (const v of variants) {
    if (!config.formats.includes(v.format)) continue;
    if (v.breakpoint && !config.breakpoints.includes(v.breakpoint)) continue;
    const list = byFormat.get(v.format) ?? [];
    const width = v.width ?? (v.breakpoint ? BREAKPOINT_WIDTHS[v.breakpoint] : 1024);
    list.push({ width, url: v.url });
    byFormat.set(v.format, list);
  }
  for (const list of byFormat.values()) list.sort((a, b) => a.width - b.width);
  const bestFormat = (config.formats.find((f) => byFormat.has(f)) ??
    config.formats[0]) as VariantFormat;
  return { bestFormat, byFormat };
}

export function buildSrcset(entries: Array<{ width: number; url: string }>): string {
  return entries.map((e) => `${e.url} ${e.width}w`).join(', ');
}
