/**
 * Autocomplete des variables `{{ … }}` de l'éditeur de template (F07 P3.4-d,
 * Lot 2, assistance G11) — PUR (pas de DOM).
 *
 * Détecte si le curseur est DANS un jeton Handlebars ouvert (`{{partiel`) et,
 * le cas échéant, applique une complétion. Syntaxe custom `{{cle}}` (clés
 * alphanumériques, sans point/espace — ≠ merge-tags Listmonk `{{ .X }}`).
 */

/**
 * Si le curseur est dans un `{{` non fermé, renvoie le texte partiel saisi et
 * l'index du `{{` ; sinon null. Un espace, un point, un `}}` ou un nouveau `{{`
 * interrompent le jeton (→ null).
 */
export function activeMergeQuery(
  value: string,
  cursor: number,
): { query: string; start: number } | null {
  const pos = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, pos);
  const open = before.lastIndexOf('{{');
  if (open === -1) return null;
  const between = before.slice(open + 2);
  if (between.includes('}}')) return null; // déjà fermé
  if (!/^[A-Za-z0-9_]*$/.test(between)) return null; // espace/point/etc. → pas un jeton custom
  return { query: between, start: open };
}

/**
 * Remplace le jeton ouvert au curseur par `{{key}}` (ou insère `{{key}}` au
 * curseur si aucun jeton n'est ouvert). Consomme un `}}` déjà présent juste
 * après le curseur pour éviter `{{key}}}}`.
 */
export function applyMergeCompletion(
  value: string,
  cursor: number,
  key: string,
): { value: string; cursor: number } {
  const token = `{{${key}}}`;
  const pos = Math.max(0, Math.min(cursor, value.length));
  const active = activeMergeQuery(value, pos);
  if (!active) {
    return { value: value.slice(0, pos) + token + value.slice(pos), cursor: pos + token.length };
  }
  const endCut = value.slice(pos, pos + 2) === '}}' ? pos + 2 : pos;
  const next = value.slice(0, active.start) + token + value.slice(endCut);
  return { value: next, cursor: active.start + token.length };
}
