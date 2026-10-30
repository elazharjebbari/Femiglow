/**
 * Kit CRO v2 §3 — titre du hero /kit selon l'angle publicitaire.
 *
 * Les textes vivent dans le composant CMS `kit-hero-angles` (champs texte
 * simples `<angle>_kicker`, `<angle>_titleCategory`, `<angle>_titlePromise`).
 * Tous les angles sont lus en UN appel caché (`resolveComponentFields`), puis
 * l'angle est choisi ici, en mémoire : le cache n'est pas fragmenté par angle.
 *
 * Repli champ par champ : un champ vide (ou absent) retombe sur le titre par
 * défaut (i18n `marketing.kit.hero.*`). Module pur, sans I/O.
 */
import type { ResolvedFields } from '@/lib/db/types';

import type { KitAngle } from './angle';

/** Clé du composant CMS. */
export const KIT_HERO_ANGLES_COMPONENT_KEY = 'kit-hero-angles';

export type KitHeroAngleField = 'kicker' | 'titleCategory' | 'titlePromise';

export const KIT_HERO_ANGLE_FIELDS: readonly KitHeroAngleField[] = [
  'kicker',
  'titleCategory',
  'titlePromise',
];

export interface KitHeroAngleCopy {
  kicker: string;
  titleCategory: string;
  titlePromise: string;
}

/** Clé du champ CMS pour un angle (`e_titlePromise`). */
export function kitHeroAngleFieldKey(angle: KitAngle, field: KitHeroAngleField): string {
  return `${angle}_${field}`;
}

export interface ResolveKitHeroAngleCopyOptions {
  /**
   * `false` en AR/EN : les valeurs par défaut du registre sont en français et
   * ne doivent pas fuiter ; seul un texte publié pour la locale est retenu.
   * Défaut `true` (FR).
   */
  acceptDefault?: boolean;
}

function pickText(
  field: ResolvedFields[string] | undefined,
  fallback: string,
  acceptDefault: boolean,
): string {
  if (!field) return fallback;
  if (!acceptDefault && field.meta.source === 'default') return fallback;
  const value = field.value;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Textes du hero pour l'angle donné. Sans angle (ou sans texte pour cet
 * angle), renvoie `defaults` tel quel.
 */
export function resolveKitHeroAngleCopy(
  fields: ResolvedFields | null | undefined,
  angle: KitAngle | null | undefined,
  defaults: KitHeroAngleCopy,
  { acceptDefault = true }: ResolveKitHeroAngleCopyOptions = {},
): KitHeroAngleCopy {
  if (!angle || !fields) return defaults;
  return {
    kicker: pickText(fields[kitHeroAngleFieldKey(angle, 'kicker')], defaults.kicker, acceptDefault),
    titleCategory: pickText(
      fields[kitHeroAngleFieldKey(angle, 'titleCategory')],
      defaults.titleCategory,
      acceptDefault,
    ),
    titlePromise: pickText(
      fields[kitHeroAngleFieldKey(angle, 'titlePromise')],
      defaults.titlePromise,
      acceptDefault,
    ),
  };
}
