/**
 * Échappe les métacaractères LIKE pour neutraliser l'injection de wildcard.
 *
 * Extrait de `recipients-autocomplete/route.ts` : un fichier route.ts ne peut
 * exporter que les champs Route valides (GET, runtime, …) — `next build`
 * rejette tout export supplémentaire, et trois autres routes importaient ce
 * helper depuis la route.
 */
export function escapeLikePrefix(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}
