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

  it('emits GA4 Config (googtag) + one GA4 Event tag (gaawe) per event', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(
      tags.filter((t: any) => t.type === 'googtag' && t.name === 'GA4 Cfg'),
    ).toHaveLength(1);
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
    expect(tags.filter((t: any) => t.name === 'GA4 Cfg').length).toBe(0);
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

  it('passes eventID (camelCase) as fbq option for Pixel/CAPI dedup', () => {
    // Meta exige `eventID` (camelCase) en 4ème arg `{}, { eventID }` pour
    // déduper le Pixel client avec la CAPI server-side. Le snake_case
    // `event_id` est ignoré par fbq → pas de dédup → double-comptage.
    // cf. https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag as Array<{
      name: string;
      parameter: Array<{ key: string; value: string }>;
    }>;
    const metaEventTags = tags.filter((t) => t.name.startsWith('Meta Evt — '));
    expect(metaEventTags.length).toBeGreaterThan(0);
    for (const tag of metaEventTags) {
      const html = tag.parameter.find((p) => p.key === 'html')?.value ?? '';
      expect(html, `Tag ${tag.name} should include eventID`).toMatch(
        /eventID:\s*\{\{DLV - event_id\}\}/,
      );
      // Le format ancien `event_id:` (snake_case) en option dedup ne doit
      // plus apparaître dans les tags Meta — il serait ignoré par fbq.
      expect(html, `Tag ${tag.name} must not use snake_case event_id as fbq option`).not.toMatch(
        /\{\s*event_id:\s*\{\{DLV - event_id\}\}\s*\}/,
      );
    }
  });

  it('wires every tag to a firingTriggerId (no orphan tags)', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    for (const t of tags) {
      expect(t.firingTriggerId).toBeDefined();
      expect(t.firingTriggerId.length).toBeGreaterThan(0);
    }
  });

  it('emits one PAGEVIEW + one CUSTOM_EVENT trigger per event (+ attribution triggers for primary conversions)', () => {
    // generate_lead reste primary pour Meta ; purchase est broadcast (C3).
    const plan = buildPlan({
      events: [
        { key: 'page_view', providers: { ga4: true, meta: true } },
        { key: 'purchase', providers: { ga4: true, meta: true } },
        { key: 'generate_lead', providers: { ga4: true, meta: true } },
      ],
    });
    const triggers = (exportPlan(plan, 'production').json as any).containerVersion.trigger;
    expect(triggers.filter((t: any) => t.type === 'PAGEVIEW')).toHaveLength(1);
    // Standard CE triggers : 1 par event (page_view + purchase + generate_lead = 3)
    const standardCE = triggers.filter(
      (t: any) =>
        t.type === 'CUSTOM_EVENT' &&
        t.name.startsWith('CE — ') && // exclut les triggers d'exception (BLK — …)
        !t.name.includes('[attr / ') &&
        !t.name.includes('[lead→purchase]'), // exclut le trigger pixel lead→Purchase
    );
    expect(standardCE).toHaveLength(3);
    // Attribution-gated CE : generate_lead (Meta primary). purchase = broadcast
    // → aucun trigger [attr / meta] pour purchase.
    const attrCE = triggers.filter(
      (t: any) => t.type === 'CUSTOM_EVENT' && t.name.includes('[attr / '),
    );
    expect(attrCE.find((t: any) => t.name === 'CE — generate_lead [attr / meta]')).toBeDefined();
    expect(attrCE.find((t: any) => t.name === 'CE — purchase [attr / meta]')).toBeUndefined();
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

  it('emits Snap Init and per-event snaptr tags with dedup params', () => {
    const plan = buildPlan({
      providers: [{ id: 'snap', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            snapPixelId: '6a4f1a2b-1111-4444-9999-abcdefabcdef',
            snapEventMode: 'hybrid',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'view_item', providers: { snap: true } },
        { key: 'lead_capture', providers: { snap: true } },
        { key: 'purchase', providers: { snap: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const variables = (result.json as any).containerVersion.variable;
    expect(variables).toContainEqual(
      expect.objectContaining({ name: 'CONST - Snap Pixel ID', type: 'c' }),
    );
    expect(tags.find((t: any) => t.name === 'Snap Init')).toBeDefined();
    const view = tags.find((t: any) => t.name === 'Snap Evt — view_item → VIEW_CONTENT');
    expect(view).toBeDefined();
    const lead = tags.find((t: any) => t.name === 'Snap Evt — lead_capture → LEAD');
    expect(lead).toBeDefined();
    const purchase = tags.find((t: any) => t.name === 'Snap Evt — purchase → PURCHASE');
    expect(purchase).toBeDefined();
    const html = purchase.parameter.find((p: any) => p.key === 'html').value;
    expect(html).toContain("snaptr('track','PURCHASE'");
    expect(html).toContain('client_deduplication_id');
    expect(html).toContain('item_ids');
    expect(purchase.setupTag).toEqual([
      { tagName: 'Snap Init', stopOnSetupFailure: false },
    ]);
  });

  it('routes Snap primary conversions via attribution-gated triggers', () => {
    const plan = buildPlan({
      providers: [{ id: 'snap', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            snapPixelId: '6a4f1a2b-1111-4444-9999-abcdefabcdef',
            snapEventMode: 'hybrid',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'purchase', providers: { snap: true } },
        { key: 'checkout_intent', providers: { snap: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const triggers = (result.json as any).containerVersion.trigger;
    const snapPurchase = tags.find((t: any) => t.name === 'Snap Evt — purchase → PURCHASE');
    const snapPurchaseTrigger = triggers.find(
      (t: any) => t.triggerId === snapPurchase.firingTriggerId[0],
    );
    expect(snapPurchaseTrigger.name).toBe('CE — purchase [attr / snap]');
    // C1 — allowlist élargie + chaîne vide (source unique BROADCAST_FALLBACK_CHANNELS)
    expect(snapPurchaseTrigger.filter[0].parameter[1].value).toBe(
      '^(snap|direct|organic|social_organic|email|broadcast|unknown|)$',
    );
    const snapCheckout = tags.find(
      (t: any) => t.name === 'Snap Evt — checkout_intent → START_CHECKOUT',
    );
    const snapCheckoutTrigger = triggers.find(
      (t: any) => t.triggerId === snapCheckout.firingTriggerId[0],
    );
    expect(snapCheckoutTrigger.name).toBe('CE — checkout_intent');
  });

  it('skips Snap GTM tags by default (capi_only) — SnapPixelEvents handles client-side', () => {
    const plan = buildPlan({
      providers: [{ id: 'snap', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            snapPixelId: '6a4f1a2b-1111-4444-9999-abcdefabcdef',
            // No snapEventMode → defaults to capi_only
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'purchase', providers: { snap: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const variables = (result.json as any).containerVersion.variable;
    // No Snap Init tag, no Snap event tags, no CONST Snap Pixel ID
    expect(tags.find((t: any) => t.name === 'Snap Init')).toBeUndefined();
    expect(tags.find((t: any) => t.name.startsWith('Snap Evt'))).toBeUndefined();
    expect(variables.find((v: any) => v.name === 'CONST - Snap Pixel ID')).toBeUndefined();
  });

  // ─── TikTok Init + Evt (parité Meta/Snap) ──────────────────────────
  //
  // Cf. plan-action 2026-05-19 "Intégrer TikTok comme provider de bout-
  // en-bout" — branche feat/tracking-tiktok-init.
  //
  // L'exporter doit produire :
  //   - 1 balise `TikTok Init` (ttq.load + ttq.page) sur PV — All Pages,
  //     ONCE_PER_EVENT, priority 70, dossier `00 — Configuration` (id '1').
  //   - N balises `TikTok Evt — <fg_event> → <TikTokName>` qui :
  //       · utilisent le nom canonique TikTok (Purchase, AddToCart, …),
  //         JAMAIS l'event_key FemiGlow brut ni le legacy CompletePayment ;
  //       · référencent `TikTok Init` via `setupTag` pour garantir que
  //         `ttq` est chargé avant le track (idempotent, GTM gère la dédup) ;
  //       · injectent `event_id` pour dédup Pixel ↔ CAPI (fenêtre 48h).
  //   - 1 variable `CONST - TikTok Pixel ID` valant cfg.tiktokPixelId.
  it('emits TikTok Init tag on PV All Pages with ttq.load + ttq.page', () => {
    const plan = buildPlan({
      providers: [{ id: 'tiktok', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            tiktokPixelId: 'CTIKTOKPIXEL123456',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'view_item', providers: { tiktok: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const json = result.json as any;
    const tags = json.containerVersion.tag;
    const variables = json.containerVersion.variable;
    const triggers = json.containerVersion.trigger;

    const init = tags.find((t: any) => t.name === 'TikTok Init');
    expect(init).toBeDefined();
    expect(init.type).toBe('html');
    expect(init.tagFiringOption).toBe('ONCE_PER_EVENT');
    expect(init.priority).toMatchObject({ type: 'INTEGER', key: 'priority', value: '70' });
    expect(init.parentFolderId).toBe('1');

    // Doit fire sur PV — All Pages (pas un CE)
    const pv = triggers.find(
      (t: any) => t.triggerId === init.firingTriggerId[0],
    );
    expect(pv.type).toBe('PAGEVIEW');

    // Snippet bootstrap officiel TikTok
    const html = init.parameter.find((p: any) => p.key === 'html').value as string;
    expect(html).toContain("ttq.load('CTIKTOKPIXEL123456')");
    expect(html).toContain('ttq.page()');
    expect(html).toContain('https://analytics.tiktok.com/i18n/pixel/events.js');
    expect(html).toContain("TiktokAnalyticsObject");

    // CONST variable câblée
    expect(variables).toContainEqual(
      expect.objectContaining({ name: 'CONST - TikTok Pixel ID', type: 'c' }),
    );
  });

  it('TikTok Evt tags use canonical TikTok names and reference TikTok Init via setupTag', () => {
    const plan = buildPlan({
      providers: [{ id: 'tiktok', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            tiktokPixelId: 'CTIKTOKPIXEL123456',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'view_item', providers: { tiktok: true } },
        { key: 'add_to_cart', providers: { tiktok: true } },
        { key: 'purchase', providers: { tiktok: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;

    // Nom canonique TikTok dans le tag name (parité Snap)
    const view = tags.find((t: any) => t.name === 'TikTok Evt — view_item → ViewContent');
    const cart = tags.find((t: any) => t.name === 'TikTok Evt — add_to_cart → AddToCart');
    const purchase = tags.find((t: any) => t.name === 'TikTok Evt — purchase → Purchase');
    expect(view).toBeDefined();
    expect(cart).toBeDefined();
    expect(purchase).toBeDefined();

    // Le script doit appeler ttq.track avec le nom canonique, pas l'event_key
    const purchaseHtml = purchase.parameter.find((p: any) => p.key === 'html').value as string;
    expect(purchaseHtml).toContain("ttq.track('Purchase'");
    expect(purchaseHtml).not.toContain("ttq.track('purchase'");
    expect(purchaseHtml).not.toContain("ttq.track('CompletePayment'");

    // event_id pour la dédup Pixel ↔ CAPI
    expect(purchaseHtml).toContain('event_id');
    expect(purchaseHtml).toContain('{{DLV - event_id}}');

    // setupTag → TikTok Init garantit que ttq est chargé avant track
    for (const tag of [view, cart, purchase]) {
      expect(tag.setupTag).toEqual([
        { tagName: 'TikTok Init', stopOnSetupFailure: false },
      ]);
    }
  });

  it('skips TikTok tags entirely when tiktokPixelId is missing', () => {
    const plan = buildPlan({
      providers: [{ id: 'tiktok', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: { gtmContainerId: 'GTM-Y' },
        },
      ],
      events: [
        { key: 'purchase', providers: { tiktok: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    const variables = (result.json as any).containerVersion.variable;

    expect(tags.find((t: any) => t.name === 'TikTok Init')).toBeUndefined();
    expect(tags.find((t: any) => t.name.startsWith('TikTok Evt'))).toBeUndefined();
    expect(variables.find((v: any) => v.name === 'CONST - TikTok Pixel ID')).toBeUndefined();
  });

  it('skips TikTok Evt for an event whose mapping has no TikTok standard name', () => {
    // Un event FemiGlow-only (ex: `fg_journal_read_75`) n'a pas de mapping
    // TikTok → on doit skip plutôt que d'émettre `ttq.track('fg_journal_read_75')`
    // qui finirait en custom event non optimisable.
    const plan = buildPlan({
      providers: [{ id: 'tiktok', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            tiktokPixelId: 'CTIKTOKPIXEL123456',
            gtmContainerId: 'GTM-Y',
          },
        },
      ],
      events: [
        { key: 'purchase', providers: { tiktok: true } },
        { key: 'fg_journal_read_75', providers: { tiktok: true } },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(tags.find((t: any) => t.name === 'TikTok Evt — purchase → Purchase')).toBeDefined();
    expect(
      tags.find((t: any) => t.name.startsWith('TikTok Evt — fg_journal_read_75')),
    ).toBeUndefined();
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
    // T-01 — la valeur vit sous params.* (pas ecommerce.*, jamais poussé).
    expect(params.orderId).toBe('{{DLV - transaction_id}}');
    expect(params.currencyCode).toBe('{{DLV - currency}}');
    expect(params.conversionValue).toBe('{{DLV - value}}');
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
    const adsCfg = tags.find((t: any) => t.type === 'googtag' && t.name === 'Ads Cfg');
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
    // NB : la config GA4 est désormais elle aussi un `googtag` ; on cible donc
    // l'absence de la config Ads par son NOM, pas par le type.
    expect(tags.filter((t: any) => t.name === 'Ads Cfg').length).toBe(0);
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

    // Ads + TikTok restent attribution-gated pour purchase. Meta purchase est
    // BROADCAST (C3) → PAS de trigger [attr / meta], le tag Meta fire sur le
    // trigger standard.
    const attrTriggers = triggers.filter(
      (t: any) => t.type === 'CUSTOM_EVENT' && t.name.includes('[attr / '),
    );
    const metaAttr = attrTriggers.find((t: any) => t.name === 'CE — purchase [attr / meta]');
    const adsAttr = attrTriggers.find((t: any) => t.name === 'CE — purchase [attr / google_ads]');
    const ttAttr = attrTriggers.find((t: any) => t.name === 'CE — purchase [attr / tiktok]');
    expect(metaAttr).toBeUndefined(); // C3 — Meta purchase broadcast
    expect(adsAttr).toBeDefined();
    expect(ttAttr).toBeDefined();

    // customEventFilter doit contenir UN SEUL filtre (matching event name).
    // Le filtre d'attribution (MATCH_REGEX) va dans `filter`, pas customEventFilter.
    expect(adsAttr.customEventFilter).toHaveLength(1);
    expect(adsAttr.customEventFilter[0].type).toBe('EQUALS');
    expect(adsAttr.filter).toBeDefined();
    const regexFilter = adsAttr.filter.find((f: any) => f.type === 'MATCH_REGEX');
    expect(regexFilter).toBeDefined();
    expect(regexFilter.parameter[0].value).toBe('{{DLV - attribution.channel}}');
    expect(regexFilter.parameter[1].value).toBe(
      '^(google_ads|direct|organic|social_organic|email|broadcast|unknown|)$',
    );

    // Le tag Meta (broadcast) fire sur le trigger STANDARD, pas un trigger attr.
    const standardTrigger = triggers.find((t: any) => t.name === 'CE — purchase');
    const metaTag = tags.find((t: any) => t.name === 'Meta Evt — purchase (Purchase)');
    expect(metaTag.firingTriggerId).toEqual([standardTrigger.triggerId]);
    // Ads + TikTok câblés sur leur trigger attribution.
    const adsTag = tags.find((t: any) => t.type === 'awct');
    expect(adsTag.firingTriggerId).toEqual([adsAttr.triggerId]);
    const ttTag = tags.find((t: any) => t.name === 'TikTok Evt — purchase → Purchase');
    expect(ttTag.firingTriggerId).toEqual([ttAttr.triggerId]);

    // Le tag GA4 reste sur le trigger standard (analytics neutre)
    const ga4Tag = tags.find((t: any) => t.name === 'GA4 Evt — purchase');
    expect(ga4Tag.firingTriggerId).toEqual([standardTrigger.triggerId]);
  });

  it('Meta purchase porte un blockingTriggerId anti-doublon lead→Purchase (cookie + BLK trigger)', () => {
    const plan = buildPlan({
      providers: [{ id: 'meta', active: true }],
      envProfiles: [
        { env: 'production', config: { metaPixelId: '1234', gtmContainerId: 'GTM-Y' } },
      ],
      events: [{ key: 'purchase', providers: { meta: true } }],
    });
    const json = exportPlan(plan, 'production').json as any;
    const tags = json.containerVersion.tag;
    const metaPurchase = tags.find((t: any) => t.name?.startsWith('Meta Evt — purchase'));
    expect(metaPurchase.blockingTriggerId).toHaveLength(1);
    // Le trigger d'exception existe et lit le cookie.
    const blk = json.containerVersion.trigger.find(
      (t: any) => t.triggerId === metaPurchase.blockingTriggerId[0],
    );
    expect(blk.name).toContain('BLK');
    expect(JSON.stringify(blk.filter)).toContain('Cookie - fg_meta_lead_purchase');
    // La variable 1st-party cookie (type 'k') est émise.
    const cookieVar = json.containerVersion.variable.find(
      (v: any) => v.name === 'Cookie - fg_meta_lead_purchase' && v.type === 'k',
    );
    expect(cookieVar).toBeDefined();
    // Un event NON-purchase (ex. view_item) n'a PAS de blockingTriggerId Meta.
    const plan2 = buildPlan({
      providers: [{ id: 'meta', active: true }],
      envProfiles: [{ env: 'production', config: { metaPixelId: '1234', gtmContainerId: 'GTM-Y' } }],
      events: [{ key: 'view_item', providers: { meta: true } }],
    });
    const json2 = exportPlan(plan2, 'production').json as any;
    const metaView = json2.containerVersion.tag.find((t: any) => t.name?.startsWith('Meta Evt — view_item'));
    expect(metaView.blockingTriggerId).toBeUndefined();
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
    // purchase → Purchase (Meta BROADCAST depuis C3) → trigger STANDARD
    const metaPurchase = tags.find((t: any) =>
      t.name.startsWith('Meta Evt — purchase'),
    );
    const metaPurchaseTrigger = triggers.find(
      (t: any) => t.triggerId === metaPurchase.firingTriggerId[0],
    );
    expect(metaPurchaseTrigger.name).toBe('CE — purchase');
    expect(metaPurchaseTrigger.filter).toBeUndefined();

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
      // generate_lead reste primary pour Meta (purchase = broadcast depuis C3)
      // → c'est lui qui crée le trigger attribution + la DLV.
      events: [{ key: 'generate_lead', providers: { ga4: true, meta: true } }],
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

describe('exportPlan — valeur de conversion (T-01/T-02/T-03)', () => {
  // T-01 — les DLV de conversion lisent params.* (pas ecommerce.*)
  it('DLV - value/currency/transaction_id lisent params.* (jamais ecommerce.*)', () => {
    const variables = (exportPlan(buildPlan(), 'production').json as any)
      .containerVersion.variable;
    const pathOf = (name: string) =>
      variables
        .find((v: any) => v.name === name)
        ?.parameter.find((p: any) => p.key === 'name')?.value;
    expect(pathOf('DLV - value')).toBe('params.value');
    expect(pathOf('DLV - currency')).toBe('params.currency');
    expect(pathOf('DLV - transaction_id')).toBe('params.transaction_id');
    // L'ancien chemin buggé ne doit plus exister.
    expect(variables.find((v: any) => v.name === 'DLV - ecommerce.value')).toBeUndefined();
  });

  // T-02 — GA4 (gaawe) transmet la valeur pour les events monétaires
  it('GA4 (gaawe) transmet value/currency/transaction_id pour purchase', () => {
    const tags = (exportPlan(buildPlan(), 'production').json as any).containerVersion.tag;
    const ga4 = tags.find((t: any) => t.name === 'GA4 Evt — purchase');
    const settings = ga4.parameter.find((p: any) => p.key === 'eventSettingsTable');
    expect(settings).toBeDefined();
    const rows = settings.list.map((row: any) => {
      const m = Object.fromEntries(row.map.map((x: any) => [x.key, x.value]));
      return [m.parameter, m.parameterValue];
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        ['value', '{{DLV - value}}'],
        ['currency', '{{DLV - currency}}'],
        ['transaction_id', '{{DLV - transaction_id}}'],
      ]),
    );
  });

  it('GA4 (gaawe) n’ajoute PAS de eventSettingsTable pour page_view (non monétaire)', () => {
    const tags = (exportPlan(buildPlan(), 'production').json as any).containerVersion.tag;
    const ga4Pv = tags.find((t: any) => t.name === 'GA4 Evt — page_view');
    expect(ga4Pv.parameter.find((p: any) => p.key === 'eventSettingsTable')).toBeUndefined();
  });

  // T-03 — Meta (fbq) injecte value/currency en custom_data pour les conversions
  it('Meta (fbq) injecte value/currency en custom_data pour purchase', () => {
    const tags = (exportPlan(buildPlan(), 'production').json as any).containerVersion.tag;
    const meta = tags.find((t: any) => t.name === 'Meta Evt — purchase (Purchase)');
    const html = meta.parameter.find((p: any) => p.key === 'html').value;
    expect(html).toContain("{ value: {{DLV - value}}, currency: '{{DLV - currency}}' }");
    expect(html).toContain('eventID: {{DLV - event_id}}');
  });

  it('Meta (fbq) garde un custom_data vide pour page_view (non valorisé)', () => {
    const tags = (exportPlan(buildPlan(), 'production').json as any).containerVersion.tag;
    const meta = tags.find((t: any) => t.name.startsWith('Meta Evt — page_view'));
    const html = meta.parameter.find((p: any) => p.key === 'html').value;
    expect(html).toContain("fbq('track', 'PageView', {},");
  });

  // T-06 (câblage) — generate_lead est valorisé côté GA4 ET Meta
  it('generate_lead transmet la valeur à GA4 et Meta', () => {
    const plan = buildPlan({
      events: [{ key: 'generate_lead', providers: { ga4: true, meta: true } }],
    });
    const tags = (exportPlan(plan, 'production').json as any).containerVersion.tag;
    const ga4 = tags.find((t: any) => t.name === 'GA4 Evt — generate_lead');
    expect(ga4.parameter.find((p: any) => p.key === 'eventSettingsTable')).toBeDefined();
    const meta = tags.find((t: any) => t.name.startsWith('Meta Evt — generate_lead'));
    const html = meta.parameter.find((p: any) => p.key === 'html').value;
    expect(html).toContain('{ value: {{DLV - value}}');
  });
});

describe('exportPlan — langue (page_locale → GA4)', () => {
  it('GA4 Config (googtag) pose page_locale via configSettingsTable (→ envoyé à tous les events)', () => {
    const tags = (exportPlan(buildPlan(), 'production').json as any).containerVersion.tag;
    const cfg = tags.find((t: any) => t.type === 'googtag' && t.name === 'GA4 Cfg');
    const fields = cfg.parameter.find((p: any) => p.key === 'configSettingsTable');
    expect(fields).toBeDefined();
    const rows = fields.list.map((row: any) => {
      const m = Object.fromEntries(row.map.map((x: any) => [x.key, x.value]));
      return [m.parameter, m.parameterValue];
    });
    expect(rows).toEqual(
      expect.arrayContaining([['page_locale', '{{DLV - page.locale}}']]),
    );
  });

  it('DLV - page.locale lit la locale du site (page.locale)', () => {
    const variables = (exportPlan(buildPlan(), 'production').json as any)
      .containerVersion.variable;
    const v = variables.find((x: any) => x.name === 'DLV - page.locale');
    expect(v).toBeDefined();
    expect(v.parameter.find((p: any) => p.key === 'name').value).toBe('page.locale');
  });
});

describe('exportPlan — pont lead→Meta Purchase (pixels Purchase sur les events lead)', () => {
  const leadPlan = () =>
    buildPlan({
      events: [
        { key: 'page_view', providers: { ga4: true, meta: true } },
        { key: 'purchase', providers: { ga4: true, meta: true } },
        { key: 'generate_lead', providers: { ga4: true, meta: true } },
        { key: 'lead_capture', providers: { ga4: true, meta: true } },
      ],
    });

  function cv(plan = leadPlan()) {
    return (exportPlan(plan, 'production').json as any).containerVersion;
  }

  it('crée un pixel Meta Purchase pour generate_lead ET lead_capture', () => {
    const tags = cv().tag;
    const gl = tags.find((t: any) => t.name === 'Meta Evt — generate_lead→Purchase (Purchase)');
    const lc = tags.find((t: any) => t.name === 'Meta Evt — lead_capture→Purchase (Purchase)');
    expect(gl).toBeDefined();
    expect(lc).toBeDefined();
    const html = gl.parameter.find((p: any) => p.key === 'html').value;
    expect(html).toMatch(/fbq\('track', 'Purchase'/);
    // value/currency portés + eventID = jpid de parcours (dédup native)
    expect(html).toMatch(/value:\s*\{\{DLV - value\}\}/);
    expect(html).toMatch(/currency:\s*'\{\{DLV - currency\}\}'/);
    expect(html).toMatch(/eventID:\s*\{\{DLV - meta_purchase_eid\}\}/);
  });

  it('le trigger lead→purchase filtre sur method éligible (jamais newsletter)', () => {
    const triggers = cv().trigger;
    const t = triggers.find((x: any) => x.name === 'CE — generate_lead [lead→purchase]');
    expect(t).toBeDefined();
    expect(t.type).toBe('CUSTOM_EVENT');
    // customEventFilter sur generate_lead + filter regex method ∈ {chat, abandoned_cart}
    expect(t.customEventFilter[0].parameter.find((p: any) => p.key === 'arg1').value).toBe('generate_lead');
    const rgx = t.filter[0].parameter.find((p: any) => p.key === 'arg1').value;
    expect(rgx).toBe('^(chat|abandoned_cart)$');
    expect(rgx).not.toMatch(/newsletter/);
    const lc = triggers.find((x: any) => x.name === 'CE — lead_capture [lead→purchase]');
    expect(lc.filter[0].parameter.find((p: any) => p.key === 'arg1').value).toBe('^(wizard)$');
  });

  it('expose les variables DLV - method et DLV - meta_purchase_eid', () => {
    const vars = cv().variable;
    const method = vars.find((v: any) => v.name === 'DLV - method');
    const eid = vars.find((v: any) => v.name === 'DLV - meta_purchase_eid');
    expect(method.parameter.find((p: any) => p.key === 'name').value).toBe('params.method');
    expect(eid.parameter.find((p: any) => p.key === 'name').value).toBe('params.meta_purchase_eid');
  });

  it('le pixel lead→Purchase est broadcast (fire sur son propre trigger, pas attribution-gated)', () => {
    const c = cv();
    const tag = c.tag.find((t: any) => t.name === 'Meta Evt — generate_lead→Purchase (Purchase)');
    const trigName = c.trigger.find((t: any) => t.triggerId === tag.firingTriggerId[0]).name;
    expect(trigName).toBe('CE — generate_lead [lead→purchase]');
    expect(trigName).not.toContain('[attr / ');
  });
});
