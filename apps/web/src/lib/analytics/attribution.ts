/**
 * Attribution analytics — classification du trafic en buckets normalisés.
 *
 * Sources :
 * 1. UTM params (priorité la plus haute) — `utm_source` + `utm_medium`
 * 2. Document referrer (fallback)
 * 3. "direct" (fallback ultime)
 *
 * Buckets stables (jamais renommés sans migration) :
 * - direct, google, bing, meta, tiktok, snap, pinterest, twitter, linkedin
 * - email, affiliate, other
 *
 * cf. docs/analytics/02-data-model.md §3.3
 */

export type TrafficBucket =
  | 'direct'
  | 'google'
  | 'bing'
  | 'duckduckgo'
  | 'meta'
  | 'tiktok'
  | 'snap'
  | 'pinterest'
  | 'twitter'
  | 'linkedin'
  | 'youtube'
  | 'email'
  | 'affiliate'
  | 'other';

export interface UtmParams {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

export interface ClassifyInput {
  utm?: UtmParams | null;
  referrer?: string | null;
}

export interface ClassifyResult {
  source: TrafficBucket;
  medium: string | null;
}

/**
 * Mapping host fragment → bucket. Les clés sont des sous-chaînes recherchées
 * dans le hostname du referrer. L'ordre est important : on prend le PREMIER
 * match (du plus spécifique au plus général).
 */
const REFERRER_HOST_MAP: Array<[RegExp, TrafficBucket]> = [
  [/(^|\.)google\./i, 'google'],
  [/(^|\.)bing\./i, 'bing'],
  [/(^|\.)duckduckgo\./i, 'duckduckgo'],
  [/(^|\.)(facebook|instagram|messenger|fb|meta)\./i, 'meta'],
  [/(^|\.)(tiktok)\./i, 'tiktok'],
  [/(^|\.)(snapchat|snap)\./i, 'snap'],
  [/(^|\.)pinterest\./i, 'pinterest'],
  [/(^|\.)(twitter|x|t)\.co/i, 'twitter'],
  [/(^|\.)twitter\./i, 'twitter'],
  [/(^|\.)linkedin\./i, 'linkedin'],
  [/(^|\.)(youtube|youtu)\./i, 'youtube'],
];

/**
 * Mapping utm_source (lowercased) → bucket. Match exact ou par sous-chaîne.
 */
const UTM_SOURCE_MAP: Array<[RegExp, TrafficBucket]> = [
  [/^google($|[_-])/, 'google'],
  [/^bing($|[_-])/, 'bing'],
  [/^duckduckgo($|[_-])/, 'duckduckgo'],
  [/^(facebook|instagram|fb|meta|messenger)($|[_-])/, 'meta'],
  [/^tiktok($|[_-])/, 'tiktok'],
  [/^(snap|snapchat)($|[_-])/, 'snap'],
  [/^pinterest($|[_-])/, 'pinterest'],
  [/^(twitter|x)($|[_-])/, 'twitter'],
  [/^linkedin($|[_-])/, 'linkedin'],
  [/^youtube($|[_-])/, 'youtube'],
];

/**
 * Mapping utm_medium → bucket (lorsque utm_source est inconnu).
 */
const UTM_MEDIUM_MAP: Array<[RegExp, TrafficBucket]> = [
  [/^email$/i, 'email'],
  [/^newsletter$/i, 'email'],
  [/^affiliate(s)?$/i, 'affiliate'],
  [/^partner(s)?$/i, 'affiliate'],
];

function safeUrl(input: string): URL | null {
  try {
    // Accepte les hostnames bruts (rare) ; on préfixe https si nécessaire.
    const candidate = input.includes('://') ? input : `https://${input}`;
    return new URL(candidate);
  } catch {
    return null;
  }
}

function bucketFromReferrer(referrer: string | null | undefined): TrafficBucket | null {
  if (!referrer) return null;
  const url = safeUrl(referrer);
  if (!url) return null;
  for (const [re, bucket] of REFERRER_HOST_MAP) {
    if (re.test(url.hostname)) return bucket;
  }
  // Tout referrer non listé = "other" (ce n'est pas direct).
  return 'other';
}

function bucketFromUtmSource(source: string | null | undefined): TrafficBucket | null {
  if (!source) return null;
  const lower = source.toLowerCase().trim();
  if (!lower) return null;
  for (const [re, bucket] of UTM_SOURCE_MAP) {
    if (re.test(lower)) return bucket;
  }
  return null;
}

function bucketFromUtmMedium(medium: string | null | undefined): TrafficBucket | null {
  if (!medium) return null;
  for (const [re, bucket] of UTM_MEDIUM_MAP) {
    if (re.test(medium)) return bucket;
  }
  return null;
}

/**
 * Normalise un input (UTM + referrer) en bucket source + medium.
 * Règles (par priorité) :
 *  1. utm_source connu → bucket associé
 *  2. utm_medium connu (email/affiliate) → bucket associé
 *  3. utm_source présent mais inconnu → 'other'
 *  4. referrer présent → host map → 'google'/'meta'/.../'other'
 *  5. rien → 'direct'
 */
export function classifyTraffic(input: ClassifyInput): ClassifyResult {
  const utm = input.utm ?? {};
  const utmSource = utm.utm_source?.trim() ?? null;
  const utmMedium = utm.utm_medium?.trim() ?? null;

  // Priorité 1 — utm_source connu
  const fromUtmSource = bucketFromUtmSource(utmSource);
  if (fromUtmSource) {
    return { source: fromUtmSource, medium: utmMedium };
  }

  // Priorité 2 — utm_medium connu (email/affiliate)
  const fromUtmMedium = bucketFromUtmMedium(utmMedium);
  if (fromUtmMedium) {
    return { source: fromUtmMedium, medium: utmMedium };
  }

  // Priorité 3 — utm_source présent mais non reconnu
  if (utmSource) {
    return { source: 'other', medium: utmMedium };
  }

  // Priorité 4 — referrer
  const fromReferrer = bucketFromReferrer(input.referrer);
  if (fromReferrer) {
    return { source: fromReferrer, medium: utmMedium };
  }

  // Priorité 5 — direct (mais on conserve utm_medium s'il est présent : il
  // peut être utile pour la traçabilité (ex : medium=cpc sans utm_source).
  return { source: 'direct', medium: utmMedium };
}

/**
 * Liste exhaustive des buckets pour les filtres UI.
 */
export const TRAFFIC_BUCKETS: ReadonlyArray<TrafficBucket> = [
  'direct',
  'google',
  'bing',
  'duckduckgo',
  'meta',
  'tiktok',
  'snap',
  'pinterest',
  'twitter',
  'linkedin',
  'youtube',
  'email',
  'affiliate',
  'other',
];

export function isTrafficBucket(value: unknown): value is TrafficBucket {
  return typeof value === 'string' && (TRAFFIC_BUCKETS as readonly string[]).includes(value);
}
