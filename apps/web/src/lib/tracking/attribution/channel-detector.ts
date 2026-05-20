/**
 * Détection du canal d'acquisition d'un visiteur à partir de l'URL
 * et du référent. Pure function — testable sans navigateur.
 *
 * Règles ordonnées par priorité (1ère qui matche gagne). Cf.
 * docs/tracking-attribution/04-data-and-engine.md pour la spec.
 */
import {
  ATTRIBUTION_CHANNELS,
  channelTouchSchema,
  type AttributionChannel,
  type ChannelTouch,
  type ClickIdField,
  type Utm,
  PAID_CHANNELS,
} from './types';

export interface DetectInput {
  url: URL | string;
  referrer?: string | null;
  /** ISO timestamp — surrogate pour tests. */
  now?: Date;
}

const PAID_MEDIA_RX = /^(cpc|ppc|paid|cpv|cpa|cpm|display|social_paid)$/i;

function parseUtm(params: URLSearchParams): Utm | undefined {
  const utm: Utm = {};
  let hasAny = false;
  for (const k of ['source', 'medium', 'campaign', 'term', 'content'] as const) {
    const v = params.get(`utm_${k}`);
    if (v) {
      utm[k] = v.slice(0, 120);
      hasAny = true;
    }
  }
  return hasAny ? utm : undefined;
}

function channelFromUtmSource(source: string): AttributionChannel | null {
  const s = source.toLowerCase();
  if (/^(google)$/.test(s)) return 'google_ads';
  if (/(facebook|^fb$|meta|instagram|^ig$)/.test(s)) return 'meta';
  if (/tiktok/.test(s)) return 'tiktok';
  if (/snap/.test(s)) return 'snap';
  if (/pinterest/.test(s)) return 'pinterest';
  if (/(bing|microsoft)/.test(s)) return 'bing_ads';
  return null;
}

function referrerCategory(referrer: string): 'organic' | 'social_organic' | null {
  try {
    const url = new URL(referrer);
    const host = url.host.toLowerCase();
    if (/(google\.|bing\.|duckduckgo\.|yahoo\.|qwant\.|ecosia\.|brave\.)/.test(host)) {
      return 'organic';
    }
    if (/(facebook|instagram|tiktok|snapchat|pinterest|twitter|x\.com|linkedin|reddit|youtube)/.test(host)) {
      return 'social_organic';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Détecte le canal d'un touch (visite). Renvoie toujours un touch
 * valide (worst case → `direct`).
 */
export function detectChannel(input: DetectInput): ChannelTouch {
  const url = typeof input.url === 'string' ? new URL(input.url) : input.url;
  const params = url.searchParams;
  const referrer = input.referrer ?? undefined;
  const landing_path = url.pathname + (url.search || '');
  const detected_at = (input.now ?? new Date()).toISOString();
  const utm = parseUtm(params);

  // 1. Click IDs (preuve absolue)
  const gclid = params.get('gclid') ?? params.get('gbraid') ?? params.get('wbraid');
  if (gclid) {
    const click_id_field: ClickIdField = params.get('gclid')
      ? 'gclid'
      : params.get('gbraid')
        ? 'gbraid'
        : 'wbraid';
    return validate({
      channel: 'google_ads',
      is_paid: true,
      click_id: gclid.slice(0, 512),
      click_id_field,
      utm,
      referrer,
      landing_path,
      detected_at,
    });
  }
  const fbclid = params.get('fbclid');
  if (fbclid) {
    return validate({
      channel: 'meta',
      is_paid: true,
      click_id: fbclid.slice(0, 512),
      click_id_field: 'fbclid',
      utm,
      referrer,
      landing_path,
      detected_at,
    });
  }
  const ttclid = params.get('ttclid');
  if (ttclid) {
    return validate({
      channel: 'tiktok',
      is_paid: true,
      click_id: ttclid.slice(0, 512),
      click_id_field: 'ttclid',
      utm,
      referrer,
      landing_path,
      detected_at,
    });
  }
  const sccid = params.get('ScCid') ?? params.get('sccid');
  if (sccid) {
    return validate({
      channel: 'snap',
      is_paid: true,
      click_id: sccid.slice(0, 512),
      click_id_field: 'sccid',
      utm,
      referrer,
      landing_path,
      detected_at,
    });
  }
  const epik = params.get('epik');
  if (epik) {
    return validate({
      channel: 'pinterest',
      is_paid: true,
      click_id: epik.slice(0, 512),
      click_id_field: 'epik',
      utm,
      referrer,
      landing_path,
      detected_at,
    });
  }
  const msclkid = params.get('msclkid');
  if (msclkid) {
    return validate({
      channel: 'bing_ads',
      is_paid: true,
      click_id: msclkid.slice(0, 512),
      click_id_field: 'msclkid',
      utm,
      referrer,
      landing_path,
      detected_at,
    });
  }

  // 2. UTM paid medium
  if (utm?.medium && PAID_MEDIA_RX.test(utm.medium)) {
    const ch = utm.source ? channelFromUtmSource(utm.source) : null;
    if (ch) {
      return validate({
        channel: ch,
        is_paid: PAID_CHANNELS.has(ch),
        utm,
        referrer,
        landing_path,
        detected_at,
      });
    }
  }

  // 3. UTM email / newsletter
  if (utm?.medium === 'email' || utm?.source === 'newsletter') {
    return validate({
      channel: 'email',
      is_paid: false,
      utm,
      referrer,
      landing_path,
      detected_at,
    });
  }

  // 4. Referrer (organic / social_organic)
  if (referrer) {
    const cat = referrerCategory(referrer);
    if (cat) {
      return validate({
        channel: cat,
        is_paid: false,
        referrer,
        utm,
        landing_path,
        detected_at,
      });
    }
  }

  // 5. Direct fallback
  return validate({
    channel: 'direct',
    is_paid: false,
    referrer,
    utm,
    landing_path,
    detected_at,
  });
}

function validate(touch: ChannelTouch): ChannelTouch {
  // Zod parse — paranoia : si une règle a glissé une valeur invalide,
  // on rejette avant qu'elle pollue la base.
  const result = channelTouchSchema.safeParse(touch);
  if (!result.success) {
    // Fallback de sécurité : direct sans data.
    return {
      channel: 'direct',
      is_paid: false,
      detected_at: touch.detected_at,
    };
  }
  return result.data;
}

/** Helper pour les tests + l'UI debugger : valide une string contre l'enum. */
export function isAttributionChannel(value: string): value is AttributionChannel {
  return (ATTRIBUTION_CHANNELS as readonly string[]).includes(value);
}
