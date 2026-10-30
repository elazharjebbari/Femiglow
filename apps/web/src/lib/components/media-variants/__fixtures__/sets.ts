/**
 * Fabriques de test — ensembles de médias par audience (aucune I/O).
 * Utilisées par `select.test.ts` et `resolve.test.ts`.
 */
import type {
  ComponentMediaSetItemWithMedia,
  ComponentMediaSetWithMedia,
  MediaSetItemAlt,
  MediaSetMedia,
} from '@/lib/db/types';
import { KIT_HERO_MEDIA_VARIANTS, type MediaVariantPolicy } from '@/lib/components/registry';
import { toMediaSetDTO } from '../dto';
import type { MediaSetDTO } from '../types';

const T0 = new Date('2026-10-01T00:00:00Z');

export function makeMedia(id: string, overrides: Partial<MediaSetMedia> = {}): MediaSetMedia {
  return {
    id,
    kind: 'image',
    source: 'upload',
    slug: id,
    originalUrl: null,
    originalFilename: null,
    originalSizeBytes: null,
    originalMime: 'image/png',
    originalWidth: 1200,
    originalHeight: 1500,
    originalDurationMs: null,
    phash: null,
    blurhash: null,
    palette: [],
    alt: `Alt médiathèque ${id}`,
    caption: null,
    credit: null,
    status: 'ready',
    failureReason: null,
    qualityProfile: 'hero',
    loadingStrategy: 'eager',
    isHero: true,
    overrides: {},
    blurDataUrl: null,
    createdBy: null,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    variants: [
      {
        id: `${id}_lg_webp`,
        mediaId: id,
        format: 'webp',
        breakpoint: 'lg',
        width: 1200,
        height: 1500,
        bitrateKbps: null,
        quality: 82,
        sizeBytes: 50_000,
        url: `/_media/${id}/lg.webp`,
        checksum: 'x',
        createdAt: T0,
      },
    ],
    ...overrides,
  };
}

export interface ItemSpec {
  media?: MediaSetMedia | null;
  mobileMedia?: MediaSetMedia | null;
  alt?: MediaSetItemAlt;
}

export interface SetSpec {
  id?: string;
  slot?: string;
  dim?: string;
  key?: string;
  locale?: string;
  crossLocale?: boolean;
  version?: number;
  /** Nombre d'items générés (ignoré si `items` est fourni). */
  count?: number;
  items?: ItemSpec[];
}

let seq = 0;

/** Ensemble publié, forme LIGNE (ce que renvoie `listPublishedSetsWithMedia`). */
export function makeSetRow(spec: SetSpec = {}): ComponentMediaSetWithMedia {
  seq += 1;
  const id = spec.id ?? `set_${seq}`;
  const specs: ItemSpec[] =
    spec.items ?? Array.from({ length: spec.count ?? 1 }, () => ({}));
  const items: ComponentMediaSetItemWithMedia[] = specs.map((s, position) => ({
    id: `${id}_i${position}`,
    setId: id,
    position,
    mediaId: s.media?.id ?? `${id}_m${position}`,
    mobileMediaId: s.mobileMedia?.id ?? null,
    alt: s.alt ?? {},
    objectPosition: null,
    focalX: null,
    focalY: null,
    createdAt: T0,
    media: s.media === undefined ? makeMedia(`${id}_m${position}`) : s.media,
    mobileMedia: s.mobileMedia ?? null,
  }));
  return {
    id,
    componentId: 'cmp_kit_hero',
    slot: spec.slot ?? 'primary',
    variantDim: spec.dim ?? 'default',
    variantKey: spec.key ?? '*',
    locale: spec.locale ?? '*',
    crossLocale: spec.crossLocale ?? false,
    status: 'published',
    version: spec.version ?? 1,
    publishedAt: T0,
    scheduledAt: null,
    source: 'admin',
    notes: null,
    authorId: null,
    createdAt: T0,
    updatedAt: T0,
    items,
  };
}

/** Ensemble publié projeté (DTO), prêt pour `selectMediaSet`. */
export function makeSet(spec: SetSpec = {}): MediaSetDTO {
  return toMediaSetDTO(makeSetRow(spec));
}

/** Politique du hero kit (registre). */
export const KIT_POLICY: MediaVariantPolicy = KIT_HERO_MEDIA_VARIANTS;

/** Politique avec une dimension A/B prioritaire sur l'angle. */
export const AB_POLICY: MediaVariantPolicy = {
  ...KIT_HERO_MEDIA_VARIANTS,
  dimensions: ['ab:hero-media-2026-11', 'angle'],
};
