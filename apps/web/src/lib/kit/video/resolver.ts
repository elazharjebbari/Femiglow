/**
 * Resolver de la section vidéo `/kit`.
 *
 * Cascade :
 *   1. Si l'override singleton existe ET est publié (mode 'published')
 *      → merge ses champs non-null sur le mock.
 *   2. Si l'override existe en draft ET on demande la version draft (admin
 *      preview) → merge sur le mock même si non publié.
 *   3. Sinon → retourne le mock pur.
 *
 * Les champs non éditables (sources mp4/webm, captions, transcript,
 * durationSeconds, poster fallback) viennent toujours du mock.
 */
import { mockKitPageContent } from '@/data/mock/kit';
import type { RituelVideo } from '@/lib/schemas';
import { getKitVideoOverride } from './store';
import type { KitVideoOverride, ResolvedKitVideo, KitVideoSource } from './types';

/**
 * Version publique : ne sert l'override QUE s'il est publié.
 * Tout le reste retombe sur le mock.
 */
export function resolveKitVideo(): ResolvedKitVideo {
  const override = getKitVideoOverride();
  if (!override || !override.publishedAt) {
    return { video: mockKitPageContent.videoSrc, meta: emptyMeta() };
  }
  return {
    video: mergeOverrideOnMock(override),
    meta: {
      source: 'override-published',
      publishedAt: override.publishedAt,
      draftedAt: override.draftedAt,
      updatedAt: override.updatedAt,
    },
  };
}

/**
 * Version admin : sert la dernière version (draft inclus) pour piloter
 * l'aperçu temps réel de l'éditeur.
 */
export function resolveKitVideoDraft(): ResolvedKitVideo {
  const override = getKitVideoOverride();
  if (!override) {
    return { video: mockKitPageContent.videoSrc, meta: emptyMeta() };
  }
  const source: KitVideoSource = override.publishedAt && !override.draftedAt
    ? 'override-published'
    : 'override-draft';
  return {
    video: mergeOverrideOnMock(override),
    meta: {
      source,
      publishedAt: override.publishedAt,
      draftedAt: override.draftedAt,
      updatedAt: override.updatedAt,
    },
  };
}

function emptyMeta(): ResolvedKitVideo['meta'] {
  return {
    source: 'mock',
    publishedAt: null,
    draftedAt: null,
    updatedAt: null,
  };
}

function mergeOverrideOnMock(override: KitVideoOverride): RituelVideo {
  const base = mockKitPageContent.videoSrc;
  return {
    ...base,
    youtubeUrl: override.youtubeUrl !== undefined && override.youtubeUrl !== null
      ? override.youtubeUrl
      : base.youtubeUrl,
    provenance: pickPatch(override.provenance, base.provenance),
    durationDisplay: pickPatch(override.durationDisplay, base.durationDisplay),
    accentColor: pickPatch(override.accentColor, base.accentColor),
    posterCustom: pickPatch(override.posterCustom, base.posterCustom),
    chapters: pickPatch(override.chapters, base.chapters),
    posterCoverSvg: pickPatch(override.posterCoverSvg, base.posterCoverSvg),
  };
}

/**
 * Règle d'application :
 *  - `null` → champ effacé (retour mock)
 *  - `undefined` → champ conservé (mock)
 *  - valeur → écrase
 */
function pickPatch<T>(
  overrideValue: T | null | undefined,
  baseValue: T | undefined,
): T | undefined {
  if (overrideValue === null) return baseValue;
  if (overrideValue === undefined) return baseValue;
  return overrideValue;
}
