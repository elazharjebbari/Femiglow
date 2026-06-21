/**
 * Dédup de slug à la duplication d'un template (F07 P3.4-l, Lot 6).
 *
 * Le slug est UNIQUE en base, indépendamment du soft-delete (`deletedAt`) — la
 * dédup doit donc considérer TOUS les slugs existants, y compris supprimés, sous
 * peine de violation de contrainte à l'INSERT. Helper PUR (testable hors DB).
 */

/** Suffixe « -copie » ou « -copie-N » à amputer pour éviter `…-copie-copie`. */
const COPY_SUFFIX = /-copie(?:-(\d+))?$/;

/** Nom lisible d'une copie (`Bienvenue` → `Bienvenue (copie)`). */
export function duplicateName(name: string): string {
  return `${name} (copie)`;
}

/**
 * Premier slug libre dérivé de `sourceSlug` :
 *   `welcome` → `welcome-copie`, puis `welcome-copie-2`, `-3`…
 * Dupliquer une copie repart de la racine (`welcome-copie` → `welcome-copie-2`),
 * jamais `welcome-copie-copie`.
 */
export function nextDuplicateSlug(sourceSlug: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const root = sourceSlug.replace(COPY_SUFFIX, '') || sourceSlug;
  let candidate = `${root}-copie`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${root}-copie-${n}`;
    n += 1;
  }
  return candidate;
}
