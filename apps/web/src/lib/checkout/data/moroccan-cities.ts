/**
 * CHA-231 — Liste de villes marocaines bilingue (FR + AR) pour le combobox
 * d'adresse du wizard checkout.
 *
 * Conception
 * ──────────
 * - **value**       : slug stable (kebab-case), utilisé pour les events tracking
 *                     (`city_code`), la disponibilité express, et le code postal
 *                     optionnel. Ce slug n'est PAS envoyé au serveur — le serveur
 *                     reçoit le `label` humanisé via l'input libre du combobox.
 * - **label**       : forme affichée en FR (accents conservés).
 * - **labelAr**     : forme affichée en arabe (orthographe canonique MENA).
 * - **aliases**     : orthographes alternatives ou abrégées que les utilisateurs
 *                     tapent couramment (FR ou translittérations) — utilisées
 *                     pour le matching côté combobox.
 * - **expressEligible** : marqueur pour la livraison express, conservé pour
 *                     évolutivité future bien que CHA-231 n'affiche qu'un mode
 *                     unique (24-48h gratuit partout).
 *
 * Matching
 * ────────
 * `matchCity(input)` reconnaît :
 *   - la forme FR canonique (insensible aux accents + casse)
 *   - la forme AR canonique (insensible aux tashkil + ال initial)
 *   - n'importe quel alias enregistré
 *
 * Le résultat est TOUJOURS la `MoroccanCity` canonique : le serveur reçoit donc
 * le label FR même si l'utilisateur a tapé en arabe (cohérence des analytics et
 * réutilisation des transporteurs FR-only).
 *
 * Cette source est volontairement intégrée au bundle (pas d'API call) — la liste
 * est stable et la latence d'une API serait pire que les ~2 KB gzip.
 */

export interface MoroccanCity {
  /** Slug stable utilisé en tracking + matching disponibilité express. */
  value: string;
  /** Libellé affiché en français (accents conservés). */
  label: string;
  /** Libellé affiché en arabe (orthographe canonique). */
  labelAr: string;
  /** Orthographes alternatives reconnues au matching (FR ou translittérations). */
  aliases?: string[];
  /** Éligible à la livraison express (24-48h) — conservé pour évolution future. */
  expressEligible: boolean;
}

export const MOROCCAN_CITIES: ReadonlyArray<MoroccanCity> = [
  {
    value: 'agadir',
    label: 'Agadir',
    labelAr: 'أكادير',
    aliases: ['أغادير'],
    expressEligible: false,
  },
  {
    value: 'beni-mellal',
    label: 'Béni Mellal',
    labelAr: 'بني ملال',
    aliases: ['Beni Mellal'],
    expressEligible: false,
  },
  {
    value: 'casablanca',
    label: 'Casablanca',
    labelAr: 'الدار البيضاء',
    aliases: ['Casa', 'Dar el Beida', 'Dar el Beïda', 'Dar Beida'],
    expressEligible: true,
  },
  {
    value: 'el-jadida',
    label: 'El Jadida',
    labelAr: 'الجديدة',
    aliases: ['Mazagan'],
    expressEligible: false,
  },
  {
    value: 'errachidia',
    label: 'Errachidia',
    labelAr: 'الراشيدية',
    expressEligible: false,
  },
  {
    value: 'essaouira',
    label: 'Essaouira',
    labelAr: 'الصويرة',
    aliases: ['Mogador'],
    expressEligible: false,
  },
  {
    value: 'fes',
    label: 'Fès',
    labelAr: 'فاس',
    aliases: ['Fez'],
    expressEligible: false,
  },
  {
    value: 'kenitra',
    label: 'Kénitra',
    labelAr: 'القنيطرة',
    aliases: ['Kenitra'],
    expressEligible: false,
  },
  {
    value: 'khouribga',
    label: 'Khouribga',
    labelAr: 'خريبكة',
    expressEligible: false,
  },
  {
    value: 'laayoune',
    label: 'Laâyoune',
    labelAr: 'العيون',
    aliases: ['Laayoune'],
    expressEligible: false,
  },
  {
    value: 'larache',
    label: 'Larache',
    labelAr: 'العرائش',
    expressEligible: false,
  },
  {
    value: 'marrakech',
    label: 'Marrakech',
    labelAr: 'مراكش',
    aliases: ['Marrakesh'],
    expressEligible: false,
  },
  {
    value: 'meknes',
    label: 'Meknès',
    labelAr: 'مكناس',
    aliases: ['Meknes'],
    expressEligible: false,
  },
  {
    value: 'mohammedia',
    label: 'Mohammedia',
    labelAr: 'المحمدية',
    expressEligible: true,
  },
  {
    value: 'nador',
    label: 'Nador',
    labelAr: 'الناظور',
    expressEligible: false,
  },
  {
    value: 'ouarzazate',
    label: 'Ouarzazate',
    labelAr: 'ورزازات',
    expressEligible: false,
  },
  {
    value: 'oujda',
    label: 'Oujda',
    labelAr: 'وجدة',
    expressEligible: false,
  },
  {
    value: 'rabat',
    label: 'Rabat',
    labelAr: 'الرباط',
    expressEligible: true,
  },
  {
    value: 'safi',
    label: 'Safi',
    labelAr: 'آسفي',
    aliases: ['Asfi'],
    expressEligible: false,
  },
  {
    value: 'sale',
    label: 'Salé',
    labelAr: 'سلا',
    aliases: ['Sale'],
    expressEligible: true,
  },
  {
    value: 'settat',
    label: 'Settat',
    labelAr: 'سطات',
    expressEligible: false,
  },
  {
    value: 'tanger',
    label: 'Tanger',
    labelAr: 'طنجة',
    aliases: ['Tangier', 'Tanja'],
    expressEligible: false,
  },
  {
    value: 'taza',
    label: 'Taza',
    labelAr: 'تازة',
    expressEligible: false,
  },
  {
    value: 'temara',
    label: 'Témara',
    labelAr: 'تمارة',
    aliases: ['Temara'],
    expressEligible: true,
  },
  {
    value: 'tetouan',
    label: 'Tétouan',
    labelAr: 'تطوان',
    aliases: ['Tetouan'],
    expressEligible: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise une saisie latine : NFD → retire diacritiques → lowercase + trim.
 * Ex : "Béni Mellal" → "beni mellal", "Casa" → "casa".
 */
export function normalizeCityKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Normalise une saisie arabe :
 *   - retire les tashkil (vocalisation : fatha, kasra, damma, sukun, shadda, tanwins)
 *   - retire le ال initial (article défini) — facultatif au matching
 *   - normalise les variantes de hamza / alef (أ إ آ ا → ا)
 *   - normalise la ta marbuta (ة → ه) — utile pour les saisies non standard
 *   - trim
 *
 * Ex :
 *   "الدارُ البيضاء"   → "دار بيضاء"
 *   "الرباط"          → "رباط"
 *   "آسفي"            → "اسفي"
 */
export function normalizeArabicKey(input: string): string {
  return input
    .normalize('NFKC')
    // Retire tashkil (U+064B → U+065F couvre l'essentiel)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '')
    // Normalise alef variantes
    .replace(/[\u0623\u0625\u0622]/gu, '\u0627') // أ إ آ → ا
    // Retire ال initial (au début seulement, après trim)
    .trim()
    .replace(/^ال/u, '')
    // Normalise ta marbuta → ha (tolérance)
    .replace(/\u0629/gu, '\u0647')
    // Retire les ZWNJ / ZWJ + autres formatages
    .replace(/[\u200B-\u200F\uFEFF]/gu, '')
    .trim();
}

/** Détecte si une saisie contient au moins un caractère du bloc arabe. */
function isArabicInput(input: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/u.test(input);
}

// ─────────────────────────────────────────────────────────────────────────────
// Indexation (construite une fois au chargement)
// ─────────────────────────────────────────────────────────────────────────────

const cityByNormalizedLabel = new Map<string, MoroccanCity>();
const cityByNormalizedLabelAr = new Map<string, MoroccanCity>();
const cityByNormalizedAlias = new Map<string, MoroccanCity>();
const cityByValue = new Map<string, MoroccanCity>();

for (const c of MOROCCAN_CITIES) {
  cityByNormalizedLabel.set(normalizeCityKey(c.label), c);
  cityByNormalizedLabelAr.set(normalizeArabicKey(c.labelAr), c);
  cityByValue.set(c.value, c);
  for (const alias of c.aliases ?? []) {
    // Indexe les alias selon leur script (latin vs arabe).
    if (isArabicInput(alias)) {
      cityByNormalizedLabelAr.set(normalizeArabicKey(alias), c);
    } else {
      cityByNormalizedAlias.set(normalizeCityKey(alias), c);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrouve une ville à partir d'un libellé libre (FR, AR, ou alias).
 * Insensible aux accents, casse, tashkil, et au ال initial.
 *
 * Retourne la `MoroccanCity` canonique (utilisable pour récupérer `label` FR,
 * `value` slug, ou `expressEligible`). Le serveur recevra `label` (FR).
 */
export function matchCity(input: string): MoroccanCity | null {
  if (!input) return null;
  if (isArabicInput(input)) {
    const key = normalizeArabicKey(input);
    return cityByNormalizedLabelAr.get(key) ?? null;
  }
  const key = normalizeCityKey(input);
  return (
    cityByNormalizedLabel.get(key) ??
    cityByNormalizedAlias.get(key) ??
    null
  );
}

/** Retrouve une ville à partir de son `value` slug. */
export function findCityByValue(value: string): MoroccanCity | null {
  return cityByValue.get(value) ?? null;
}

/**
 * Recherche par préfixe (top `limit` résultats). Matche sur label FR, label AR,
 * et aliases. Détecte automatiquement le script de la saisie.
 *
 * Utilisé par le combobox pour proposer des suggestions dynamiques.
 */
export function searchCities(query: string, limit = 8): MoroccanCity[] {
  const trimmed = query.trim();
  if (!trimmed) return MOROCCAN_CITIES.slice(0, limit);

  const arabic = isArabicInput(trimmed);
  const out: MoroccanCity[] = [];
  const seen = new Set<string>();

  if (arabic) {
    const qAr = normalizeArabicKey(trimmed);
    if (!qAr) return MOROCCAN_CITIES.slice(0, limit);
    for (const c of MOROCCAN_CITIES) {
      const labelKey = normalizeArabicKey(c.labelAr);
      const matches =
        labelKey.startsWith(qAr) ||
        (c.aliases ?? []).some(
          (a) => isArabicInput(a) && normalizeArabicKey(a).startsWith(qAr),
        );
      if (matches && !seen.has(c.value)) {
        out.push(c);
        seen.add(c.value);
        if (out.length >= limit) break;
      }
    }
  } else {
    const qFr = normalizeCityKey(trimmed);
    if (!qFr) return MOROCCAN_CITIES.slice(0, limit);
    for (const c of MOROCCAN_CITIES) {
      const labelKey = normalizeCityKey(c.label);
      const matches =
        labelKey.startsWith(qFr) ||
        (c.aliases ?? []).some(
          (a) => !isArabicInput(a) && normalizeCityKey(a).startsWith(qFr),
        );
      if (matches && !seen.has(c.value)) {
        out.push(c);
        seen.add(c.value);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}
