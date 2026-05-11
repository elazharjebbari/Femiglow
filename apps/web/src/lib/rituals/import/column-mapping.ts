/**
 * Mapping interactif des colonnes source vers les champs canoniques rituel.
 * Cf. docs/reviews-wall/execution/13-import-system-architecture.md § 7.2
 */

export const CANONICAL_FIELDS = [
  'body',
  'wouldRecommend',
  'ritualTags',
  'authorFirstName',
  'authorCity',
  'initiatedSince',
  'isAnonymous',
  'language',
  'productKey',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

const REQUIRED: ReadonlySet<CanonicalField> = new Set(['body', 'wouldRecommend']);

/** Synonymes acceptés pour la détection automatique du mapping. */
const SYNONYMS: Record<CanonicalField, string[]> = {
  body: ['body', 'message', 'avis', 'témoignage', 'temoignage', 'texte', 'review'],
  wouldRecommend: [
    'wouldRecommend',
    'recommandation',
    'reco',
    'recommend',
    'rating',
    'signal',
  ],
  ritualTags: ['ritualTags', 'tags', 'mots-clés', 'mots-cles', 'motscles', 'keywords'],
  authorFirstName: [
    'authorFirstName',
    'prénom',
    'prenom',
    'firstName',
    'first_name',
    'name',
  ],
  authorCity: ['authorCity', 'ville', 'city', 'location'],
  initiatedSince: [
    'initiatedSince',
    'date initiée',
    'date initiee',
    'date',
    'depuis',
    'initiée depuis',
  ],
  isAnonymous: ['isAnonymous', 'anonyme', 'anonymous'],
  language: ['language', 'langue', 'lang'],
  productKey: ['productKey', 'pack', 'product', 'produit'],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Pour chaque en-tête source, propose le champ canonique le plus probable
 * (ou `null` si non reconnu).
 */
export function autoDetectMapping(
  headers: string[],
): Record<string, CanonicalField | null> {
  const result: Record<string, CanonicalField | null> = {};
  for (const header of headers) {
    const normalized = normalize(header);
    let matched: CanonicalField | null = null;
    for (const field of CANONICAL_FIELDS) {
      if (SYNONYMS[field].some((s) => normalize(s) === normalized)) {
        matched = field;
        break;
      }
    }
    result[header] = matched;
  }
  return result;
}

/**
 * Vrai si tous les champs canoniques requis sont mappés au moins une fois.
 */
export function hasRequiredFields(
  mapping: Record<string, CanonicalField | null>,
): boolean {
  const mappedFields = new Set(
    Object.values(mapping).filter((v): v is CanonicalField => v !== null),
  );
  for (const required of REQUIRED) {
    if (!mappedFields.has(required)) return false;
  }
  return true;
}

/**
 * Applique le mapping sur une row source : renvoie une row au format canonique.
 */
export function applyColumnMapping(
  raw: Record<string, unknown>,
  mapping: Record<string, CanonicalField | null>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [sourceCol, value] of Object.entries(raw)) {
    const target = mapping[sourceCol];
    if (target) out[target] = value;
  }
  return out;
}

export { REQUIRED as REQUIRED_FIELDS };
