/**
 * Détecte une **correction** dans la saisie d'un champ.
 *
 * Une correction = l'utilisateur a fait demi-tour :
 *  - le champ avait du contenu, il devient vide  → correction
 *  - la longueur diminue de > 50 % en 1 frappe (paste then delete-all
 *    ou select-all + delete) → correction
 *
 * Une suppression normale (delete 1 char) N'est PAS une correction.
 *
 * Signal Kolenda (Attention #2) : nombre de corrections par session par
 * champ → identifie les champs friction. Émis via
 * `wizard_field_corrected`.
 */
export function detectCorrection(
  previousValue: string,
  newValue: string,
): boolean {
  if (previousValue.length === 0) return false;
  if (newValue.length === 0) return true;
  // Drop > 50 % en 1 frappe = correction (sinon delete normal).
  return newValue.length < previousValue.length * 0.5;
}
