import { describe, it, expect } from 'vitest';
import { reducer, initialState } from './reducer';

describe('reset wizard reducer', () => {
  it('starts at welcome', () => {
    expect(initialState().step).toBe('welcome');
  });

  it('NEXT advances welcome → mode', () => {
    const s = reducer(initialState(), { type: 'NEXT' });
    expect(s.step).toBe('mode');
  });

  it('skips custom step if mode != custom', () => {
    let s = reducer(initialState(), { type: 'NEXT' });
    s = reducer(s, { type: 'SET_MODE', mode: 'soft' });
    s = reducer(s, { type: 'NEXT' });
    expect(s.step).toBe('preservation');
  });

  it('shows custom step for mode=custom', () => {
    let s = reducer(initialState(), { type: 'NEXT' });
    s = reducer(s, { type: 'SET_MODE', mode: 'custom' });
    s = reducer(s, { type: 'NEXT' });
    expect(s.step).toBe('custom');
  });

  it('SET_MODE=hard forces wipeMedia + wipeNextCache', () => {
    let s = initialState();
    s = reducer(s, { type: 'SET_MODE', mode: 'hard' });
    expect(s.wipeMedia).toBe(true);
    expect(s.wipeNextCache).toBe(true);
  });

  it('TOGGLE_PRESERVE refuses admin_users', () => {
    let s = initialState();
    s = reducer(s, { type: 'TOGGLE_PRESERVE', table: 'admin_users' });
    expect(s.preserve).toContain('admin_users');
  });

  it('TOGGLE_PRESERVE toggles regular table', () => {
    let s = initialState();
    s = reducer(s, { type: 'TOGGLE_PRESERVE', table: 'orders' });
    expect(s.preserve).not.toContain('orders');
    s = reducer(s, { type: 'TOGGLE_PRESERVE', table: 'orders' });
    expect(s.preserve).toContain('orders');
  });

  it('EVENT phase.start sets phase to running', () => {
    let s = initialState();
    s = reducer(s, {
      type: 'START_JOB', jobId: 'rst_x',
      plan: {
        mode: 'soft', phases: [
          { name: 'preflight', label: 'P', critical: true, destructive: false, estimatedDurationMs: 100 },
        ],
        dbStrategy: 'none', truncateTables: [], preserveTables: [], seederIds: [], totalEtaMs: 100,
      },
    });
    s = reducer(s, {
      type: 'EVENT',
      event: { type: 'phase.start', jobId: 'rst_x', ts: Date.now(), phase: 'preflight', label: 'P', index: 0, total: 1, estimatedMs: 100 },
    });
    expect(s.phases.preflight?.status).toBe('running');
  });

  it('EVENT job.complete moves to report step', () => {
    let s = initialState();
    s = reducer(s, {
      type: 'START_JOB', jobId: 'rst_x',
      plan: {
        mode: 'soft', phases: [],
        dbStrategy: 'none', truncateTables: [], preserveTables: [], seederIds: [], totalEtaMs: 0,
      },
    });
    s = reducer(s, {
      type: 'EVENT',
      event: {
        type: 'job.complete', jobId: 'rst_x', ts: Date.now(), durationMs: 500,
        summary: { mode: 'soft', durationMs: 500, phasesCompleted: [], phasesFailed: [], warnings: [] },
      },
    });
    expect(s.step).toBe('report');
    expect(s.finalReport?.status).toBe('completed');
  });
});
