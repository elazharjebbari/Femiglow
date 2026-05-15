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

  it('bundleId differs between production and staging', () => {
    const prod = exportPlan(buildPlan(), 'production');
    const stag = exportPlan(buildPlan(), 'staging');
    expect(prod.bundleId).not.toBe(stag.bundleId);
  });
});

describe('exportPlan — structure GTM', () => {
  it('produces a valid GTM container shape', () => {
    const result = exportPlan(buildPlan(), 'production');
    expect(result.json).toMatchObject({
      exportFormatVersion: 2,
      containerVersion: {
        accountId: expect.any(String),
        tag: expect.any(Array),
        trigger: expect.any(Array),
        variable: expect.any(Array),
      },
    });
  });

  it('contains GA4 tags when GA4 active with events', () => {
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    const ga4Tags = tags.filter((t: any) => t.type === 'gaawe');
    expect(ga4Tags.length).toBe(2);
  });

  it('does not produce GA4 tags when provider inactive', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: false },
        { id: 'meta', active: true },
      ],
    });
    const result = exportPlan(plan, 'production');
    const tags = (result.json as any).containerVersion.tag;
    expect(tags.filter((t: any) => t.type === 'gaawe').length).toBe(0);
  });

  it('exposes IDs as CONST variables (referenced from tags)', () => {
    const result = exportPlan(buildPlan(), 'production');
    const variables = (result.json as any).containerVersion.variable;
    expect(variables).toContainEqual(
      expect.objectContaining({ name: 'CONST - GA4 Measurement ID', type: 'c' }),
    );
  });

  it('includes consent built-in variables', () => {
    const result = exportPlan(buildPlan(), 'production');
    const builtIns = (result.json as any).containerVersion.builtInVariable;
    expect(builtIns).toContainEqual({ type: 'AD_STORAGE' });
    expect(builtIns).toContainEqual({ type: 'ANALYTICS_STORAGE' });
  });

  it('emits trigger.type as SCREAMING_SNAKE_CASE enum values', () => {
    // GTM rejects lowercase camelCase like "pageview" with
    // "Error deserializing enum type [EventType]. Unrecognized value [pageview]".
    const result = exportPlan(buildPlan(), 'production');
    const triggers = (result.json as any).containerVersion.trigger;
    const types = triggers.map((t: any) => t.type);
    expect(types).toContain('PAGEVIEW');
    expect(types).toContain('DOM_READY');
    expect(types).not.toContain('pageview');
    expect(types).not.toContain('domReady');
  });

  it('emits consentType as a LIST Parameter (not a bare array)', () => {
    // GTM's container import rejects `consentType: [{type: "analytics_storage"}]`
    // with "Argument is not an object". The correct shape is a Parameter
    // object wrapping a LIST of TEMPLATE values.
    const result = exportPlan(buildPlan(), 'production');
    const tags = (result.json as any).containerVersion.tag;
    const ga4Tag = tags.find((t: any) => t.type === 'gaawe');
    expect(ga4Tag.consentSettings.consentType).toEqual({
      type: 'LIST',
      list: [{ type: 'TEMPLATE', value: 'analytics_storage' }],
    });
    const metaTag = tags.find((t: any) => t.type === 'cvt_meta');
    expect(metaTag.consentSettings.consentType).toEqual({
      type: 'LIST',
      list: [{ type: 'TEMPLATE', value: 'ad_storage' }],
    });
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
    expect(tags).toHaveLength(0);
  });
});
