/**
 * Provenance du trafic pour le CRM.
 *
 * `source` doit être le libellé exact d'une option du champ Trello « المصدر » ;
 * `source_channel` garde le détail lisible (champ Traffic). Baiti range un libellé
 * inconnu dans « Autre ».
 */
import { isGoogleAdsLead } from '@/lib/checkout/lead-acquisition';
import {
  classifyLeadSource,
  LEAD_SOURCE_CHANNEL_LABELS,
  LEAD_SOURCE_KIND_LABELS,
  type LeadSourceChannel,
  type LeadSourceInput,
} from '@/lib/leads/lead-source';

export const DEFAULT_CRM_SOURCE = 'Website';

const CRM_SOURCE_BY_CHANNEL: Record<LeadSourceChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  meta_other: 'Facebook',
  youtube: 'YouTube',
  google_search: 'Google',
  google_other: 'Google',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  chatgpt: 'IA',
  ai_other: 'IA',
  whatsapp: 'Whatsapp',
  pinterest: 'Autre',
  bing: 'Autre',
  other_search: 'Autre',
  email: 'Autre',
  other_site: DEFAULT_CRM_SOURCE,
  direct: DEFAULT_CRM_SOURCE,
  unknown: DEFAULT_CRM_SOURCE,
};

/** Limite de `source_channel` dans le payload sortant. */
const MAX_CHANNEL_LENGTH = 60;
const SEPARATOR = ' · ';

export interface TrafficWebhookFields {
  source: string;
  source_channel: string;
}

/**
 * @param context précision conservée en fin de texte (`abandon`, `chat:manual`) :
 *   elle survit à une campagne trop longue, qui est tronquée.
 */
export function trafficWebhookFields(
  lead: LeadSourceInput,
  context?: string,
): TrafficWebhookFields {
  const { channel, kind, campaign } = classifyLeadSource(lead);
  const paid = isGoogleAdsLead(lead) ? 'paid' : kind;
  const head = [LEAD_SOURCE_CHANNEL_LABELS[channel]];
  if (channel !== 'direct' && channel !== 'unknown') head.push(LEAD_SOURCE_KIND_LABELS[paid]);
  const tail = context ? [context] : [];
  const fixedLength = [...head, ...tail].join(SEPARATOR).length;
  const room = MAX_CHANNEL_LENGTH - fixedLength - SEPARATOR.length;
  const trimmed = campaign?.slice(0, Math.max(0, room)).trim();
  return {
    source: CRM_SOURCE_BY_CHANNEL[channel],
    source_channel: [...head, ...(trimmed ? [trimmed] : []), ...tail]
      .join(SEPARATOR)
      .slice(0, MAX_CHANNEL_LENGTH),
  };
}
