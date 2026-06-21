/**
 * Réduction du contexte de rendu en une carte clé→valeur AFFICHABLE pour le
 * panneau de variables de l'éditeur (F07 P3.4-f, assistance G11) — PUR.
 *
 * L'opérateur voit ce que chaque variable VAUT pour le contexte de preview
 * (« firstName → Fatima », « phone → (vide) »). On exclut `trigger` (imbriqué,
 * propre aux automations), on coerce en chaîne et on TRONQUE (le panneau n'est
 * pas un dump — et on ne déverse pas de longues valeurs/PII en entier).
 */
export function resolvedVarsMap(
  context: Record<string, unknown>,
  maxLen = 80,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(context)) {
    if (k === 'trigger') continue; // imbriqué (automation) — pas une variable plate
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    map[k] = s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  }
  return map;
}
