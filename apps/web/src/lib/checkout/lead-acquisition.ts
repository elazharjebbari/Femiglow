/**
 * Origine publicitaire d'un lead, à partir de ce que `chat_lead` conserve.
 *
 * Les cookies posés par le middleware sont lus à la création du lead : le
 * navigateur n'a rien à transmettre, et le beacon de secours en profite aussi.
 * `gbraid` et `wbraid` remplacent `gclid` sur iPhone : ils vivent dans `utm`.
 */
import type { RequestSignals } from '@/lib/tracking/server/request-signals';

/** Valeur de `source_channel` pour le CRM (« Canal » sur la carte Trello). */
export const GOOGLE_ADS_CHANNEL = 'google_ads';

const PAID_MEDIUM_RX = /^(cpc|ppc|paid|cpv|cpa|cpm|display|paidsearch|paid_search)$/i;

export function utmFromRequestSignals(
  signals: Pick<RequestSignals, 'utm' | 'clickIds'>,
): Record<string, string> | undefined {
  const { source, medium, campaign, content, term } = signals.utm;
  const entries = Object.entries({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
    utm_content: content,
    utm_term: term,
    gbraid: signals.clickIds.gbraid,
    wbraid: signals.clickIds.wbraid,
  }).filter((entry): entry is [string, string] => Boolean(entry[1]));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export interface LeadAttribution {
  gclid?: string | null;
  utm?: Record<string, string> | null;
}

/** Clic Google Ads prouvé, ou UTM Google sans support gratuit. */
export function isGoogleAdsLead({ gclid, utm }: LeadAttribution): boolean {
  if (gclid || utm?.gbraid || utm?.wbraid) return true;
  if (utm?.utm_source?.trim().toLowerCase() !== 'google') return false;
  const medium = utm.utm_medium?.trim();
  return !medium || PAID_MEDIUM_RX.test(medium);
}

/** Canal et mention de note pour le webhook, `null` hors Google Ads. */
export function googleAdsWebhookFields(
  lead: LeadAttribution,
): { sourceChannel: string; note: string } | null {
  if (!isGoogleAdsLead(lead)) return null;
  const campaign = lead.utm?.utm_campaign?.trim();
  return {
    sourceChannel: GOOGLE_ADS_CHANNEL,
    note: campaign ? `source:Google Ads campagne:${campaign}` : 'source:Google Ads',
  };
}
