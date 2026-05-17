import { describe, expect, it } from 'vitest';

import { trackingPlanInputSchema, trackingPlanSchema } from '../types';

const baseInput = {
  name: 'Test plan',
  providers: [{ id: 'ga4' as const, active: true }],
  envProfiles: [
    {
      env: 'production' as const,
      config: { ga4MeasurementId: 'G-VALID1234' },
    },
  ],
  events: [],
};

describe('trackingPlanInputSchema', () => {
  it('accepts a minimal valid plan input', () => {
    const parsed = trackingPlanInputSchema.parse(baseInput);
    expect(parsed.name).toBe('Test plan');
    expect(parsed.providers).toHaveLength(1);
  });

  it('rejects empty providers array', () => {
    const result = trackingPlanInputSchema.safeParse({ ...baseInput, providers: [] });
    expect(result.success).toBe(false);
  });

  it('rejects event key with uppercase', () => {
    const result = trackingPlanInputSchema.safeParse({
      ...baseInput,
      events: [{ key: 'PageView', providers: { ga4: true } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects event key starting with digit', () => {
    const result = trackingPlanInputSchema.safeParse({
      ...baseInput,
      events: [{ key: '1event', providers: { ga4: true } }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts event key with snake_case', () => {
    const result = trackingPlanInputSchema.safeParse({
      ...baseInput,
      events: [{ key: 'page_view', providers: { ga4: true } }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts Snapchat as a first-class provider and env config', () => {
    const result = trackingPlanInputSchema.safeParse({
      ...baseInput,
      providers: [{ id: 'snap', active: true }],
      envProfiles: [
        {
          env: 'production',
          config: {
            snapPixelId: '6a4f1a2b-1111-4444-9999-abcdefabcdef',
            snapAdvancedMatching: true,
            snapEventMode: 'hybrid',
          },
        },
      ],
      events: [{ key: 'lead_capture', providers: { snap: true } }],
    });
    expect(result.success).toBe(true);
  });
});

describe('trackingPlanSchema (full)', () => {
  it('parses a complete plan', () => {
    const parsed = trackingPlanSchema.parse({
      ...baseInput,
      id: 'plan_001',
      status: 'draft',
      version: 1,
      settings: { consentMode: 'v2' },
      createdBy: 'amal@femiglow.ma',
      createdAt: '2026-05-14T10:00:00Z',
      updatedAt: '2026-05-14T10:00:00Z',
    });
    expect(parsed.id).toBe('plan_001');
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });
});
