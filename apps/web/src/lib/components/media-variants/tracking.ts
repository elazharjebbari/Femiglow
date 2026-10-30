/**
 * Médias par audience — valeur de tracking `hero_media_variant` (pur).
 *
 * Format : `<dim>-<clé>.<langue>.v<version>` pour un ensemble, où la langue
 * `*` s'écrit `any` et la dimension `default` s'écrit seule :
 *  - `angle-e.ar.v3`, `angle-e.any.v2`, `default.fr.v1`,
 *  - `ab-hero-media-2026-11-b.fr.v1` (`ab:<exp>` → `ab-<exp>`),
 *  - `legacy` (niveau 7), `product` (niveau 8).
 * Le niveau est envoyé à part (`hero_media_level`).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.6
 */
import { DEFAULT_DIMENSION, WILDCARD } from './dimensions';
import type { FallbackLevel, MediaSlotTrace } from './types';

export type MediaVariantTrackingValue = string;

/** Valeur de tracking d'une trace de slot. */
export function traceTrackingValue(trace: MediaSlotTrace | null | undefined): MediaVariantTrackingValue {
  if (!trace || trace.level === 7) return 'legacy';
  if (trace.level === 8) return 'product';
  if (!trace.variantDim || trace.locale === null || trace.version === null) return 'legacy';
  const dim = trace.variantDim.replace(/:/g, '-');
  const head = trace.variantDim === DEFAULT_DIMENSION ? dim : `${dim}-${trace.variantKey ?? WILDCARD}`;
  const locale = trace.locale === WILDCARD ? 'any' : trace.locale;
  return `${head}.${locale}.v${trace.version}`;
}

/**
 * Valeur de tracking pour un slot (par défaut `primary`, l'image vue en
 * premier). Slot absent des traces → `legacy`.
 */
export function mediaVariantTrackingValue(
  traces: Readonly<Record<string, MediaSlotTrace>>,
  slot = 'primary',
): MediaVariantTrackingValue {
  return traceTrackingValue(traces[slot]);
}

/** Trace d'un slot délégué à l'appelant (niveau 7 legacy ou 8 produit). */
export function delegatedTrace(slot: string, level: Extract<FallbackLevel, 7 | 8>): MediaSlotTrace {
  return { slot, level, setId: null, variantDim: null, variantKey: null, locale: null, version: null };
}
