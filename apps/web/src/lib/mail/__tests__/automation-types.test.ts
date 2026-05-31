import { describe, it, expect } from 'vitest';
import {
  automationStepSchema,
  automationStepsSchema,
  waitStepSchema,
  sendStepSchema,
} from '../automation/types';

describe('automation/types', () => {
  describe('waitStepSchema', () => {
    it('accepts a valid wait step', () => {
      const r = waitStepSchema.safeParse({ kind: 'wait', durationMs: 3600000 });
      expect(r.success).toBe(true);
    });

    it('accepts label as optional', () => {
      const r = waitStepSchema.safeParse({
        kind: 'wait',
        durationMs: 60_000,
        label: 'Wait 1 min',
      });
      expect(r.success).toBe(true);
    });

    it('rejects negative or zero duration', () => {
      expect(waitStepSchema.safeParse({ kind: 'wait', durationMs: 0 }).success).toBe(false);
      expect(waitStepSchema.safeParse({ kind: 'wait', durationMs: -1 }).success).toBe(false);
    });

    it('rejects non-integer duration', () => {
      expect(waitStepSchema.safeParse({ kind: 'wait', durationMs: 1.5 }).success).toBe(false);
    });
  });

  describe('sendStepSchema', () => {
    it('accepts a valid send step', () => {
      const r = sendStepSchema.safeParse({
        kind: 'send',
        template: 'contact-acknowledgement',
        payloadKeys: ['firstName'],
      });
      expect(r.success).toBe(true);
    });

    it('rejects when payloadKeys missing', () => {
      const r = sendStepSchema.safeParse({
        kind: 'send',
        template: 'contact-acknowledgement',
      });
      expect(r.success).toBe(false);
    });

    it('accepts empty payloadKeys', () => {
      const r = sendStepSchema.safeParse({
        kind: 'send',
        template: 'x',
        payloadKeys: [],
      });
      expect(r.success).toBe(true);
    });
  });

  describe('automationStepSchema (discriminated)', () => {
    it('rejects unknown kind', () => {
      const r = automationStepSchema.safeParse({ kind: 'foo' });
      expect(r.success).toBe(false);
    });

    it('discriminates between wait and send', () => {
      const wait = automationStepSchema.parse({ kind: 'wait', durationMs: 1000 });
      const send = automationStepSchema.parse({
        kind: 'send',
        template: 't',
        payloadKeys: [],
      });
      expect(wait.kind).toBe('wait');
      expect(send.kind).toBe('send');
    });
  });

  describe('automationStepsSchema', () => {
    it('accepts an empty list', () => {
      expect(automationStepsSchema.parse([])).toEqual([]);
    });

    it('accepts a mixed sequence', () => {
      const seq = [
        { kind: 'wait', durationMs: 60_000 },
        { kind: 'send', template: 'x', payloadKeys: ['a'] },
        { kind: 'wait', durationMs: 3600_000 },
        { kind: 'send', template: 'y', payloadKeys: ['b', 'c'] },
      ];
      const r = automationStepsSchema.safeParse(seq);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toHaveLength(4);
    });

    it('rejects when one step is malformed', () => {
      const seq = [
        { kind: 'wait', durationMs: 60_000 },
        { kind: 'invalid' },
      ];
      expect(automationStepsSchema.safeParse(seq).success).toBe(false);
    });
  });
});
