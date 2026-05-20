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
