/**
 * Tests step path navigation (resolve, next, descend).
 */
import { describe, it, expect } from 'vitest';
import {
  isValidPath,
  getStepAtPath,
  nextPath,
  descendToExecutable,
  type StepPath,
} from '../step-path';
import type { AutomationStep } from '../../step-types-v2';

const flatSteps: AutomationStep[] = [
  { kind: 'wait', durationMs: 1000 },
  { kind: 'send', template: 't1' },
  { kind: 'tag', action: 'add', tag: 'x' },
];

const branchedSteps: AutomationStep[] = [
  { kind: 'send', template: 'welcome' }, // 0
  {
    kind: 'branch',
    condition: { kind: 'all', conditions: [] },
    ifTrue: [
      { kind: 'send', template: 't-true' }, // 1.ifTrue.0
      { kind: 'tag', action: 'add', tag: 'a' }, // 1.ifTrue.1
    ],
    ifFalse: [
      { kind: 'send', template: 't-false' }, // 1.ifFalse.0
    ],
  },
  { kind: 'wait', durationMs: 5000 }, // 2
];

describe('isValidPath', () => {
  it('accepts simple int paths', () => {
    expect(isValidPath([0])).toBe(true);
    expect(isValidPath([5])).toBe(true);
  });
  it('accepts branch paths', () => {
    expect(isValidPath([1, 'ifTrue', 0])).toBe(true);
    expect(isValidPath([2, 'ifFalse', 1, 'ifTrue', 0])).toBe(true);
  });
  it('rejects branch segment first', () => {
    expect(isValidPath(['ifTrue', 0])).toBe(false);
  });
  it('rejects non-int numbers', () => {
    expect(isValidPath([1.5])).toBe(false);
    expect(isValidPath([-1])).toBe(false);
  });
  it('rejects unknown segments', () => {
    expect(isValidPath([1, 'foo', 0])).toBe(false);
  });
});

describe('getStepAtPath', () => {
  it('returns the top-level step', () => {
    expect(getStepAtPath(flatSteps, [0])?.kind).toBe('wait');
    expect(getStepAtPath(flatSteps, [2])?.kind).toBe('tag');
  });
  it('returns null past end', () => {
    expect(getStepAtPath(flatSteps, [99])).toBeNull();
  });
  it('descends into branches', () => {
    const s = getStepAtPath(branchedSteps, [1, 'ifTrue', 0]);
    expect(s?.kind).toBe('send');
    if (s?.kind === 'send') expect(s.template).toBe('t-true');
  });
  it('returns null for invalid branch target', () => {
    expect(getStepAtPath(flatSteps, [0, 'ifTrue', 0])).toBeNull();
  });
});

describe('nextPath', () => {
  it('advances flat indices', () => {
    expect(nextPath(flatSteps, [0])).toEqual([1]);
    expect(nextPath(flatSteps, [1])).toEqual([2]);
    expect(nextPath(flatSteps, [2])).toBeNull();
  });
  it('advances within branch sub-list', () => {
    expect(nextPath(branchedSteps, [1, 'ifTrue', 0])).toEqual([1, 'ifTrue', 1]);
  });
  it('pops branch frame when sub-list exhausted, advances parent', () => {
    expect(nextPath(branchedSteps, [1, 'ifTrue', 1])).toEqual([2]);
    expect(nextPath(branchedSteps, [1, 'ifFalse', 0])).toEqual([2]);
  });
  it('returns null on full exhaustion', () => {
    expect(nextPath(branchedSteps, [2])).toBeNull();
  });
});

describe('descendToExecutable', () => {
  it('returns same path when step is not a branch', async () => {
    const r = await descendToExecutable(flatSteps, [0], async () => true);
    expect(r).toEqual([0]);
  });
  it('descends into ifTrue when condition true', async () => {
    const r = await descendToExecutable(branchedSteps, [1], async () => true);
    expect(r).toEqual([1, 'ifTrue', 0]);
  });
  it('descends into ifFalse when condition false', async () => {
    const r = await descendToExecutable(branchedSteps, [1], async () => false);
    expect(r).toEqual([1, 'ifFalse', 0]);
  });
  it('skips empty branches', async () => {
    const steps: AutomationStep[] = [
      {
        kind: 'branch',
        condition: { kind: 'all', conditions: [] },
        ifTrue: [],
        ifFalse: [{ kind: 'send', template: 't' }],
      },
      { kind: 'wait', durationMs: 1000 },
    ];
    const r = await descendToExecutable(steps, [0], async () => true);
    // ifTrue is empty → next path skips the branch entirely → [1]
    expect(r).toEqual([1]);
  });
});
