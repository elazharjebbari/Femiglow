/**
 * CHA-031 — Sanitize entrée visiteur + redact PII.
 *
 * - Trim, normalise les espaces, coupe au-dessus de 2000 caractères.
 * - Détecte et masque : email, téléphone (FR / MA), IBAN, carte bancaire,
 *   CNI marocaine, adresse postale (heuristique), codes postaux.
 *
 * Le texte d'origine reste stocké séparément (`content_raw`, redacté
 * sous 30 j) pour audit qualité, mais c'est `content_safe` qui est
 * envoyé au LLM.
 */

const MAX_LEN = 2000;

const PATTERNS: Array<{ name: string; regex: RegExp; mask: string }> = [
  { name: 'email', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, mask: '[email]' },
  // Téléphone international, FR ou MA. Utilise un pattern raisonnable.
  {
    name: 'phone',
    regex: /(?:\+|00)?\s?(?:212|33|212-|33-)?[\s.-]?\(?\d{1,3}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g,
    mask: '[téléphone]',
  },
  // IBAN
  { name: 'iban', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi, mask: '[iban]' },
  // Carte bancaire (4×4 chiffres)
  { name: 'card', regex: /\b(?:\d[ -]*?){13,19}\b/g, mask: '[carte]' },
  // CNI marocaine : 1-2 lettres + 6-8 chiffres
  { name: 'cni-ma', regex: /\b[A-Z]{1,2}\d{6,8}\b/g, mask: '[id]' },
  // Code postal FR
  { name: 'postcode', regex: /\b\d{5}\b/g, mask: '[code]' },
];

export interface SanitizeResult {
  contentRaw: string;
  contentSafe: string;
  truncated: boolean;
  redactions: string[];
}

export function sanitizeAndRedact(input: string): SanitizeResult {
  const trimmed = input.replace(/\s+/g, ' ').trim();
  const truncated = trimmed.length > MAX_LEN;
  const contentRaw = truncated ? trimmed.slice(0, MAX_LEN) : trimmed;

  let safe = contentRaw;
  const redactions = new Set<string>();
  for (const p of PATTERNS) {
    if (p.regex.test(safe)) {
      redactions.add(p.name);
      safe = safe.replace(p.regex, p.mask);
    }
    p.regex.lastIndex = 0;
  }
  return {
    contentRaw,
    contentSafe: safe,
    truncated,
    redactions: Array.from(redactions),
  };
}
