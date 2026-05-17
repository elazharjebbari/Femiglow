/**
 * Tests atomiques du seed canonique TP2.
 * Garantit que le seed produit un input valide, avec provider snap et sans pinterest,
 * et que tous les events du catalogue sont représentés.
 */
import { describe, expect, it } from 'vitest';
import { buildCanonicalSeed, canonicalEventKeys } from '../canonical-seed';
import { trackingPlanInputSchema, type ProviderId } from '../types';
import { EVENT_CATALOG } from '@/lib/tracking/event-catalog';

describe('buildCanonicalSeed', () => {
  it('produit un TrackingPlanInput valide selon le schéma Zod', () => {
    const seed = buildCanonicalSeed();
    const parsed = trackingPlanInputSchema.safeParse(seed);
    expect(parsed.success).toBe(true);
  });

  it('utilise le nom par défaut quand aucun nom fourni', () => {
    const seed = buildCanonicalSeed();
    expect(seed.name).toBe('Plan canonique FemiGlow');
  });

  it('respecte le nom personnalisé', () => {
    const seed = buildCanonicalSeed({ name: 'Plan staging' });
    expect(seed.name).toBe('Plan staging');
  });

  it('active les 4 providers principaux (ga4/googleAds/meta/tiktok) et désactive Snap/GTM par défaut', () => {
    const seed = buildCanonicalSeed();
    const active = seed.providers.filter((p) => p.active).map((p) => p.id);
    expect(active.sort()).toEqual(['ga4', 'googleAds', 'meta', 'tiktok']);
    expect(seed.providers.find((p) => p.id === 'snap')?.active).toBe(false);
    expect(seed.providers.find((p) => p.id === 'gtm')?.active).toBe(false);
  });

  it('contient un envProfile production avec le squelette de conversion-labels (à remplir par l\'admin)', () => {
    const seed = buildCanonicalSeed();
    expect(seed.envProfiles).toHaveLength(1);
    expect(seed.envProfiles[0]?.env).toBe('production');
    const cfg = seed.envProfiles[0]?.config ?? {};
    // Skeleton ads labels présent, valeurs vides (l'admin remplit).
    expect(cfg.googleAdsConversionLabels).toBeDefined();
    expect(cfg.googleAdsConversionLabels).toHaveProperty('purchase', '');
    expect(cfg.googleAdsConversionLabels).toHaveProperty('checkout_intent', '');
    expect(cfg.googleAdsConversionLabels).toHaveProperty('lead', '');
  });

  it('active Consent Mode v2 avec defaults denied/denied (RGPD-safe)', () => {
    const seed = buildCanonicalSeed();
    expect(seed.settings?.consentMode).toBe('v2');
    expect(seed.settings?.consentDefaults).toMatchObject({
      ad_storage: 'denied',
      analytics_storage: 'denied',
    });
  });

  it('produit autant d\'événements que le catalogue applicatif (par défaut)', () => {
    const seed = buildCanonicalSeed();
    expect(seed.events.length).toBe(EVENT_CATALOG.length);
  });

  it('filtre les événements server-only quand includeServerOnly=false', () => {
    const all = buildCanonicalSeed({ includeServerOnly: true });
    const webOnly = buildCanonicalSeed({ includeServerOnly: false });
    const serverEvents = EVENT_CATALOG.filter((e) => e.scope === 'server');
    expect(webOnly.events.length).toBe(all.events.length - serverEvents.length);
  });

  it('mappe les providers supportés et exclut seulement pinterest', () => {
    const seed = buildCanonicalSeed();
    const validIds: ProviderId[] = ['ga4', 'googleAds', 'meta', 'tiktok', 'snap', 'gtm'];
    for (const evt of seed.events) {
      for (const key of Object.keys(evt.providers)) {
        expect(validIds).toContain(key);
      }
    }
  });

  it('préserve Snapchat depuis le catalogue sur les conversions clés', () => {
    const seed = buildCanonicalSeed();
    expect(seed.events.find((e) => e.key === 'purchase')?.providers.snap).toBe(true);
    expect(seed.events.find((e) => e.key === 'lead_capture')?.providers.snap).toBe(true);
  });

  it('mappe correctement google_ga4 → ga4 et google_ads → googleAds', () => {
    const seed = buildCanonicalSeed();
    const purchase = seed.events.find((e) => e.key === 'purchase');
    expect(purchase).toBeDefined();
    // purchase est dispatché vers ga4/ads/meta/tiktok par défaut.
    expect(purchase?.providers.ga4).toBe(true);
    expect(purchase?.providers.googleAds).toBe(true);
    expect(purchase?.providers.meta).toBe(true);
  });

  it('inclut les événements conversion clés (purchase, generate_lead, sign_up, begin_checkout)', () => {
    const keys = new Set(canonicalEventKeys());
    expect(keys.has('purchase')).toBe(true);
    expect(keys.has('generate_lead')).toBe(true);
    expect(keys.has('sign_up')).toBe(true);
    expect(keys.has('begin_checkout')).toBe(true);
  });

  it('chaque event a une clé snake_case valide (regex eventSchema)', () => {
    const seed = buildCanonicalSeed();
    const re = /^[a-z][a-z0-9_]*$/;
    for (const e of seed.events) {
      expect(re.test(e.key)).toBe(true);
    }
  });

  it('chaque event a un label (description) non vide', () => {
    const seed = buildCanonicalSeed();
    for (const e of seed.events) {
      expect(e.label).toBeTruthy();
      expect(e.label!.length).toBeGreaterThan(0);
    }
  });
});
