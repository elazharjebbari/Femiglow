/**
 * Cache tags pour pages légales.
 *
 * On utilise `unstable_cache` (Next.js) avec ces tags pour mémoïser les
 * lectures publiques. `revalidateTag` est appelé sur publish, patch admin,
 * placements PUT et template-vars PUT pour invalider de façon ciblée.
 *
 * Granularité :
 *  - `legal-page:<slug>` : rendu HTML + métadonnées d'UNE page → invalidé
 *    sur publish/patch de cette page + sur PUT d'une template var
 *    référencée dans cette page (en pratique on flush global pour vars).
 *  - `legal-zone:<zoneKey>` : liste des placements d'une zone → invalidé
 *    sur PUT placement touchant cette zone, ou sur publish d'une page
 *    placée dans cette zone.
 *  - `legal-pages-published` : tag global ; revalidé sur tout publish (le
 *    sitemap et la liste publiée en dépendent).
 */
export const LEGAL_PAGE_TAG = (slug: string): string => `legal-page:${slug}`;
export const LEGAL_ZONE_TAG = (zoneKey: string): string => `legal-zone:${zoneKey}`;
export const LEGAL_PUBLISHED_TAG = 'legal-pages-published';
export const LEGAL_VARS_TAG = 'legal-template-vars';
