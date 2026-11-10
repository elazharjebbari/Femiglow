/**
 * Normalisation du téléphone avant hachage (Meta Advanced Matching, Google
 * Enhanced Conversions, TikTok) — format E.164 sans `+`, ex. `212612345678`.
 *
 * Module pur, partagé par le hachage serveur (`hashing.ts`) et navigateur
 * (`hashing-browser.ts`) : les deux doivent produire le MÊME hash.
 *
 * Le formulaire /kit réduit le numéro à ses 9 chiffres nationaux
 * (`612345678`) : sans la règle « 9 chiffres → 212 », le hash partait sans
 * indicatif et aucune plateforme ne reconnaissait la cliente (10/11/2026).
 */
export function normalizePhoneDigits(phone: string): string {
  const digits = toAsciiDigits(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('212')) return digits;
  // Format national marocain : 0 + 9 chiffres.
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
  // Numéro national sans le 0 (mobile 6/7, fixe 5) : 9 chiffres.
  if (/^[5-7]\d{8}$/.test(digits)) return `212${digits}`;
  return digits;
}

/** Chiffres arabes orientaux (٠-٩) et persans (۰-۹) → ASCII. */
function toAsciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}
