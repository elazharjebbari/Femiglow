/**
 * Types côté admin pour l'override singleton de la section vidéo `/kit`.
 *
 *  - Un seul override par site (la section vidéo est unique).
 *  - L'override est éditable champ par champ ; on stocke seulement les
 *    champs modifiés (les autres viennent du mock).
 *  - `publishedAt` distingue brouillon (draft) et live.
 */
import type { RituelVideo } from '@/lib/schemas';

/**
 * Cover SVG dynamique pour le poster de la vidéo (Phase α-δ).
 *
 *  - `inline` : SVG markup saisi dans l'éditeur admin (sanitized DOMPurify).
 *  - `file`   : fichier SVG uploadé, référence media DB.
 *  - `url`    : URL HTTPS externe pointant vers un SVG (CORS-safe).
 *
 *  Un seul mode actif à la fois ; les autres champs restent vides.
 */
export interface KitVideoPosterCoverSvg {
  source: 'inline' | 'file' | 'url';
  /** SVG markup brut, sanitized côté serveur avant stockage. */
  inline?: string | null;
  /** ID media (référence Drizzle/memoryStore). */
  fileMediaId?: string | null;
  /** URL externe HTTPS, validée content-type + taille. */
  url?: string | null;
  /** Métadonnées pour le rendu et l'a11y. */
  meta?: {
    viewBox?: string;
    ariaLabel?: string;
  } | null;
}

/**
 * Sous-ensemble éditable du `RituelVideo`. Volontairement restreint aux
 * champs maîtrisables par un éditeur non-dev (cf. `06-admin-ui-ux-design.md`
 * §2). Les sources self-hosted, captions, transcript restent gérés côté code.
 */
export interface KitVideoOverridePatch {
  youtubeUrl?: string | null;
  provenance?: string | null;
  durationDisplay?: string | null;
  accentColor?: RituelVideo['accentColor'] | null;
  posterCustom?: RituelVideo['posterCustom'] | null;
  chapters?: RituelVideo['chapters'] | null;
  posterCoverSvg?: KitVideoPosterCoverSvg | null;
}

export interface KitVideoOverride extends KitVideoOverridePatch {
  /** Singleton id (`'kit:video'`). */
  id: string;
  createdAt: Date;
  updatedAt: Date;
  /** Présent quand le draft a été publié au moins une fois. */
  publishedAt: Date | null;
  /** Présent dès qu'il existe un draft non publié. */
  draftedAt: Date | null;
  createdBy: string | null;
}

export type KitVideoSource = 'override-published' | 'override-draft' | 'mock';

export interface ResolvedKitVideo {
  video: RituelVideo;
  meta: {
    source: KitVideoSource;
    publishedAt: Date | null;
    draftedAt: Date | null;
    updatedAt: Date | null;
  };
}

/** Identifiant singleton (un seul rituel vidéo par site). */
export const KIT_VIDEO_OVERRIDE_ID = 'kit:video' as const;
