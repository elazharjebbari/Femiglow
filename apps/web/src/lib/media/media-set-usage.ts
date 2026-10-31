/**
 * Libellés des usages d'un média par les ensembles « médias par audience »
 * (module pur, partagé par la fiche média de la médiathèque et le message
 * de refus d'une suppression définitive).
 *
 * Exemple : « kit-hero-produit · secondary · angle e · ar (publié v3) ».
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */

/** Forme minimale lue (compatible avec `MediaSetUsage` de la couche requêtes). */
export interface MediaSetUsageLike {
  setId: string;
  componentId: string;
  componentKey: string | null;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  status: string;
  version: number;
}

export const MEDIA_SET_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'brouillon',
  published: 'publié',
  scheduled: 'programmé',
  archived: 'archivé',
};

/** « défaut » ou « <dimension> <clé> » (`angle e`, `ab:xp b`). */
export function mediaSetVariantLabel(variantDim: string, variantKey: string): string {
  return variantDim === 'default' ? 'défaut' : `${variantDim} ${variantKey}`;
}

/** « toutes langues » pour `*`, sinon le code de langue. */
export function mediaSetLocaleLabel(locale: string): string {
  return locale === '*' ? 'toutes langues' : locale;
}

/** « kit-hero-produit · secondary · angle e · ar (publié v3) ». */
export function describeMediaSetUsage(u: MediaSetUsageLike): string {
  const status = MEDIA_SET_STATUS_LABELS[u.status] ?? u.status;
  return `${u.componentKey ?? u.componentId} · ${u.slot} · ${mediaSetVariantLabel(u.variantDim, u.variantKey)} · ${mediaSetLocaleLabel(u.locale)} (${status} v${u.version})`;
}

/**
 * Lien admin vers l'onglet « Médias par audience » du composant, ou `null`
 * si le composant a disparu.
 */
export function mediaSetUsageHref(u: Pick<MediaSetUsageLike, 'componentKey'>): string | null {
  return u.componentKey
    ? `/admin/components/${encodeURIComponent(u.componentKey)}#medias-par-audience`
    : null;
}
