import { describe, expect, it } from 'vitest';

import type { TrackingPlan } from '../types';
import { validatePlan } from '../validator';

function buildPlan(overrides: Partial<TrackingPlan> = {}): TrackingPlan {
  return {
    id: 'plan-test',
    name: 'Test',
    status: 'draft',
    version: 1,
    providers: [{ id: 'ga4', active: true }],
    envProfiles: [
      { env: 'production', config: { ga4MeasurementId: 'G-5VHP17SDZM' } },
    ],
    events: [],
    settings: { consentMode: 'v2' },
    createdBy: 'test@femiglow.ma',
    createdAt: new Date('2026-05-14'),
    updatedAt: new Date('2026-05-14'),
    ...overrides,
  };
}

describe('validatePlan — R-001 placeholders', () => {
  it('rejects G-PROD0000 in production', () => {
    const plan = buildPlan({
      envProfiles: [{ env: 'production', config: { ga4MeasurementId: 'G-PROD0000' } }],
    });
    const result = validatePlan(plan);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'R-001')).toBe(true);
  });

  it('warns (not errors) on placeholder in staging', () => {
    const plan = buildPlan({
      envProfiles: [
        { env: 'production', config: { ga4MeasurementId: 'G-5VHP17SDZM' } },
        { env: 'staging', config: { ga4MeasurementId: 'G-STAGING000' } },
      ],
    });
    const result = validatePlan(plan);
    expect(result.errors.some((e) => e.code === 'R-001')).toBe(false);
    expect(result.warnings.some((w) => w.code === 'W-001')).toBe(true);
  });

  it('accepts valid GA4 measurement ID', () => {
    const result = validatePlan(buildPlan());
    expect(result.ok).toBe(true);
  });
});

describe('validatePlan — R-002 at least one provider', () => {
  it('rejects all-inactive providers', () => {
    const plan = buildPlan({
      providers: [{ id: 'ga4', active: false }],
    });
    const result = validatePlan(plan);
    expect(result.errors.some((e) => e.code === 'R-002')).toBe(true);
  });
});

describe('validatePlan — R-003 IDs required for active provider', () => {
  it('rejects active GA4 without measurementId', () => {
    const plan = buildPlan({
      envProfiles: [{ env: 'production', config: {} }],
    });
    const result = validatePlan(plan);
    expect(result.errors.some((e) => e.code === 'R-003')).toBe(true);
  });

  it('tolerates inactive provider without ID', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'tiktok', active: false },
      ],
    });
    const result = validatePlan(plan);
    expect(result.ok).toBe(true);
  });
});

describe('validatePlan — R-004 production env required', () => {
  it('rejects plan without production profile', () => {
    const plan = buildPlan({
      envProfiles: [{ env: 'staging', config: { ga4MeasurementId: 'G-STAG1234' } }],
    });
    const result = validatePlan(plan);
    expect(result.errors.some((e) => e.code === 'R-004')).toBe(true);
  });
});

describe('validatePlan — R-005 unique event keys', () => {
  it('rejects duplicate keys', () => {
    const plan = buildPlan({
      events: [
        { key: 'page_view', providers: { ga4: true } },
        { key: 'page_view', providers: { ga4: true } },
      ],
    });
    const result = validatePlan(plan);
    expect(result.errors.some((e) => e.code === 'R-005')).toBe(true);
  });
});
