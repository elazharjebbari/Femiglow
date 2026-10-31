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

/**
 * Normalise un numéro marocain saisi/auto-complété vers sa forme **locale
 * d'affichage** (`0` + 9 chiffres nationaux, ex. `0612345678`), **sans
 * tronquer** les formats internationaux. Indispensable au masque : sinon
 * `+212…` / `00212…` (12–14 chiffres) seraient coupés à 10 → numéro illisible.
 *
 * Couvre : `+212XXXXXXXXX`, `00212XXXXXXXXX`, local `0XXXXXXXXX`, national
 * `XXXXXXXXX`, et ce que seuls l'autofill et les contacts envoient : le zéro
 * conservé après l'indicatif (`+212 (0)6…`), les chiffres arabes. Tolère la
 * **saisie progressive** : ne strippe pas le `0` local (l'utilisateur qui tape
 * « 0 » le voit rester). Max 10 chiffres en sortie.
 *
 * Idempotent : `f(f(x)) === f(x)`.
 *
 * NB : les indicatifs non marocains (ex. France `+33` / `0033`) ne sont pas
 * convertis — ils restent tels quels et seront rejetés par la validation Maroc.
 */
export function toLocalMoroccanDigits(input: string): string {
  let d = toLatinDigits(input).replace(/\D/g, '');
  const international = /^(?:00)?212(.*)$/u.exec(d); // `+212…` (le `+` est retiré par le strip)
  if (international) d = `0${(international[1] ?? '').replace(/^0+/u, '')}`;
  else if (/^[5-7]\d{8}$/u.test(d)) d = `0${d}`;
  return d.slice(0, 10);
}

/** Chiffres arabes et persans vers chiffres latins : `\d` ne les voit pas. */
function toLatinDigits(input: string): string {
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/gu, (c) =>
    String(c.charCodeAt(0) % 16),
  );
}
