/**
 * Tests Zod AutomationStepSchema V2 — couverture des 7 kinds.
 */
import { describe, it, expect } from 'vitest';
import {
  AutomationStepSchema,
  AUTOMATION_EVENT_CATALOG,
  isValidEventName,
  type AutomationStep,
} from '../step-types-v2';

describe('AutomationStepSchema', () => {
  it('accepts wait step', () => {
    const r = AutomationStepSchema.safeParse({ kind: 'wait', durationMs: 3600_000 });
    expect(r.success).toBe(true);
  });

  it('rejects wait with duration > 90j', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'wait',
      durationMs: 91 * 86_400_000,
    });
    expect(r.success).toBe(false);
  });

  it('accepts send step', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'send',
      template: 'cart-abandoned',
    });
    expect(r.success).toBe(true);
  });

  it('accepts branch step with nested conditions', () => {
    const branch: AutomationStep = {
      kind: 'branch',
      condition: {
        kind: 'all',
        conditions: [{ kind: 'consent_marketing', value: true }],
      },
      ifTrue: [{ kind: 'send', template: 'thank-you' }],
      ifFalse: [{ kind: 'tag', action: 'add', tag: 'no-consent' }],
    };
    const r = AutomationStepSchema.safeParse(branch);
    expect(r.success).toBe(true);
  });

  it('accepts tag step add', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'tag',
      action: 'add',
      tag: 'vip',
    });
    expect(r.success).toBe(true);
  });

  it('rejects tag without action', () => {
    const r = AutomationStepSchema.safeParse({ kind: 'tag', tag: 'vip' });
    expect(r.success).toBe(false);
  });

  it('accepts update_lead step', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'update_lead',
      field: 'status',
      value: 'qualified',
    });
    expect(r.success).toBe(true);
  });

  it('rejects update_lead with unknown field', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'update_lead',
      field: 'foobar',
      value: 'x',
    });
    expect(r.success).toBe(false);
  });

  it('accepts webhook step', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'webhook',
      url: 'https://example.com/hook',
      method: 'POST',
    });
    expect(r.success).toBe(true);
  });

  it('rejects webhook with invalid URL', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'webhook',
      url: 'not a url',
      method: 'POST',
    });
    expect(r.success).toBe(false);
  });

  it('accepts wait_for_event step', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'wait_for_event',
      eventName: 'email.opened',
      timeoutMs: 24 * 3600_000,
    });
    expect(r.success).toBe(true);
  });

  it('rejects wait_for_event with invalid event_name format', () => {
    const r = AutomationStepSchema.safeParse({
      kind: 'wait_for_event',
      eventName: 'Bad Format',
      timeoutMs: 3600_000,
    });
    expect(r.success).toBe(false);
  });
});

describe('AUTOMATION_EVENT_CATALOG', () => {
  it('lists known events with proper structure', () => {
    expect(AUTOMATION_EVENT_CATALOG.length).toBeGreaterThan(10);
    for (const e of AUTOMATION_EVENT_CATALOG) {
      expect(e.name).toMatch(/^[a-z][a-z0-9._]*$/);
      expect(['lifecycle', 'commerce', 'email', 'engagement', 'form']).toContain(e.category);
    }
  });

  it('isValidEventName accepts catalog entries', () => {
    expect(isValidEventName('cart.abandoned')).toBe(true);
    expect(isValidEventName('order.placed')).toBe(true);
    expect(isValidEventName('email.opened')).toBe(true);
  });

  it('isValidEventName rejects unknown events', () => {
    expect(isValidEventName('not.a.real.event')).toBe(false);
    expect(isValidEventName('')).toBe(false);
  });
});
