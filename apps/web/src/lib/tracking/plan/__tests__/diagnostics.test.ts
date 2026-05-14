import { describe, it, expect } from 'vitest';
import { computeDrift } from '../diagnostics';
import type { TrackingPlan } from '../types';

function buildPlan(events: Array<{ key: string; providers?: Record<string, boolean> }>): TrackingPlan {
  return {
    id: 'plan_diag',
    name: 'diag',
    status: 'active',
    version: 1,
    providers: [{ id: 'ga4', active: true }],
    envProfiles: [
      {
        env: 'production',
        config: { ga4MeasurementId: 'G-5VHP17SDZM' },
      },
    ],
    events: events.map((e) => ({ key: e.key, providers: e.providers ?? { ga4: true } })),
    settings: {},
    createdBy: 'tester',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('computeDrift', () => {
  const windowStart = new Date('2026-04-01');
  const windowEnd = new Date('2026-04-08');

  it('classe les événements en covered/missing/orphans', () => {
    const plan = buildPlan([
      { key: 'page_view' },
      { key: 'lead_form_submit' },
      { key: 'view_item' },
    ]);
    const report = computeDrift({
      plan,
      observed: [
        { eventName: 'page_view', count: 120 },
        { eventName: 'lead_form_submit', count: 4 },
        { eventName: 'scroll_50', count: 30 },
      ],
      windowStart,
      windowEnd,
    });
    expect(report.covered.map((c) => c.key).sort()).toEqual(['lead_form_submit', 'page_view']);
    expect(report.declaredMissing.map((d) => d.key)).toEqual(['view_item']);
    expect(report.orphans.map((o) => o.key)).toEqual(['scroll_50']);
    expect(report.observedSampleSize).toBe(154);
  });

  it('inclut les providers actifs pour les déclarés-missing', () => {
    const plan = buildPlan([{ key: 'purchase', providers: { ga4: true, metaPixel: true } }]);
    const report = computeDrift({ plan, observed: [], windowStart, windowEnd });
    expect(report.declaredMissing[0]?.providers.sort()).toEqual(['ga4', 'metaPixel']);
  });

  it('un événement avec count=0 compte comme missing', () => {
    const plan = buildPlan([{ key: 'purchase' }]);
    const report = computeDrift({
      plan,
      observed: [{ eventName: 'purchase', count: 0 }],
      windowStart,
      windowEnd,
    });
    expect(report.declaredMissing.map((d) => d.key)).toEqual(['purchase']);
    expect(report.covered).toHaveLength(0);
  });

  it('trie les orphans par count décroissant', () => {
    const plan = buildPlan([]);
    const report = computeDrift({
      plan,
      observed: [
        { eventName: 'a', count: 1 },
        { eventName: 'b', count: 50 },
        { eventName: 'c', count: 10 },
      ],
      windowStart,
      windowEnd,
    });
    expect(report.orphans.map((o) => o.key)).toEqual(['b', 'c', 'a']);
  });
});
