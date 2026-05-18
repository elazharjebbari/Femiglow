export const GEO_PROMO_COMPONENT_KEY = 'global-promo-slide-header';
export const GEO_PROMO_LOCALE = 'fr';
export const GEO_PROMO_ROUTE = '/kit';
export const GEO_PROMO_CTA_HREF = '/kit#commander-femiglow';

export const TAG_KEYS = [
  'discount',
  'free_shipping',
  'cod',
  'inspect_before_pay',
  'morocco_delivery',
] as const;

export type GeoPromoTagKey = (typeof TAG_KEYS)[number];

export type GeoPromoTheme = 'ink' | 'sage' | 'cream';
export type GeoPromoDensity = 'compact' | 'comfortable';
export type GeoPromoMotion = 'slide' | 'fade' | 'none';
export type GeoPromoDismissMode = 'session' | 'day' | 'none';

export interface GeoPromoAdminConfig {
  enabled: boolean;
  messageTemplate: string;
  fallbackMessageTemplate: string;
  ctaLabel: string;
  ctaHref: string;
  ariaLabel: string;
  theme: GeoPromoTheme;
  density: GeoPromoDensity;
  motion: GeoPromoMotion;
  dismissible: boolean;
  dismissMode: GeoPromoDismissMode;
  tagsEnabled: boolean;
  tagOrder: GeoPromoTagKey[];
  routesInclude: string[];
  routesExclude: string[];
  campaignKey: string;
}

export interface VisitorGeo {
  cityLabel: string | null;
  regionLabel: string | null;
  countryCode: string | null;
}

export interface GeoPromoTag {
  key: GeoPromoTagKey;
  label: string;
  icon:
    | 'BadgePercent'
    | 'Truck'
    | 'HandCoins'
    | 'ShieldCheck'
    | 'MapPinned';
}

export interface GeoPromoLocationPayload {
  enabled: boolean;
  dateLabel?: string;
  dateShort?: string;
  cityLabel?: string | null;
  regionLabel?: string | null;
  countryCode?: string | null;
  message?: string;
  tags?: GeoPromoTag[];
  discountPct?: number | null;
  ctaLabel?: string;
  ctaHref?: string;
  ariaLabel?: string;
  theme?: GeoPromoTheme;
  density?: GeoPromoDensity;
  motion?: GeoPromoMotion;
  dismissible?: boolean;
  dismissMode?: GeoPromoDismissMode;
  campaignKey?: string;
}
