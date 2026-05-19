import 'server-only';

import { resolveComponentFieldsFresh } from '@/lib/components/field-resolver';
import { computePromo } from '@/lib/utils/promo';
import { getKitProductCached } from '@/lib/products/public';
import { mockKit } from '@/data/mock';
import {
  GEO_PROMO_COMPONENT_KEY,
  GEO_PROMO_CTA_HREF,
  GEO_PROMO_LOCALE,
  GEO_PROMO_ROUTE,
  TAG_KEYS,
  type GeoPromoAdminConfig,
  type GeoPromoDensity,
  type GeoPromoDismissMode,
  type GeoPromoMotion,
  type GeoPromoTag,
  type GeoPromoTagKey,
  type GeoPromoTheme,
} from './types';

export const DEFAULT_GEO_PROMO_CONFIG: GeoPromoAdminConfig = {
  enabled: false,
  // Cadence saisonnière > date précise (Kolenda Luxury §14 / Pricing §16 :
  // pas de countdown ni de date d'expiration explicite). Le placeholder
  // {dateShort} reste supporté par `renderPromoTemplate` pour les anciens
  // overrides admin qui voudraient encore l'utiliser ; le défaut ne le
  // pose plus.
  messageTemplate: 'Édition de saison · {city}',
  fallbackMessageTemplate: 'Édition de saison · Maroc',
  ctaLabel: 'Commander',
  ctaHref: GEO_PROMO_CTA_HREF,
  ariaLabel: 'Édition de saison FemiGlow',
  theme: 'ink',
  density: 'compact',
  motion: 'slide',
  dismissible: true,
  dismissMode: 'session',
  tagsEnabled: true,
  // Kolenda UX §1 : ≤ 4 options visibles. On garde 2 tags fonctionnels —
  // le `-XX%` (`discount`), `inspect_before_pay` et `morocco_delivery` sont
  // retirés des défauts (anti-pattern Pricing §16 « pas de "-49 %" seul »
  // et redondance « partout au Maroc » avec le message principal).
  // L'admin peut toujours les réactiver via le CMS pour une campagne.
  tagOrder: ['free_shipping', 'cod'],
  routesInclude: [GEO_PROMO_ROUTE],
  routesExclude: ['/checkout', '/admin', '/api'],
  campaignKey: 'geo_promo_kit_default',
};

const TAG_DEFS: Record<Exclude<GeoPromoTagKey, 'discount'>, Omit<GeoPromoTag, 'key'>> = {
  free_shipping: { label: 'Livraison gratuite', icon: 'Truck' },
  cod: { label: 'Paiement a la livraison', icon: 'HandCoins' },
  inspect_before_pay: { label: 'Verifiez avant de payer', icon: 'ShieldCheck' },
  morocco_delivery: { label: 'Partout au Maroc', icon: 'MapPinned' },
};

function field<T>(
  fields: Awaited<ReturnType<typeof resolveComponentFieldsFresh>>,
  key: string,
): T | null {
  const value = fields[key]?.value;
  return value === undefined ? null : (value as T);
}

function asString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > maxLength) return fallback;
  return clean;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function asStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : fallback;
}

function asTagOrder(value: unknown): GeoPromoTagKey[] {
  const raw = asStringList(value, DEFAULT_GEO_PROMO_CONFIG.tagOrder);
  const unique = new Set<GeoPromoTagKey>();
  for (const key of raw) {
    if ((TAG_KEYS as readonly string[]).includes(key)) {
      unique.add(key as GeoPromoTagKey);
    }
  }
  return unique.size > 0 ? Array.from(unique) : DEFAULT_GEO_PROMO_CONFIG.tagOrder;
}

function enforceKitScope(routes: string[]): string[] {
  return routes.includes(GEO_PROMO_ROUTE) ? [GEO_PROMO_ROUTE] : [GEO_PROMO_ROUTE];
}

function enforceKitCta(href: string): string {
  if (href === GEO_PROMO_ROUTE || href.startsWith(`${GEO_PROMO_ROUTE}#`)) return href;
  return GEO_PROMO_CTA_HREF;
}

export async function resolveGeoPromoAdminConfig(): Promise<GeoPromoAdminConfig> {
  const fields = await resolveComponentFieldsFresh(GEO_PROMO_COMPONENT_KEY, GEO_PROMO_LOCALE);
  return {
    enabled: asBoolean(field(fields, 'enabled'), DEFAULT_GEO_PROMO_CONFIG.enabled),
    messageTemplate: asString(
      field(fields, 'messageTemplate'),
      DEFAULT_GEO_PROMO_CONFIG.messageTemplate,
      80,
    ),
    fallbackMessageTemplate: asString(
      field(fields, 'fallbackMessageTemplate'),
      DEFAULT_GEO_PROMO_CONFIG.fallbackMessageTemplate,
      80,
    ),
    ctaLabel: asString(field(fields, 'ctaLabel'), DEFAULT_GEO_PROMO_CONFIG.ctaLabel, 14),
    ctaHref: enforceKitCta(
      asString(field(fields, 'ctaHref'), DEFAULT_GEO_PROMO_CONFIG.ctaHref, 80),
    ),
    ariaLabel: asString(
      field(fields, 'ariaLabel'),
      DEFAULT_GEO_PROMO_CONFIG.ariaLabel,
      80,
    ),
    theme: asEnum<GeoPromoTheme>(
      field(fields, 'theme'),
      ['ink', 'sage', 'cream'],
      DEFAULT_GEO_PROMO_CONFIG.theme,
    ),
    density: asEnum<GeoPromoDensity>(
      field(fields, 'density'),
      ['compact', 'comfortable'],
      DEFAULT_GEO_PROMO_CONFIG.density,
    ),
    motion: asEnum<GeoPromoMotion>(
      field(fields, 'motion'),
      ['slide', 'fade', 'none'],
      DEFAULT_GEO_PROMO_CONFIG.motion,
    ),
    dismissible: asBoolean(
      field(fields, 'dismissible'),
      DEFAULT_GEO_PROMO_CONFIG.dismissible,
    ),
    dismissMode: asEnum<GeoPromoDismissMode>(
      field(fields, 'dismissMode'),
      ['session', 'day', 'none'],
      DEFAULT_GEO_PROMO_CONFIG.dismissMode,
    ),
    tagsEnabled: asBoolean(
      field(fields, 'tagsEnabled'),
      DEFAULT_GEO_PROMO_CONFIG.tagsEnabled,
    ),
    tagOrder: asTagOrder(field(fields, 'tagOrder')),
    routesInclude: enforceKitScope(asStringList(field(fields, 'routesInclude'), [GEO_PROMO_ROUTE])),
    routesExclude: asStringList(
      field(fields, 'routesExclude'),
      DEFAULT_GEO_PROMO_CONFIG.routesExclude,
    ),
    campaignKey: asString(
      field(fields, 'campaignKey'),
      DEFAULT_GEO_PROMO_CONFIG.campaignKey,
      80,
    ),
  };
}

export async function resolveKitDiscountPct(): Promise<number | null> {
  const data = await getKitProductCached();
  const primary = data?.product.status === 'published' ? data.variants[0] : null;
  const priceCents = primary?.priceCents ?? mockKit.priceCents;
  const promoPriceCents = primary?.promoPriceCents ?? mockKit.promoPriceCents;
  const promo = computePromo(priceCents, promoPriceCents);
  return promo.active && promo.savingsPct > 0 ? promo.savingsPct : null;
}

export async function resolveKitDiscountPctSafe(): Promise<number | null> {
  try {
    return await resolveKitDiscountPct();
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[geo-promo] discount resolution failed', error);
    }
    return null;
  }
}

export function buildGeoPromoTags(
  config: GeoPromoAdminConfig,
  discountPct: number | null,
): GeoPromoTag[] {
  if (!config.tagsEnabled) return [];
  const tags: GeoPromoTag[] = [];
  for (const key of config.tagOrder) {
    if (key === 'discount') {
      if (discountPct !== null && discountPct > 0) {
        tags.push({ key, label: `-${discountPct}%`, icon: 'BadgePercent' });
      }
      continue;
    }
    const def = TAG_DEFS[key];
    tags.push({ key, ...def });
  }
  return tags;
}
