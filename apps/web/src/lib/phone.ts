/**
 * CHA-202 — Helper de normalisation et validation de numéros de téléphone.
 *
 * Cible : marché marocain en priorité (MA, ~95 % du trafic FemiGlow), avec
 * support léger des marchés diaspora (FR, BE, CH, DZ, TN).
 *
 * Note : nous n'utilisons pas `libphonenumber-js` ici pour éviter une dépendance
 * lourde (~600 KB compressés). Cette implémentation couvre les cas réels du
 * funnel et lève sur l'incertitude. Si la couverture devait s'élargir, swap
 * vers `parsePhoneNumberFromString(raw, hint)` est trivial — l'API publique
 * ci-dessous est un sous-ensemble strict.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §6.1
 */

export type CountryCode = 'MA' | 'FR' | 'BE' | 'CH' | 'DZ' | 'TN';

export interface NormalizedPhone {
  /** Format E.164 (`+212XXXXXXXXX`). */
  e164: string;
  /** Code ISO du pays détecté. */
  country: CountryCode;
  /** Indicatif national (sans `+`). */
  countryCallingCode: string;
  /** Numéro national (sans indicatif, sans 0). */
  national: string;
  /** Type détecté (mobile probable, fixe, indéterminé). */
  type: 'mobile' | 'fixed' | 'unknown';
}

export class PhoneParseError extends Error {
  readonly code:
    | 'empty'
    | 'too-short'
    | 'too-long'
    | 'invalid-chars'
    | 'unknown-country'
    | 'invalid-country-prefix'
    | 'invalid-national'
    | 'wrong-length-for-country';
  constructor(code: PhoneParseError['code'], message: string) {
    super(message);
    this.name = 'PhoneParseError';
    this.code = code;
  }
}

interface CountryRule {
  cc: CountryCode;
  callingCode: string; // ex. '212'
  /** Préfixes mobiles connus (premiers chiffres du numéro national). */
  mobilePrefixes: string[];
  /** Préfixes fixes (optionnel, pour le label). */
  fixedPrefixes?: string[];
  /** Longueur du numéro national (sans le 0 initial). */
  nationalLength: number | number[];
  /** Trunk prefix qu'on retire après le calling code (souvent '0'). */
  trunk?: string;
}

const COUNTRIES: CountryRule[] = [
  // Maroc — mobiles 6/7, fixes 5
  {
    cc: 'MA',
    callingCode: '212',
    mobilePrefixes: ['6', '7'],
    fixedPrefixes: ['5'],
    nationalLength: 9,
    trunk: '0',
  },
  // France — mobiles 6/7, fixes 1-5/9
  {
    cc: 'FR',
    callingCode: '33',
    mobilePrefixes: ['6', '7'],
    fixedPrefixes: ['1', '2', '3', '4', '5', '9'],
    nationalLength: 9,
    trunk: '0',
  },
  {
    cc: 'BE',
    callingCode: '32',
    mobilePrefixes: ['4'],
    fixedPrefixes: ['2', '3', '4', '5', '6', '7', '8', '9'],
    nationalLength: [8, 9],
    trunk: '0',
  },
  {
    cc: 'CH',
    callingCode: '41',
    mobilePrefixes: ['7'],
    fixedPrefixes: ['2', '3', '4', '5', '6', '8'],
    nationalLength: 9,
    trunk: '0',
  },
  {
    cc: 'DZ',
    callingCode: '213',
    mobilePrefixes: ['5', '6', '7'],
    fixedPrefixes: ['2', '3', '4'],
    nationalLength: 9,
    trunk: '0',
  },
  {
    cc: 'TN',
    callingCode: '216',
    mobilePrefixes: ['2', '4', '5', '9'],
    fixedPrefixes: ['7'],
    nationalLength: 8,
  },
];

const RULE_BY_CC: Record<CountryCode, CountryRule> = COUNTRIES.reduce(
  (acc, rule) => {
    acc[rule.cc] = rule;
    return acc;
  },
  {} as Record<CountryCode, CountryRule>,
);

/** Supprime espaces, tirets, parenthèses, points. Garde le `+` initial. */
export function stripFormatting(raw: string): string {
  if (!raw) return '';
  // Conserve seulement chiffres, plus le `+` en tête.
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return hasPlus ? `+${digits}` : digits;
}

function lengthMatches(rule: CountryRule, national: string): boolean {
  const len = national.length;
  if (Array.isArray(rule.nationalLength)) {
    return rule.nationalLength.includes(len);
  }
  return len === rule.nationalLength;
}

function classifyType(rule: CountryRule, national: string): 'mobile' | 'fixed' | 'unknown' {
  if (rule.mobilePrefixes.some((p) => national.startsWith(p))) return 'mobile';
  if (rule.fixedPrefixes?.some((p) => national.startsWith(p))) return 'fixed';
  return 'unknown';
}

/**
 * Parse + valide + normalise un numéro brut.
 *
 * `hint` est utilisé uniquement si le numéro n'a pas d'indicatif explicite
 * (`+` ou `00`) — sinon on laisse l'indicatif faire foi.
 *
 * @throws {PhoneParseError}
 */
export function parsePhone(raw: string, hint: CountryCode = 'MA'): NormalizedPhone {
  if (!raw || raw.trim().length === 0) {
    throw new PhoneParseError('empty', 'phone-empty');
  }
  const cleaned = stripFormatting(raw);
  // 00 international prefix → +
  let normalized = cleaned;
  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;

  // Filtre caractères invalides : seulement '+' optionnel + chiffres.
  if (!/^\+?\d+$/.test(normalized)) {
    throw new PhoneParseError('invalid-chars', 'phone-invalid-chars');
  }
  if (normalized.replace(/^\+/, '').length < 6) {
    throw new PhoneParseError('too-short', 'phone-too-short');
  }
  if (normalized.replace(/^\+/, '').length > 15) {
    throw new PhoneParseError('too-long', 'phone-too-long');
  }

  let rule: CountryRule | undefined;
  let nationalNumber: string;

  if (normalized.startsWith('+')) {
    const digits = normalized.slice(1);
    rule = COUNTRIES.find((r) => digits.startsWith(r.callingCode));
    if (!rule) throw new PhoneParseError('unknown-country', 'phone-unknown-country');
    nationalNumber = digits.slice(rule.callingCode.length);
  } else {
    rule = RULE_BY_CC[hint];
    if (!rule) throw new PhoneParseError('unknown-country', 'phone-unknown-country');
    nationalNumber = normalized;
  }

  // Strip trunk prefix si présent et requis par le pays
  if (rule.trunk && nationalNumber.startsWith(rule.trunk)) {
    nationalNumber = nationalNumber.slice(rule.trunk.length);
  }
  // Cas spécial : numéro saisi avec calling code MA en local sans `+` → enlève
  if (nationalNumber.startsWith(rule.callingCode)) {
    nationalNumber = nationalNumber.slice(rule.callingCode.length);
    if (rule.trunk && nationalNumber.startsWith(rule.trunk)) {
      nationalNumber = nationalNumber.slice(rule.trunk.length);
    }
  }

  if (!lengthMatches(rule, nationalNumber)) {
    throw new PhoneParseError('wrong-length-for-country', 'phone-wrong-length-for-country');
  }

  // Premier chiffre doit être un préfixe valide pour le pays
  const validPrefix =
    rule.mobilePrefixes.some((p) => nationalNumber.startsWith(p)) ||
    rule.fixedPrefixes?.some((p) => nationalNumber.startsWith(p));
  if (!validPrefix) {
    throw new PhoneParseError('invalid-national', 'phone-invalid-national');
  }

  const type = classifyType(rule, nationalNumber);
  const e164 = `+${rule.callingCode}${nationalNumber}`;
  return {
    e164,
    country: rule.cc,
    countryCallingCode: rule.callingCode,
    national: nationalNumber,
    type,
  };
}

/** Variante non lançante — renvoie `null` à la place d'une erreur. */
export function tryParsePhone(raw: string, hint: CountryCode = 'MA'): NormalizedPhone | null {
  try {
    return parsePhone(raw, hint);
  } catch {
    return null;
  }
}

/**
 * Format d'affichage local lisible.
 *
 *   parsePhone('0612345678', 'MA').toDisplay() → '+212 6 12 34 56 78'
 */
export function formatPhoneDisplay(phone: NormalizedPhone): string {
  const groups: string[] = [];
  const n = phone.national;
  if (phone.country === 'MA' || phone.country === 'FR') {
    groups.push(n.slice(0, 1), n.slice(1, 3), n.slice(3, 5), n.slice(5, 7), n.slice(7, 9));
  } else if (phone.country === 'BE') {
    groups.push(n.slice(0, 3), n.slice(3, 5), n.slice(5, 7), n.slice(7));
  } else {
    groups.push(n);
  }
  return `+${phone.countryCallingCode} ${groups.filter(Boolean).join(' ')}`.trim();
}
