/**
 * Source d'un lead pour l'admin : quel canal, et payant ou organique.
 *
 * Fonction pure, à partir de ce que `chat_lead` conserve. Elle ne devine jamais :
 * un clic Google n'était pas enregistré avant `SOURCE_CAPTURE_SINCE`, un ancien
 * lead venu de google.com peut donc être une annonce, et reste « non précisé ».
 */

export const LEAD_SOURCE_KINDS = ['paid', 'organic', 'ai', 'direct', 'unknown'] as const;
export type LeadSourceKind = (typeof LEAD_SOURCE_KINDS)[number];

export const LEAD_SOURCE_CHANNELS = [
  'instagram',
  'facebook',
  'meta_other',
  'youtube',
  'google_search',
  'google_other',
  'tiktok',
  'snapchat',
  'chatgpt',
  'ai_other',
  'pinterest',
  'bing',
  'other_search',
  'whatsapp',
  'email',
  'other_site',
  'direct',
  'unknown',
] as const;
export type LeadSourceChannel = (typeof LEAD_SOURCE_CHANNELS)[number];

export const LEAD_SOURCE_KIND_LABELS: Record<LeadSourceKind, string> = {
  paid: 'Payant',
  organic: 'Organique',
  ai: 'IA',
  direct: 'Direct',
  unknown: 'Non précisé',
};

export const LEAD_SOURCE_CHANNEL_LABELS: Record<LeadSourceChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  meta_other: 'Meta (autres)',
  youtube: 'YouTube',
  google_search: 'Google Search',
  google_other: 'Google (autres)',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  chatgpt: 'ChatGPT',
  ai_other: 'Autres IA',
  pinterest: 'Pinterest',
  bing: 'Bing',
  other_search: 'Autres moteurs',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  other_site: 'Autre site',
  direct: 'Accès direct',
  unknown: 'Non tracé',
};

/** Avant cette date, ni clic publicitaire ni UTM n'arrivaient sur le lead. */
export const SOURCE_CAPTURE_SINCE = new Date('2026-11-01T12:00:00Z');

export interface LeadSourceInput {
  gclid?: string | null;
  utm?: Record<string, string> | null;
  referrer?: string | null;
  createdAt: Date;
}

export interface LeadSource {
  channel: LeadSourceChannel;
  kind: LeadSourceKind;
  campaign: string | null;
  /** Nom d'hôte d'origine, s'il est connu (`instagram.com`). */
  site: string | null;
}

const PAID_MEDIUM_RX =
  /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|social_paid|paidsearch|paid_search|cpv|cpa|cpm|display|ads?)$/i;
const FREE_MEDIUM_RX = /^(organic|social|referral|bio|profile|post|story|email|e-mail|newsletter)$/i;

const AI_HOSTS: ReadonlyArray<[RegExp, LeadSourceChannel]> = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, 'chatgpt'],
  [
    /(^|\.)(perplexity\.ai|claude\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|deepseek\.com|grok\.com|meta\.ai|poe\.com|you\.com|mistral\.ai)$/,
    'ai_other',
  ],
];

/** Hôte sans `www.`, y compris les référents d'application Android. */
export function referrerHost(referrer: string | null | undefined): string | null {
  const raw = referrer?.trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^(www|m|l|lm)\./, '');
    return host || null;
  } catch {
    return null;
  }
}

function channelFromHost(host: string): LeadSourceChannel {
  for (const [rx, channel] of AI_HOSTS) if (rx.test(host)) return channel;
  if (/instagram/.test(host)) return 'instagram';
  if (/(^|\.)(threads\.net|threads\.com|messenger\.com)$|^com\.facebook\.orca$/.test(host)) {
    return 'meta_other';
  }
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$|^com\.facebook\./.test(host)) return 'facebook';
  if (/(^|\.)(youtube\.com|youtu\.be)$|^com\.google\.android\.youtube$/.test(host)) return 'youtube';
  if (/^(google\.[a-z.]+)$|^com\.google\.android\.googlequicksearchbox$/.test(host)) {
    return 'google_search';
  }
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google_other';
  if (/tiktok/.test(host)) return 'tiktok';
  if (/snapchat/.test(host)) return 'snapchat';
  if (/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/.test(host)) return 'pinterest';
  if (/(^|\.)bing\.com$/.test(host)) return 'bing';
  if (/(^|\.)(yahoo\.[a-z.]+|duckduckgo\.com|ecosia\.org|qwant\.com|brave\.com|yandex\.[a-z.]+)$/.test(host)) {
    return 'other_search';
  }
  if (/(^|\.)(whatsapp\.com|wa\.me)$|^com\.whatsapp/.test(host)) return 'whatsapp';
  if (/mail\./.test(host)) return 'email';
  return 'other_site';
}

function channelFromUtmSource(raw: string): LeadSourceChannel | null {
  const source = raw.trim().toLowerCase();
  if (/^(ig|instagram)$/.test(source)) return 'instagram';
  if (/^(fb|facebook)$/.test(source)) return 'facebook';
  if (/^(meta|an|msg|messenger|th|threads|audience_network)$/.test(source)) return 'meta_other';
  if (/^(yt|youtube)$/.test(source)) return 'youtube';
  if (source === 'google') return 'google_other';
  if (/^(tiktok|tt)$/.test(source)) return 'tiktok';
  if (/^(snap|snapchat)$/.test(source)) return 'snapchat';
  if (/^(chatgpt|chatgpt\.com|openai)$/.test(source)) return 'chatgpt';
  if (/^(perplexity|claude|gemini|copilot|deepseek|grok|mistral)(\.[a-z]+)?$/.test(source)) {
    return 'ai_other';
  }
  if (/^(bing|microsoft)$/.test(source)) return 'bing';
  if (/^(pinterest|pin)$/.test(source)) return 'pinterest';
  if (/^(email|e-mail|newsletter|mail)$/.test(source)) return 'email';
  if (source === 'whatsapp') return 'whatsapp';
  return null;
}

const META_CHANNELS: ReadonlySet<LeadSourceChannel> = new Set([
  'instagram',
  'facebook',
  'meta_other',
]);
const AI_CHANNELS: ReadonlySet<LeadSourceChannel> = new Set(['chatgpt', 'ai_other']);

/** Le site d'origine précise le canal : Instagram plutôt que « Meta ». */
function refine(
  utmChannel: LeadSourceChannel | null,
  hostChannel: LeadSourceChannel | null,
): LeadSourceChannel | null {
  if (!utmChannel) return hostChannel;
  if (!hostChannel) return utmChannel;
  if (utmChannel === 'meta_other' && META_CHANNELS.has(hostChannel)) return hostChannel;
  if (utmChannel === 'google_other' && /^(google_search|youtube)$/.test(hostChannel)) {
    return hostChannel;
  }
  return utmChannel;
}

export function classifyLeadSource(input: LeadSourceInput): LeadSource {
  const utm = input.utm ?? {};
  const campaign = utm.utm_campaign?.trim() || null;
  const rawHost = referrerHost(input.referrer);
  const internal = rawHost ? /femiglow/.test(rawHost) : false;
  const host = internal ? null : rawHost;
  const hostChannel = host ? channelFromHost(host) : null;
  const utmChannel = utm.utm_source ? channelFromUtmSource(utm.utm_source) : null;
  const channel = refine(utmChannel, hostChannel);
  const tracked = input.createdAt >= SOURCE_CAPTURE_SINCE;
  const medium = utm.utm_medium?.trim() ?? '';
  const result = (next: LeadSourceChannel, kind: LeadSourceKind): LeadSource => ({
    channel: next,
    kind,
    campaign,
    site: host,
  });

  // Clics publicitaires : preuve d'une annonce.
  if (input.gclid || utm.gbraid || utm.wbraid) {
    return result(
      channel === 'google_search' || channel === 'youtube' ? channel : 'google_other',
      'paid',
    );
  }
  if (utm.ttclid) return result('tiktok', 'paid');
  if (utm.sccid) return result('snapchat', 'paid');
  if (utm.msclkid) return result('bing', 'paid');
  if (utm.epik) return result('pinterest', 'paid');

  if (channel && AI_CHANNELS.has(channel)) return result(channel, 'ai');

  if (channel) {
    if (PAID_MEDIUM_RX.test(medium)) return result(channel, 'paid');
    if (FREE_MEDIUM_RX.test(medium)) return result(channel, 'organic');
    if (META_CHANNELS.has(channel)) {
      // `fbclid` existe aussi sur les liens gratuits de Meta : seul, il ne
      // prouve rien. Avec une campagne, c'est une annonce.
      if (utm.fbclid && Object.keys(utm).some((key) => key.startsWith('utm_'))) {
        return result(channel, 'paid');
      }
      if (utm.fbclid) return result(channel, 'unknown');
    }
    if (channel === 'email' || channel === 'whatsapp') return result(channel, 'organic');
    return result(channel, tracked ? 'organic' : 'unknown');
  }

  if (host) return result('other_site', 'organic');
  if (!tracked) return result('unknown', 'unknown');
  return result('direct', 'direct');
}
