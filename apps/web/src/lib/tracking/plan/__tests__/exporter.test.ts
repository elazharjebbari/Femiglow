import { describe, expect, it } from 'vitest';

import { exportPlan } from '../exporter';
import type { TrackingPlan } from '../types';

function buildPlan(overrides: Partial<TrackingPlan> = {}): TrackingPlan {
  return {
    id: 'plan-test',
    name: 'Test',
    status: 'active',
    version: 1,
    providers: [
      { id: 'ga4', active: true },
      { id: 'meta', active: true },
    ],
    envProfiles: [
      {
        env: 'production',
        config: {
          ga4MeasurementId: 'G-5VHP17SDZM',
          metaPixelId: '1234567890123456',
          gtmContainerId: 'GTM-M8K7V88D',
        },
      },
      {
        env: 'staging',
        config: { ga4MeasurementId: 'G-STAGE1234' },
      },
    ],
    events: [
      { key: 'page_view', providers: { ga4: true, meta: true } },
      { key: 'purchase', providers: { ga4: true, meta: true } },
    ],
    settings: { consentMode: 'v2' },
    createdBy: 'test@femiglow.ma',
    createdAt: new Date('2026-05-14'),
    updatedAt: new Date('2026-05-14'),
    ...overrides,
  };
}

describe('exportPlan — déterminisme', () => {
  it('same input produces same bundleId', () => {
    const a = exportPlan(buildPlan(), 'production');
    const b = exportPlan(buildPlan(), 'production');
    expect(a.bundleId).toBe(b.bundleId);
  });

  it('bundleId is independent of createdAt/updatedAt', () => {
    const a = exportPlan(
      buildPlan({ createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') }),
      'production',
    );
    const b = exportPlan(
      buildPlan({ createdAt: new Date('2026-12-31'), updatedAt: new Date('2026-12-31') }),
      'production',
    );
    expect(a.bundleId).toBe(b.bundleId);
  });

  it('bundleId is independent of exportTime (re-exporting same plan is stable)', () => {
    const a = exportPlan(buildPlan(), 'production');
    const b = exportPlan(buildPlan(), 'production');
    expect((a.json as any).exportTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect((b.json as any).exportTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Whatever exportTime ends up being, the hash must ignore it.
    expect(a.bundleId).toBe(b.bundleId);
  });

  it('bundleId differs between production and staging', () => {
    const prod = exportPlan(buildPlan(), 'production');
    const stag = exportPlan(buildPlan(), 'staging');
    expect(prod.bundleId).not.toBe(stag.bundleId);
  });
});

describe('exportPlan — structure GTM', () => {
  it('produces a valid GTM container shape with all top-level fields', () => {
    const result = exportPlan(buildPlan(), 'production');
    expect(result.json).toMatchObject({
      exportFormatVersion: 2,
      exportTime: expect.any(String),
      containerVersion: {
        path: expect.stringContaining('accounts/'),
        accountId: expect.any(String),
        containerId: expect.any(String),
        container: {
          name: expect.any(String),
          usageContext: ['WEB'],
        },
        tag: expect.any(Array),
        trigger: expect.any(Array),
        variable: expect.any(Array),
        folder: expect.any(Array),
        builtInVariable: expect.any(Array),
      },
    });
  });

  it('emits GA4 Config (gaawc) + one GA4 Event tag (gaawe) per event', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(tags.filter((t: any) => t.type === 'gaawc')).toHaveLength(1);
    expect(tags.filter((t: any) => t.type === 'gaawe')).toHaveLength(2);
  });

  it('does not emit GA4 tags when provider inactive', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: false },
        { id: 'meta', active: true },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(tags.filter((t: any) => t.type === 'gaawe').length).toBe(0);
    expect(tags.filter((t: any) => t.type === 'gaawc').length).toBe(0);
  });

  it('emits Meta Init + per-event html tags (NOT cvt_meta community templates)', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    const htmlTags = tags.filter((t: any) => t.type === 'html');
    // 1 init + 2 events
    expect(htmlTags.length).toBeGreaterThanOrEqual(3);
    const init = tags.find((t: any) => t.name === 'Meta Init');
    expect(init).toBeDefined();
    expect(init.priority).toMatchObject({ type: 'INTEGER', key: 'priority', value: '70' });
    expect(init.tagFiringOption).toBe('ONCE_PER_EVENT');
    // No community template types allowed (cvt_meta won't import without
    // the template being installed in the target workspace).
    expect(tags.some((t: any) => t.type === 'cvt_meta')).toBe(false);
    expect(tags.some((t: any) => t.type === 'cvt_tiktok')).toBe(false);
  });

  it('Meta event tags chain via setupTag to Meta Init', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    const metaEvent = tags.find((t: any) => t.name.startsWith('Meta Evt'));
    expect(metaEvent.setupTag).toEqual([
      { tagName: 'Meta Init', stopOnSetupFailure: false },
    ]);
  });

  it('maps GA4 event names to Meta standard event names', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    const purchase = tags.find((t: any) => t.name === 'Meta Evt — purchase (Purchase)');
    expect(purchase).toBeDefined();
    const html = purchase.parameter.find((p: any) => p.key === 'html').value;
    expect(html).toContain("fbq('track', 'Purchase'");
  });

  it('wires every tag to a firingTriggerId (no orphan tags)', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    for (const t of tags) {
      expect(t.firingTriggerId).toBeDefined();
      expect(t.firingTriggerId.length).toBeGreaterThan(0);
    }
  });

  it('emits one PAGEVIEW + one CUSTOM_EVENT trigger per event (+ attribution triggers for conversions)', () => {
    const result = exportPlan(buildPlan(), 'production');
    const triggers = (result.json as any).containerVersion.trigger;
    expect(triggers.filter((t: any) => t.type === 'PAGEVIEW')).toHaveLength(1);
    // Standard CE triggers : 1 par event (page_view + purchase = 2)
    const standardCE = triggers.filter(
      (t: any) => t.type === 'CUSTOM_EVENT' && !t.name.includes('[attr / '),
    );
    expect(standardCE).toHaveLength(2);
    // Attribution-gated CE triggers : pour `purchase` (conversion event)
    // × providers actifs (meta). page_view est audience donc aucun.
    const attrCE = triggers.filter(
      (t: any) => t.type === 'CUSTOM_EVENT' && t.name.includes('[attr / '),
    );
    expect(attrCE.length).toBeGreaterThanOrEqual(1);
    expect(attrCE.find((t: any) => t.name === 'CE — purchase [attr / meta]')).toBeDefined();
  });

  it('CUSTOM_EVENT triggers carry an EQUALS customEventFilter on {{_event}}', () => {
    const result = exportPlan(buildPlan(), 'production');
    const triggers = (result.json as any).containerVersion.trigger;
    const ce = triggers.find(
      (t: any) =>
        t.type === 'CUSTOM_EVENT' &&
        t.name === 'CE — purchase',
    );
    expect(ce.customEventFilter).toEqual([
      {
        type: 'EQUALS',
        parameter: [
          { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
          { type: 'TEMPLATE', key: 'arg1', value: 'purchase' },
        ],
      },
    ]);
  });

  it('emits CONST variables for active provider IDs', () => {
    const result = exportPlan(buildPlan(), 'production');
    const variables = (result.json as any).containerVersion.variable;
    expect(variables).toContainEqual(
      expect.objectContaining({ name: 'CONST - GA4 Measurement ID', type: 'c' }),
    );
    expect(variables).toContainEqual(
      expect.objectContaining({ name: 'CONST - Meta Pixel ID', type: 'c' }),
    );
  });

  it('emits DLV - event_id when Meta is active (for fbq deduplication)', () => {
    const result = exportPlan(buildPlan(), 'production');
    const variables = (result.json as any).containerVersion.variable;
    const dlv = variables.find((v: any) => v.name === 'DLV - event_id');
    expect(dlv).toBeDefined();
    expect(dlv.type).toBe('v');
  });

  it('built-in variables use REAL GTM BuiltInVariableType enum values', () => {
    const result = exportPlan(buildPlan(), 'production');
    const builtIns = (result.json as any).containerVersion.builtInVariable;
    // Each must have name + type; valid types only.
    for (const v of builtIns) {
      expect(v).toHaveProperty('name');
      expect(v).toHaveProperty('type');
    }
    const types = builtIns.map((v: any) => v.type);
    expect(types).toContain('PAGE_URL');
    expect(types).toContain('PAGE_PATH');
    expect(types).toContain('EVENT');
    // These ARE NOT valid built-in var types — they are consent keys.
    // Including them causes "Error deserializing enum type [BuiltInVariableType]".
    expect(types).not.toContain('AD_STORAGE');
    expect(types).not.toContain('ANALYTICS_STORAGE');
  });

  it('emits Google Ads conversion tags with the real label (envConfig) + Enhanced Conversions', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'googleAds', active: true },
      ],
      envProfiles: [
        {
          env: 'production',
          config: {
            ga4MeasurementId: 'G-X',
            googleAdsConversionId: 'AW-18136327114',
            googleAdsConversionLabels: {
              purchase: 'UGxLCMGJv6wcEMrHichD',
            },
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'purchase', providers: { ga4: true, googleAds: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const variables = (result.json as any).containerVersion.variable;

    // Une CONST pour le label de conversion purchase
    const labelConst = variables.find(
      (v: any) => v.name === 'CONST - Ads Label - purchase',
    );
    expect(labelConst).toBeDefined();
    expect(labelConst.parameter[0].value).toBe('UGxLCMGJv6wcEMrHichD');

    // Tag awct référence la CONST + currency + value + transaction_id
    // + Enhanced Conversions automatiques.
    const awct = tags.find((t: any) => t.type === 'awct');
    expect(awct).toBeDefined();
    expect(awct.name).toBe('Ads Conv — purchase → purchase');
    const params = Object.fromEntries(
      awct.parameter.map((p: any) => [p.key, p.value]),
    );
    expect(params.conversionId).toBe('{{CONST - Google Ads Conversion ID}}');
    expect(params.conversionLabel).toBe('{{CONST - Ads Label - purchase}}');
    expect(params.conversionCategory).toBe('PURCHASE');
    expect(params.orderId).toBe('{{DLV - ecommerce.transaction_id}}');
    expect(params.currencyCode).toBe('{{DLV - ecommerce.currency}}');
    expect(params.conversionValue).toBe('{{DLV - ecommerce.value}}');
    // Enhanced Conversions activé par défaut (admin override possible
    // via envConfig.googleAdsEnhancedConversions).
    expect(params.enableEnhancedConversions).toBe('true');
    expect(params.enhancedConversionsAutomaticMode).toBe('true');
  });

  it('emits Ads Cfg (googtag) on All Pages to resolve "Hits différés" warning', () => {
    // Tag Assistant affiche "Certains hits ne seront pas envoyés tant
    // qu'une commande de configuration ne sera pas fournie par le
    // biais d'un appel gtag('config') ou d'une balise Google dans Tag
    // Manager." si AW-XXX est détecté comme destination mais qu'aucun
    // `gtag('config','AW-XXX')` n'est jamais émis. Le template `awct`
    // n'émet QUE `gtag('event','conversion')` — pas de config. Il faut
    // une balise googtag dédiée (équivalent gaawc pour Ads).
    const plan = buildPlan({
      providers: [{ id: 'googleAds', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            googleAdsConversionId: 'AW-18136327114',
            googleAdsConversionLabels: { purchase: 'LBL' },
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [{ key: 'purchase', providers: { googleAds: true } }],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const adsCfg = tags.find((t: any) => t.type === 'googtag');
    expect(adsCfg).toBeDefined();
    expect(adsCfg.name).toBe('Ads Cfg');
    const params = Object.fromEntries(
      adsCfg.parameter.map((p: any) => [p.key, p.value]),
    );
    // tagId DOIT inclure le préfixe AW- (contrairement à awct qui le
    // re-préfixe). Si on passe juste "18136327114", googtag n'initialise
    // pas la destination Ads et le warning persiste.
    expect(params.tagId).toBe('AW-18136327114');
    // Fire sur All Pages, ONCE_PER_EVENT, priorité juste sous GA4 Cfg.
    expect(adsCfg.tagFiringOption).toBe('ONCE_PER_EVENT');
    expect(adsCfg.priority).toMatchObject({
      type: 'INTEGER',
      key: 'priority',
      value: '75',
    });
    const triggers = (result.json as any).containerVersion.trigger;
    const allPagesTrigger = triggers.find((t: any) => t.type === 'PAGEVIEW');
    expect(adsCfg.firingTriggerId).toEqual([allPagesTrigger.triggerId]);
  });

  it('does not emit Ads Cfg when googleAds provider inactive', () => {
    const plan = buildPlan({
      providers: [{ id: 'ga4', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: { ga4MeasurementId: 'G-X', gtmContainerId: 'GTM-Y' },
        },
      ],
      events: [{ key: 'purchase', providers: { ga4: true } }],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(tags.filter((t: any) => t.type === 'googtag').length).toBe(0);
  });

  it('Enhanced Conversions désactivable via envConfig.googleAdsEnhancedConversions=false', () => {
    const plan = buildPlan({
      providers: [{ id: 'googleAds', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            googleAdsConversionId: 'AW-X',
            googleAdsConversionLabels: { purchase: 'LBL' },
            googleAdsEnhancedConversions: false,
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [{ key: 'purchase', providers: { googleAds: true } }],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const awct = tags.find((t: any) => t.type === 'awct');
    const params = Object.fromEntries(
      awct.parameter.map((p: any) => [p.key, p.value]),
    );
    expect(params.enableEnhancedConversions).toBe('false');
    expect(params.enhancedConversionsAutomaticMode).toBe('false');
  });

  it('skips awct tag when no conversion label is configured in envConfig', () => {
    const plan = buildPlan({
      providers: [{ id: 'googleAds', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            googleAdsConversionId: 'AW-X',
            // PAS de googleAdsConversionLabels
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'purchase', providers: { googleAds: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(tags.filter((t: any) => t.type === 'awct')).toHaveLength(0);
  });

  it('emits DLV user_data.* when events have identityFields', () => {
    const plan = buildPlan({
      providers: [{ id: 'ga4', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: { ga4MeasurementId: 'G-X', gtmContainerId: 'GTM-Y' },
        },
      ],
      // purchase a identityFields = [email, phone, firstName, lastName, city, country]
      events: [{ key: 'purchase', providers: { ga4: true } }],
    });
    const result = exportPlan(plan, 'production');
    const variables = (result.json as any).containerVersion.variable;
    const names = variables.map((v: any) => v.name);
    expect(names).toContain('DLV - user_data.email_sha256');
    expect(names).toContain('DLV - user_data.phone_sha256');
    expect(names).toContain('DLV - user_data.address.first_name_sha256');
    expect(names).toContain('DLV - user_data.address.last_name_sha256');
    expect(names).toContain('DLV - user_data.address.city');
    expect(names).toContain('DLV - user_data.address.country');

    // Vérifie le mapping DLV name = chemin dataLayer
    const emailDlv = variables.find((v: any) => v.name === 'DLV - user_data.email_sha256');
    const nameParam = emailDlv.parameter.find((p: any) => p.key === 'name');
    expect(nameParam.value).toBe('user_data.sha256_email_address');
  });

  it('conversion events route Meta/Ads/TikTok tags via attribution-gated triggers', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'meta', active: true },
        { id: 'googleAds', active: true },
        { id: 'tiktok', active: true },
      ],
      envProfiles: [
        {
          env: 'production',
          config: {
            ga4MeasurementId: 'G-X',
            metaPixelId: '1234',
            googleAdsConversionId: 'AW-X',
            googleAdsConversionLabels: { purchase: 'LABEL_X' },
            tiktokPixelId: 'TIKTOKID12345678',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        {
          key: 'purchase',
          providers: { ga4: true, meta: true, googleAds: true, tiktok: true },
        },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const triggers = (result.json as any).containerVersion.trigger;

    // Trois triggers attribution doivent exister (meta, google_ads, tiktok)
    const attrTriggers = triggers.filter(
      (t: any) => t.type === 'CUSTOM_EVENT' && t.name.includes('[attr / '),
    );
    const metaAttr = attrTriggers.find((t: any) => t.name === 'CE — purchase [attr / meta]');
    const adsAttr = attrTriggers.find((t: any) => t.name === 'CE — purchase [attr / google_ads]');
    const ttAttr = attrTriggers.find((t: any) => t.name === 'CE — purchase [attr / tiktok]');
    expect(metaAttr).toBeDefined();
    expect(adsAttr).toBeDefined();
    expect(ttAttr).toBeDefined();

    // customEventFilter doit contenir UN SEUL filtre (matching event name).
    // GTM rejette plusieurs entrées : "Un déclencheur d'événement
    // personnalisé doit comporter un seul filtre d'événement personnalisé".
    expect(metaAttr.customEventFilter).toHaveLength(1);
    expect(metaAttr.customEventFilter[0].type).toBe('EQUALS');
    // Le filtre d'attribution (MATCH_REGEX) doit aller dans `filter`,
    // pas dans customEventFilter.
    expect(metaAttr.filter).toBeDefined();
    const regexFilter = metaAttr.filter.find((f: any) => f.type === 'MATCH_REGEX');
    expect(regexFilter).toBeDefined();
    expect(regexFilter.parameter[0].value).toBe('{{DLV - attribution.channel}}');
    expect(regexFilter.parameter[1].value).toBe('^(meta|direct|organic|broadcast)$');

    // Le tag Meta doit être câblé sur le trigger attribution, pas standard
    const metaTag = tags.find((t: any) => t.name === 'Meta Evt — purchase (Purchase)');
    expect(metaTag.firingTriggerId).toEqual([metaAttr.triggerId]);
    // Idem pour Ads
    const adsTag = tags.find((t: any) => t.type === 'awct');
    expect(adsTag.firingTriggerId).toEqual([adsAttr.triggerId]);
    // Idem TikTok
    const ttTag = tags.find((t: any) => t.name === 'TikTok Evt — purchase');
    expect(ttTag.firingTriggerId).toEqual([ttAttr.triggerId]);

    // Le tag GA4 reste sur le trigger standard (analytics neutre)
    const ga4Tag = tags.find((t: any) => t.name === 'GA4 Evt — purchase');
    const standardTrigger = triggers.find((t: any) => t.name === 'CE — purchase');
    expect(ga4Tag.firingTriggerId).toEqual([standardTrigger.triggerId]);
  });

  it('gating per-provider — checkout_intent broadcast pour Meta (InitiateCheckout=non-primary) ET pour Ads (secondary)', () => {
    // Refactor mai 2026 : remplacement du flag global `isConversion`
    // par `getAttributionMode(eventKey, provider)`. Conséquences :
    //  - checkout_intent côté Meta → InitiateCheckout → broadcast
    //    (funnel/intent, pas Purchase/Lead)
    //  - checkout_intent côté Ads → secondary conversion → broadcast
    //    (alimente Smart Bidding sans skewer attribution primary)
    //  - add_to_cart côté Ads → secondary conversion → broadcast aussi
    // Seuls les PRIMARY (Purchase/Lead côté Meta, recommendedRole='primary'
    // côté Ads) sont attribution-gated.
    const plan = buildPlan({
      providers: [
        { id: 'meta', active: true },
        { id: 'googleAds', active: true },
      ],
      envProfiles: [
        {
          env: 'production',
          config: {
            metaPixelId: '1234',
            googleAdsConversionId: 'AW-1',
            googleAdsConversionLabels: {
              purchase: 'P',
              checkout_intent: 'CI',
              add_to_cart: 'A2C',
            },
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        {
          key: 'purchase',
          providers: { meta: true, googleAds: true },
        },
        {
          key: 'checkout_intent',
          providers: { meta: true, googleAds: true },
        },
        {
          key: 'add_to_cart',
          providers: { meta: true, googleAds: true },
        },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const triggers = (result.json as any).containerVersion.trigger;

    // ── Meta side ──
    // purchase → Purchase (Meta primary) → attribution-gated
    const metaPurchase = tags.find((t: any) =>
      t.name.startsWith('Meta Evt — purchase'),
    );
    const metaPurchaseTrigger = triggers.find(
      (t: any) => t.triggerId === metaPurchase.firingTriggerId[0],
    );
    expect(metaPurchaseTrigger.name).toBe('CE — purchase [attr / meta]');

    // checkout_intent → InitiateCheckout (Meta non-primary) → broadcast
    const metaCheckout = tags.find((t: any) =>
      t.name.startsWith('Meta Evt — checkout_intent'),
    );
    const metaCheckoutTrigger = triggers.find(
      (t: any) => t.triggerId === metaCheckout.firingTriggerId[0],
    );
    expect(metaCheckoutTrigger.name).toBe('CE — checkout_intent');
    expect(metaCheckoutTrigger.filter).toBeUndefined();

    // add_to_cart → AddToCart (Meta non-primary) → broadcast
    const metaAtc = tags.find((t: any) =>
      t.name.startsWith('Meta Evt — add_to_cart'),
    );
    const metaAtcTrigger = triggers.find(
      (t: any) => t.triggerId === metaAtc.firingTriggerId[0],
    );
    expect(metaAtcTrigger.name).toBe('CE — add_to_cart');

    // ── Google Ads side ──
    // purchase → recommendedRole=primary → attribution-gated
    const adsPurchase = tags.find(
      (t: any) => t.type === 'awct' && t.name.includes('purchase'),
    );
    const adsPurchaseTrigger = triggers.find(
      (t: any) => t.triggerId === adsPurchase.firingTriggerId[0],
    );
    expect(adsPurchaseTrigger.name).toBe('CE — purchase [attr / google_ads]');

    // checkout_intent → recommendedRole=secondary → broadcast
    const adsCheckout = tags.find(
      (t: any) => t.type === 'awct' && t.name.includes('checkout_intent'),
    );
    const adsCheckoutTrigger = triggers.find(
      (t: any) => t.triggerId === adsCheckout.firingTriggerId[0],
    );
    expect(adsCheckoutTrigger.name).toBe('CE — checkout_intent');
    expect(adsCheckoutTrigger.filter).toBeUndefined();

    // add_to_cart → recommendedRole=secondary → broadcast
    const adsAtc = tags.find(
      (t: any) => t.type === 'awct' && t.name.includes('add_to_cart'),
    );
    const adsAtcTrigger = triggers.find(
      (t: any) => t.triggerId === adsAtc.firingTriggerId[0],
    );
    expect(adsAtcTrigger.name).toBe('CE — add_to_cart');
  });

  it('audience events (isConversion=false) do NOT receive attribution gating', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'meta', active: true },
      ],
      envProfiles: [
        {
          env: 'production',
          config: { ga4MeasurementId: 'G-X', metaPixelId: '1234', gtmContainerId: 'GTM-Y' },
        },
      ],
      // page_view est isConversion: false dans event-catalog
      events: [{ key: 'page_view', providers: { ga4: true, meta: true } }],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const triggers = (result.json as any).containerVersion.trigger;

    // Aucun trigger [attr / meta] pour page_view (audience)
    const attrTriggers = triggers.filter((t: any) => t.name.includes('[attr / '));
    expect(attrTriggers).toHaveLength(0);

    // Le tag Meta pour page_view utilise le trigger standard
    const metaTag = tags.find((t: any) => t.name.includes('Meta Evt — page_view'));
    const standardTrigger = triggers.find((t: any) => t.name === 'CE — page_view');
    expect(metaTag.firingTriggerId).toEqual([standardTrigger.triggerId]);
  });

  it('DLV - attribution.channel is created when attribution triggers fire', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'meta', active: true },
      ],
      envProfiles: [
        {
          env: 'production',
          config: { ga4MeasurementId: 'G-X', metaPixelId: '1234', gtmContainerId: 'GTM-Y' },
        },
      ],
      events: [{ key: 'purchase', providers: { ga4: true, meta: true } }],
    });
    const result = exportPlan(plan, 'production');
    const variables = (result.json as any).containerVersion.variable;
    const dlv = variables.find((v: any) => v.name === 'DLV - attribution.channel');
    expect(dlv).toBeDefined();
    expect(dlv.type).toBe('v');
    const nameParam = dlv.parameter.find((p: any) => p.key === 'name');
    expect(nameParam.value).toBe('attribution.channel');
  });

  it('CONST - Google Ads Conversion ID strip le préfixe AW- (sinon double prefix AW-AW-)', () => {
    // GTM tag template `awct` ré-applique le prefix `AW-` au
    // conversionId. Si on passe "AW-18136327114" dans la CONST, le
    // ping final devient AW-AW-18136327114/label et Google Ads ne
    // compte aucune conversion.
    const plan = buildPlan({
      providers: [{ id: 'googleAds', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            googleAdsConversionId: 'AW-18136327114', // user form expects AW- prefix
            googleAdsConversionLabels: { purchase: 'LABEL_X' },
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [{ key: 'purchase', providers: { googleAds: true } }],
    });
    const result = exportPlan(plan, 'production');
    const variables = (result.json as any).containerVersion.variable;
    const constId = variables.find(
      (v: any) => v.name === 'CONST - Google Ads Conversion ID',
    );
    expect(constId).toBeDefined();
    const valueParam = constId.parameter.find((p: any) => p.key === 'value');
    // Le CONST contient le numéro brut (sans AW-) pour que GTM
    // construise correctement AW-<id>/<label>.
    expect(valueParam.value).toBe('18136327114');
    expect(valueParam.value).not.toMatch(/^AW-/);
  });

  it('chaque CUSTOM_EVENT trigger a au plus UN entry dans customEventFilter (limite GTM)', () => {
    // GTM rejette l'import si un trigger CUSTOM_EVENT a >1 entry dans
    // customEventFilter avec : "Un déclencheur d'événement personnalisé
    // doit comporter un seul filtre d'événement personnalisé".
    // Les conditions additionnelles doivent passer dans `filter`.
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'meta', active: true },
        { id: 'googleAds', active: true },
        { id: 'tiktok', active: true },
      ],
      envProfiles: [
        {
          env: 'production',
          config: {
            ga4MeasurementId: 'G-X',
            metaPixelId: '1234',
            googleAdsConversionId: 'AW-X',
            googleAdsConversionLabels: { purchase: 'LABEL' },
            tiktokPixelId: 'TIKTOKID12345',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'purchase', providers: { ga4: true, meta: true, googleAds: true, tiktok: true } },
        { key: 'page_view', providers: { ga4: true, meta: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const triggers = (result.json as any).containerVersion.trigger;
    for (const t of triggers) {
      if (t.type !== 'CUSTOM_EVENT') continue;
      const filters = t.customEventFilter ?? [];
      expect(
        filters.length,
        `Trigger "${t.name}" a ${filters.length} customEventFilter (>1 → GTM rejette l'import)`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('aucun nom (tag/trigger/variable) ne contient des caractères refusés par l\'import GTM', () => {
    // GTM rejette l'import si un name contient `:`, `,`, ou `;` :
    // "The name contains invalid character: ':'".
    // Source : https://support.google.com/tagmanager/answer/10165367
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'meta', active: true },
        { id: 'googleAds', active: true },
        { id: 'tiktok', active: true },
      ],
      envProfiles: [
        {
          env: 'production',
          config: {
            ga4MeasurementId: 'G-X',
            metaPixelId: '1234',
            googleAdsConversionId: 'AW-X',
            googleAdsConversionLabels: { purchase: 'LABEL' },
            tiktokPixelId: 'TIKTOKID12345',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'purchase', providers: { ga4: true, meta: true, googleAds: true, tiktok: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const cv = (result.json as any).containerVersion;
    const allNames: Array<{ kind: string; name: string }> = [];
    for (const t of cv.tag) allNames.push({ kind: 'tag', name: t.name });
    for (const t of cv.trigger) allNames.push({ kind: 'trigger', name: t.name });
    for (const v of cv.variable) allNames.push({ kind: 'variable', name: v.name });
    const FORBIDDEN = /[:,;]/;
    const bad = allNames.filter((n) => FORBIDDEN.test(n.name));
    expect(
      bad,
      `Noms refusés par GTM : ${bad.map((n) => `${n.kind} "${n.name}"`).join(', ')}`,
    ).toEqual([]);
  });

  it('does NOT emit consentSettings on tags (set via GTM UI / Consent Mode default)', () => {
    // The previous shape emitted consentType arrays that broke the
    // import. Until we can compute the correct LIST<TEMPLATE> shape
    // and target tags by provider semantics, omit the field entirely
    // — GTM will surface the tags as "no consent set" so the user
    // can wire them in the UI without import-time enum errors.
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    for (const t of tags) {
      expect(t).not.toHaveProperty('consentSettings');
    }
  });
});

describe('exportPlan — edge cases', () => {
  it('throws if env profile not found', () => {
    const plan = buildPlan({
      envProfiles: [{ env: 'production', config: { ga4MeasurementId: 'G-5VHP17SDZM' } }],
    });
    expect(() => exportPlan(plan, 'local')).toThrow(/env_profile_not_found/);
  });

  it('handles plan with 0 events', () => {
    const plan = buildPlan({ events: [] });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const triggers = (result.json as any).containerVersion.trigger;
    // Only Config tags (GA4 Cfg + Meta Init), no per-event tags
    expect(tags.filter((t: any) => t.name.includes('Evt')).length).toBe(0);
    // Only the All Pages trigger
    expect(triggers.filter((t: any) => t.type === 'CUSTOM_EVENT').length).toBe(0);
    expect(triggers.filter((t: any) => t.type === 'PAGEVIEW').length).toBe(1);
  });

  it('skips a provider when its env config is missing', () => {
    const plan = buildPlan({
      envProfiles: [{ env: 'production', config: {} }], // no GA4/Meta IDs
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(tags.length).toBe(0); // no Config tag, no event tags
  });
});
