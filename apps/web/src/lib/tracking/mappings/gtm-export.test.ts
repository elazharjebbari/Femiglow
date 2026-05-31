import { describe, expect, it } from 'vitest';
import { buildGtmContainer } from './gtm-export';
import type { Mappings } from './types';

const buildCell = (mappedName: string | null, isCustom = false, isEnabled = true) => ({
  mappedName,
  isCustom,
  isEnabled,
  notes: null,
});

const buildMappings = (overrides: Partial<Mappings> = {}): Mappings => ({
  purchase: {
    meta: buildCell('Purchase'),
    google_ga4: buildCell('purchase'),
    google_ads: buildCell('purchase'),
    tiktok: buildCell('CompletePayment'),
    snap: buildCell('PURCHASE'),
    pinterest: buildCell('checkout'),
  },
  ...overrides,
});

describe('buildGtmContainer', () => {
  it('produit exportFormatVersion=2', () => {
    const r = buildGtmContainer({ mappings: buildMappings(), env: 'production' });
    expect(r.containerJson.exportFormatVersion).toBe(2);
  });

  it('génère 1 trigger par event canonique', () => {
    const r = buildGtmContainer({ mappings: buildMappings(), env: 'production' });
    expect(r.containerJson.containerVersion.trigger).toHaveLength(1);
    expect(r.containerJson.containerVersion.trigger[0]!.name).toContain('purchase');
  });

  it('génère 1 tag par cellule isEnabled=true && mappedName!=null', () => {
    const r = buildGtmContainer({ mappings: buildMappings(), env: 'production' });
    // 1 event × 6 providers tous actifs = 6 tags
    expect(r.containerJson.containerVersion.tag).toHaveLength(6);
  });

  it('skip les cellules isEnabled=false', () => {
    const m = buildMappings();
    m.purchase!.meta = buildCell('Purchase', false, false);
    const r = buildGtmContainer({ mappings: m, env: 'production' });
    expect(r.containerJson.containerVersion.tag).toHaveLength(5);
  });

  it('skip les cellules mappedName=null', () => {
    const m = buildMappings();
    m.purchase!.tiktok = buildCell(null);
    const r = buildGtmContainer({ mappings: m, env: 'production' });
    expect(r.containerJson.containerVersion.tag).toHaveLength(5);
  });

  it('Meta isCustom=true → tag HTML snippet appelle trackCustom avec event name', () => {
    const m = buildMappings();
    m.purchase!.meta = buildCell('checkout_intent', true, true);
    const r = buildGtmContainer({ mappings: m, env: 'production' });
    const metaTag = r.containerJson.containerVersion.tag.find((t) => t.name.includes('meta'));
    expect(metaTag).toBeDefined();
    expect(metaTag!.type).toBe('html');
    const htmlParam = metaTag!.parameter.find((p) => p.key === 'html');
    expect(htmlParam!.value).toContain("fbq('trackCustom'");
    expect(htmlParam!.value).toContain('"checkout_intent"');
  });

  it('sha256 déterministe (même input → même hash)', () => {
    const m = buildMappings();
    const r1 = buildGtmContainer({ mappings: m, env: 'production' });
    const r2 = buildGtmContainer({ mappings: m, env: 'production' });
    expect(r1.meta.sha256).toBe(r2.meta.sha256);
  });

  it('chaque tag référence un trigger existant (round-trip integrity)', () => {
    const m = buildMappings({
      form_start: {
        meta: buildCell('form_start', true),
        google_ga4: buildCell('form_start'),
        google_ads: buildCell(null),
        tiktok: buildCell(null),
        snap: buildCell(null),
        pinterest: buildCell(null),
      },
    });
    const r = buildGtmContainer({ mappings: m, env: 'production' });
    const triggerIds = new Set(r.containerJson.containerVersion.trigger.map((t) => t.triggerId));
    for (const tag of r.containerJson.containerVersion.tag) {
      for (const tid of tag.firingTriggerId) {
        expect(triggerIds.has(tid)).toBe(true);
      }
    }
  });

  it('variables DLV présentes', () => {
    const r = buildGtmContainer({ mappings: buildMappings(), env: 'production' });
    const varNames = r.containerJson.containerVersion.variable.map((v) => v.name);
    expect(varNames).toContain('DLV - event_id');
    expect(varNames).toContain('DLV - currency');
    expect(varNames).toContain('DLV - value');
  });

  it('meta counters cohérents', () => {
    const r = buildGtmContainer({ mappings: buildMappings(), env: 'production' });
    expect(r.meta.eventsCount).toBe(1);
    expect(r.meta.tagsCount).toBe(6);
    expect(r.meta.triggersCount).toBe(1);
    expect(r.meta.variablesCount).toBeGreaterThan(0);
    expect(r.meta.env).toBe('production');
  });
});
