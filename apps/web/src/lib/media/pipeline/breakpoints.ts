import type { VariantBreakpoint } from '@/lib/db/types';

export const BREAKPOINT_WIDTHS: Record<VariantBreakpoint, number> = {
  xs: 320,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1440,
  '2xl': 1920,
};

export const DEFAULT_BREAKPOINTS: VariantBreakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl'];

/**
 * Breakpoints incluant la mignature `xs` (320 px). À utiliser pour les
 * composants dont le slot est rendu à très petite taille (vignettes du
 * sommaire, petits portraits, miniatures de carte, etc.).
 *
 * Choix : on conserve l'ensemble complet pour rester polyvalent — un même
 * média peut être utilisé en grand format (page) ET en miniature (menu).
 * Les slots purement « thumb » (jamais affichés en grand) peuvent passer
 * `THUMB_ONLY_BREAKPOINTS` à la place pour économiser le stockage.
 */
export const THUMB_BREAKPOINTS: VariantBreakpoint[] = [
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
];

/**
 * Breakpoints pour un usage uniquement « miniature » (≤ 480 px).
 * Réservé aux images qui ne sont jamais affichées au-delà.
 */
export const THUMB_ONLY_BREAKPOINTS: VariantBreakpoint[] = ['xs', 'sm'];

export const DEFAULT_FORMATS = ['avif', 'webp', 'jpeg'] as const;

export const DEFAULT_QUALITIES: Record<'avif' | 'webp' | 'jpeg', number> = {
  avif: 55,
  webp: 75,
  jpeg: 80,
};
