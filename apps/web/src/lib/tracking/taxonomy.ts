/**
 * Taxonomie canal traffic — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Référence : `docs/attribution-fix-2026-05/02-vision-architecture.md`
 *
 * AUCUNE autre énumération canal ne doit exister dans le repo. Tous les
 * consommateurs (acquisition middleware, enrichEvent, channel-detector,
 * analytics overview, OverviewTopSources UI, backfill scripts) doivent
 * importer `TrafficBucket` + `classifyTraffic` + `BUCKET_LABELS` depuis
 * ce module.
 *
 * 14 buckets stables, alignés sur :
 *  - Standards GA4 (default channel grouping)
 *  - Besoins reporting interne FemiGlow
 *  - Capacités du middleware (click IDs supportés)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Buckets — énumération exhaustive et stable
// ─────────────────────────────────────────────────────────────────────────────

export const TRAFFIC_BUCKETS = [
  'direct',
  'organic_search',
  'paid_search',
  'organic_social',
  'paid_social',
  'email',
  'referral',
  'affiliate',
  'display',
  'video',
  'sms',
  'qr',
  'internal',
  'unknown',
] as const;

export type TrafficBucket = (typeof TRAFFIC_BUCKETS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Labels FR pour le reporting
// ─────────────────────────────────────────────────────────────────────────────

export const BUCKET_LABELS: Record<TrafficBucket, string> = {
  direct: 'Direct',
  organic_search: 'Recherche organique',
  paid_search: 'Recherche payante',
  organic_social: 'Réseaux sociaux',
  paid_social: 'Pub réseaux sociaux',
  email: 'Email',
  referral: 'Site référent',
  affiliate: 'Affiliation',
  display: 'Display / Bannières',
  video: 'Vidéo',
  sms: 'SMS',
  qr: 'QR code',
  internal: 'Interne FemiGlow',
  unknown: 'Indéterminé',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types entrée/sortie
// ─────────────────────────────────────────────────────────────────────────────

export interface TrafficClassificationInput {
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
  };
  clickIds?: {
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    fbclid?: string | null;
    ttclid?: string | null;
    msclkid?: string | null;
    sccid?: string | null;
    epik?: string | null;
  };
  referrer?: string | null;
}

export interface TrafficClassification {
  bucket: TrafficBucket;
  source: string;
  medium: string;
  campaign?: string;
  isPaid: boolean;
  /** high : click ID OU UTM stricts ; medium : referrer connu ; low : heuristique */
  confidence: 'high' | 'medium' | 'low';
}

// ─────────────────────────────────────────────────────────────────────────────
// Référentiels referrer → source/bucket
// ─────────────────────────────────────────────────────────────────────────────

const ORGANIC_SEARCH_HOSTS: Record<string, string> = {
  'google.': 'google',
  'bing.com': 'bing',
  'duckduckgo.com': 'duckduckgo',
  'qwant.com': 'qwant',
  'ecosia.org': 'ecosia',
  'yahoo.com': 'yahoo',
  'yandex.': 'yandex',
};

const SOCIAL_HOSTS: Record<string, string> = {
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'm.facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'linkedin.com': 'linkedin',
  'pinterest.com': 'pinterest',
  'snapchat.com': 'snapchat',
  'reddit.com': 'reddit',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
};

const VIDEO_HOSTS: Record<string, string> = {
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'vimeo.com': 'vimeo',
};

// ─────────────────────────────────────────────────────────────────────────────
// Classification principale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifie un trafic en `TrafficBucket` à partir des signaux disponibles.
 *
 * Priorité décroissante :
 *  1. Click IDs (gclid → paid_search, fbclid → paid_social, etc.) — high
 *  2. UTM medium/source explicites — high
 *  3. Referrer hostname connu — medium
 *  4. Fallback `direct` (no signals) ou `unknown` (signals présents mais non-mappés)
 *
 * Garantie : la fonction est **pure** (aucun I/O, idempotente, déterministe).
 */
export function classifyTraffic(
  input: TrafficClassificationInput,
): TrafficClassification {
  // 1. Click IDs — signal le plus fort, indique paid acquisition
  const gclid = input.clickIds?.gclid || input.clickIds?.gbraid || input.clickIds?.wbraid;
  if (gclid) {
    return {
      bucket: 'paid_search',
      source: 'google',
      medium: 'cpc',
      campaign: input.utm?.campaign ?? undefined,
      isPaid: true,
      confidence: 'high',
    };
  }
  if (input.clickIds?.msclkid) {
    return {
      bucket: 'paid_search',
      source: 'bing',
      medium: 'cpc',
      campaign: input.utm?.campaign ?? undefined,
      isPaid: true,
      confidence: 'high',
    };
  }
  if (input.clickIds?.fbclid) {
    return {
      bucket: 'paid_social',
      source: 'meta',
      medium: 'cpc',
      campaign: input.utm?.campaign ?? undefined,
      isPaid: true,
      confidence: 'high',
    };
  }
  if (input.clickIds?.ttclid) {
    return {
      bucket: 'paid_social',
      source: 'tiktok',
      medium: 'cpc',
      campaign: input.utm?.campaign ?? undefined,
      isPaid: true,
      confidence: 'high',
    };
  }
  if (input.clickIds?.sccid) {
    return {
      bucket: 'paid_social',
      source: 'snapchat',
      medium: 'cpc',
      campaign: input.utm?.campaign ?? undefined,
      isPaid: true,
      confidence: 'high',
    };
  }
  if (input.clickIds?.epik) {
    return {
      bucket: 'paid_social',
      source: 'pinterest',
      medium: 'cpc',
      campaign: input.utm?.campaign ?? undefined,
      isPaid: true,
      confidence: 'high',
    };
  }

  // 2. UTM — second signal le plus fort
  const utmSource = (input.utm?.source ?? '').toLowerCase().trim();
  const utmMedium = (input.utm?.medium ?? '').toLowerCase().trim();

  if (utmSource || utmMedium) {
    const bucket = bucketFromUtm(utmSource, utmMedium);
    return {
      bucket,
      source: utmSource || 'unknown',
      medium: utmMedium || 'unknown',
      campaign: input.utm?.campaign ?? undefined,
      isPaid: isPaidMedium(utmMedium),
      confidence: 'high',
    };
  }

  // 3. Referrer hostname
  if (input.referrer) {
    const refClassif = classifyFromReferrer(input.referrer);
    if (refClassif) return refClassif;
  }

  // 4. Fallback
  return {
    bucket: 'direct',
    source: 'direct',
    medium: 'none',
    isPaid: false,
    confidence: 'high',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping interop avec l'ancien AttributionChannel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mappe un `AttributionChannel` (taxonomie historique 10 valeurs utilisée
 * par `applyStrategy`) vers un `TrafficBucket` (taxonomie unifiée 14
 * valeurs).
 *
 * Note : `social_organic` peut être organic_social. `organic` reste flou
 * (sans referrer) → on suppose organic_search par défaut. `broadcast` n'a
 * pas de sens en bucket → unknown.
 */
export function bucketFromAttributionChannel(
  channel: string,
  isPaid: boolean,
): TrafficBucket {
  if (isPaid) {
    if (channel === 'google_ads' || channel === 'bing_ads') return 'paid_search';
    if (['meta', 'tiktok', 'snap', 'pinterest'].includes(channel)) return 'paid_social';
  }
  if (channel === 'email') return 'email';
  if (channel === 'social_organic') return 'organic_social';
  if (channel === 'organic') return 'organic_search';
  if (channel === 'direct') return 'direct';
  if (channel === 'broadcast') return 'unknown';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Détermine le bucket depuis (utm_source, utm_medium).
 *
 * Heuristiques alignées sur le default channel grouping GA4 :
 *  - medium=cpc|ppc|paidsearch → paid_search
 *  - medium=paidsocial|paid_social|cpc + source social → paid_social
 *  - medium=organic + source search engine → organic_search
 *  - medium=social|referral + source social → organic_social
 *  - medium=email|newsletter → email
 *  - medium=affiliate → affiliate
 *  - medium=display|banner|cpm → display
 *  - medium=video → video
 *  - medium=sms → sms
 *  - medium=qrcode|qr → qr
 *  - medium=internal → internal
 *  - Fallback : referral
 */
function bucketFromUtm(source: string, medium: string): TrafficBucket {
  if (!medium && !source) return 'unknown';

  // Medium-driven (le plus précis)
  if (['cpc', 'ppc', 'paidsearch', 'paid-search', 'paid_search'].includes(medium)) {
    return 'paid_search';
  }
  if (['paidsocial', 'paid-social', 'paid_social', 'cpv', 'social-paid'].includes(medium)) {
    return 'paid_social';
  }
  if (medium === 'organic') {
    // Organic + source social → organic_social, sinon organic_search
    if (isSocialSource(source)) return 'organic_social';
    return 'organic_search';
  }
  if (['social', 'social-network', 'social-media', 'sm'].includes(medium)) {
    return isPaidMedium(medium) ? 'paid_social' : 'organic_social';
  }
  if (['email', 'newsletter', 'mailing'].includes(medium)) return 'email';
  if (['affiliate', 'partner'].includes(medium)) return 'affiliate';
  if (['display', 'banner', 'cpm'].includes(medium)) return 'display';
  if (medium === 'video') return 'video';
  if (medium === 'sms') return 'sms';
  if (['qrcode', 'qr', 'qr-code'].includes(medium)) return 'qr';
  if (medium === 'internal') return 'internal';
  if (medium === 'referral') return 'referral';

  // Source-driven fallback
  if (isPaidSearchSource(source)) return 'paid_search';
  if (isSocialSource(source)) return 'organic_social';

  return 'referral';
}

function isPaidMedium(medium: string): boolean {
  return ['cpc', 'ppc', 'paidsearch', 'paidsocial', 'paid-social', 'paid_social', 'cpv', 'cpm', 'display', 'banner'].includes(medium);
}

function isPaidSearchSource(source: string): boolean {
  return ['google_ads', 'googleads', 'adwords', 'bing_ads', 'bingads'].includes(source);
}

function isSocialSource(source: string): boolean {
  const s = source.toLowerCase();
  return [
    'facebook', 'meta', 'instagram', 'ig', 'tiktok', 'twitter', 'x',
    'linkedin', 'pinterest', 'snapchat', 'snap', 'reddit',
  ].includes(s);
}

/**
 * Classifie depuis une URL referrer.
 * Retourne null si le hostname est inconnu (l'appelant tombe sur 'direct').
 */
function classifyFromReferrer(referrer: string): TrafficClassification | null {
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  // Organic search
  for (const [pattern, source] of Object.entries(ORGANIC_SEARCH_HOSTS)) {
    if (host.includes(pattern)) {
      return {
        bucket: 'organic_search',
        source,
        medium: 'organic',
        isPaid: false,
        confidence: 'medium',
      };
    }
  }

  // Social (organic by default — paid requires click ID or UTM)
  for (const [pattern, source] of Object.entries(SOCIAL_HOSTS)) {
    if (host === pattern || host.endsWith(`.${pattern}`)) {
      // Vidéo prend priorité pour YouTube/Vimeo
      if (pattern in VIDEO_HOSTS) {
        return {
          bucket: 'video',
          source,
          medium: 'referral',
          isPaid: false,
          confidence: 'medium',
        };
      }
      return {
        bucket: 'organic_social',
        source,
        medium: 'social',
        isPaid: false,
        confidence: 'medium',
      };
    }
  }

  // Référence générique
  return {
    bucket: 'referral',
    source: host,
    medium: 'referral',
    isPaid: false,
    confidence: 'low',
  };
}
