/**
 * Liste statique des pays (ISO 3166-1 alpha-2) ciblables par la règle
 * `country`. Source de vérité unique côté builder UX4 (UX-AUD-009) : un
 * code hors de cette liste compile en FALSE dans rules-compiler.ts
 * (COUNTRY_CALLING_CODE) → audience vide silencieuse. On valide donc chaque
 * code contre cette liste AVANT de l'accepter dans un multi-select.
 *
 * NB : `CountryAutocomplete.tsx` (gelé pour ce chantier) embarque sa propre
 * copie en `datalist`. Cette liste-ci est volontairement alignée code-pour-code
 * sur celle-là ET sur `COUNTRY_CALLING_CODE` du compilateur (les 21 marchés
 * Maroc + diaspora). Un test garde-fou (UX4-AUDIENCES-009) épingle l'alignement.
 */
export type CountryEntry = { code: string; name: string; flag: string };

export const COUNTRIES: readonly CountryEntry[] = [
  { code: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'EG', name: 'Égypte', flag: '🇪🇬' },
  { code: 'AE', name: 'Émirats arabes unis', flag: '🇦🇪' },
  { code: 'SA', name: 'Arabie saoudite', flag: '🇸🇦' },
] as const;

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Code pays connu (validable, donc compilable en non-FALSE) ? */
export function isKnownCountry(code: string): boolean {
  return BY_CODE.has(code.trim().toUpperCase());
}

/** Métadonnées d'un code pays (nom FR + drapeau), ou undefined si inconnu. */
export function countryEntry(code: string): CountryEntry | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}

/** Libellé lisible FR d'un code : "🇲🇦 Maroc" si connu, sinon le code brut. */
export function countryLabel(code: string): string {
  const e = countryEntry(code);
  return e ? `${e.flag} ${e.name}` : code.toUpperCase();
}
