/**
 * Types & constantes pour le système d'attribution multi-canal.
 *
 * Cf. docs/tracking-attribution/ pour le contexte complet.
 */
import { z } from 'zod';

/** Canaux d'acquisition reconnus. */
export const ATTRIBUTION_CHANNELS = [
  'google_ads',
  'meta',
  'tiktok',
  'snap',
  'pinterest',
  'bing_ads',
  'email',
  'organic',
  'social_organic',
  'direct',
] as const;
export type AttributionChannel = (typeof ATTRIBUTION_CHANNELS)[number];

/** Canaux marqués « payants » → considérés par les stratégies *_paid_touch. */
export const PAID_CHANNELS = new Set<AttributionChannel>([
  'google_ads',
  'meta',
  'tiktok',
  'snap',
  'pinterest',
  'bing_ads',
]);

/** Mapping canal → tag GTM provider attendu. Sert pour la condition GTM. */
export const CHANNEL_TO_PROVIDERS: Record<AttributionChannel, readonly string[]> = {
  google_ads: ['google_ads'],
  meta: ['meta'],
  tiktok: ['tiktok'],
  snap: ['snap'],
  pinterest: ['pinterest'],
  bing_ads: ['bing_ads'],
  email: [],
  organic: ['google_ads', 'meta', 'tiktok', 'snap', 'pinterest', 'bing_ads'],
  social_organic: ['google_ads', 'meta', 'tiktok', 'snap', 'pinterest', 'bing_ads'],
  direct: ['google_ads', 'meta', 'tiktok', 'snap', 'pinterest', 'bing_ads'],
};

export const CLICK_ID_FIELDS = [
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'ttclid',
  'sccid',
  'epik',
  'msclkid',
] as const;
export type ClickIdField = (typeof CLICK_ID_FIELDS)[number];

export const utmSchema = z.object({
  source: z.string().max(120).optional(),
  medium: z.string().max(120).optional(),
  campaign: z.string().max(120).optional(),
  term: z.string().max(120).optional(),
  content: z.string().max(120).optional(),
});
export type Utm = z.infer<typeof utmSchema>;

/** Une « touche » : 1 visite + son canal détecté. */
export const channelTouchSchema = z.object({
  channel: z.enum(ATTRIBUTION_CHANNELS),
  is_paid: z.boolean(),
  click_id: z.string().max(512).optional(),
  click_id_field: z.enum(CLICK_ID_FIELDS).optional(),
  utm: utmSchema.optional(),
  referrer: z.string().max(2048).optional(),
  landing_path: z.string().max(2048).optional(),
  detected_at: z.string().datetime(),
});
export type ChannelTouch = z.infer<typeof channelTouchSchema>;

/** Snapshot complet de l'attribution d'un visiteur. */
export interface AttributionSnapshot {
  first_touch: ChannelTouch | null;
  last_touch: ChannelTouch | null;
  paid_history: ChannelTouch[];
}

/** Stratégies disponibles. `last_paid_touch` est le défaut recommandé. */
export const ATTRIBUTION_STRATEGIES = [
  'last_paid_touch',
  'first_paid_touch',
  'last_touch',
  'first_touch',
  'broadcast',
] as const;
export type AttributionStrategy = (typeof ATTRIBUTION_STRATEGIES)[number];

export const DEFAULT_ATTRIBUTION_STRATEGY: AttributionStrategy = 'last_paid_touch';

/** Résultat de l'application d'une stratégie. */
export interface AttributedChannel {
  /** Canal résolu, ou `'broadcast'` si stratégie broadcast. */
  channel: AttributionChannel | 'broadcast';
  is_paid: boolean;
  /** Pour debug : pourquoi ce canal a été choisi. */
  reason: string;
  /** Le `click_id` du touch sélectionné (utile pour CAPI / OCI). */
  click_id?: string;
  click_id_field?: ClickIdField;
  /** UTM du touch sélectionné (utile pour reporting). */
  utm?: Utm;
}

/** Métadonnées de stratégie pour l'UI (libellé + description). */
export const STRATEGY_META: Record<
  AttributionStrategy,
  { label: string; description: string; recommended?: boolean }
> = {
  last_paid_touch: {
    label: 'Dernier-clic payant',
    description:
      'Crédite le dernier canal payant connu (Google Ads, Meta, TikTok…). Idéal pour le Smart Bidding et l\'attribution standard 2025.',
    recommended: true,
  },
  first_paid_touch: {
    label: 'Premier-clic payant',
    description:
      'Crédite le premier canal payant qui a amené le visiteur. Pour les funnels longs où l\'acquisition compte plus que la conversion.',
  },
  last_touch: {
    label: 'Dernière interaction',
    description:
      'Crédite le dernier canal connu, payant ou non (inclut SEO/direct). Plus précis quand le funnel a peu de paid.',
  },
  first_touch: {
    label: 'Première interaction',
    description:
      'Crédite l\'acquisition initiale, payante ou non.',
  },
  broadcast: {
    label: 'Broadcast (déconseillé)',
    description:
      'Tous les pixels reçoivent toutes les conversions. Double-comptage garanti. À utiliser uniquement en debug.',
  },
};
