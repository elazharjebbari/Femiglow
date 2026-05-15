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

  it('emits one PAGEVIEW + one CUSTOM_EVENT trigger per event', () => {
    const result = exportPlan(buildPlan(), 'production');
    const triggers = (result.json as any).containerVersion.trigger;
    expect(triggers.filter((t: any) => t.type === 'PAGEVIEW')).toHaveLength(1);
    expect(triggers.filter((t: any) => t.type === 'CUSTOM_EVENT')).toHaveLength(2);
  });

  it('CUSTOM_EVENT triggers carry an EQUALS customEventFilter on {{_event}}', () => {
    const result = exportPlan(buildPlan(), 'production');
    const triggers = (result.json as any).containerVersion.trigger;
    const ce = triggers.find((t: any) => t.type === 'CUSTOM_EVENT' && t.name.endsWith('purchase'));
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
    expect(awct.name).toBe('Ads Conv — purchase (purchase)');
    const params = Object.fromEntries(
      awct.parameter.map((p: any) => [p.key, p.value]),
    );
    expect(params.conversionId).toBe('{{CONST - Google Ads Conversion ID}}');
    expect(params.conversionLabel).toBe('{{CONST - Ads Label - purchase}}');
    expect(params.conversionCategory).toBe('PURCHASE');
    expect(params.orderId).toBe('{{DLV - ecommerce.transaction_id}}');
    expect(params.currencyCode).toBe('{{DLV - ecommerce.currency}}');
    expect(params.conversionValue).toBe('{{DLV - ecommerce.value}}');
    expect(params.enhancedConversionsAutomaticMode).toBe('true');
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
