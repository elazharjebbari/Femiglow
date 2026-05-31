/**
 * Masque téléphone live FR (`06 12 34 56 78`).
 *
 * Convertit toute séquence de chiffres en groupes de 2 séparés par
 * espace standard. Max 10 digits enforcé (formats marocains 06… / 07…
 * ou français 06… / 07…).
 *
 * Idempotent : `formatPhoneFR(formatPhoneFR(x)) === formatPhoneFR(x)`
 * (les espaces sont retirés à chaque appel avant re-formatage).
 */
export function formatPhoneFR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

/**
 * Inverse de `formatPhoneFR` — retourne uniquement les chiffres.
 * Utile pour passer la valeur RAW au schema Zod existant
 * (`phoneMaroc9DigitsSchema`).
 */
export function parsePhoneFR(masked: string): string {
  return masked.replace(/\D/g, '');
}
