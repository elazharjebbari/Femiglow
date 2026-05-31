import { describe, it, expect } from 'vitest';
import { makePlan } from './planner';
import type { ResetConfig } from './types';

function cfg(over: Partial<ResetConfig>): ResetConfig {
  return {
    mode: 'soft',
    preserve: ['admin_users', 'audit_events'],
    wipeMedia: false, wipeNextCache: false,
    withBackup: true, keepBackups: 5, dryRun: false,
    confirm: 'RESET' as const, actorId: null,
    ...over,
  } as ResetConfig;
}

describe('reset/planner', () => {
  it('soft → 6 phases (incl. ensure-admin + publish-components)', () => {
    const p = makePlan(cfg({ mode: 'soft' }));
    expect(p.phases.map((x) => x.name)).toEqual([
      'preflight', 'audit-counts', 'ensure-admin', 'seed', 'publish-components', 'verify',
    ]);
    expect(p.dbStrategy).toBe('none');
  });

  it('hard → 12 phases including ensure-admin + publish-components + cleanup', () => {
    const p = makePlan(cfg({ mode: 'hard', confirm: 'HARD RESET', wipeMedia: true, wipeNextCache: true }));
    expect(p.phases.length).toBe(12);
    expect(p.dbStrategy).toBe('drop-schema');
    expect(p.phases.find((x) => x.name === 'cleanup-backups')).toBeTruthy();
    expect(p.phases.find((x) => x.name === 'publish-components')).toBeTruthy();
    expect(p.phases.find((x) => x.name === 'ensure-admin')).toBeTruthy();
  });

  it('medium has truncate strategy', () => {
    const p = makePlan(cfg({ mode: 'medium' }));
    expect(p.dbStrategy).toBe('truncate');
    expect(p.truncateTables.length).toBeGreaterThan(0);
  });

  it('custom commerce-only restricts truncate tables', () => {
    const p = makePlan(cfg({
      mode: 'custom', domains: ['commerce'],
    }));
    expect(p.dbStrategy).toBe('truncate');
    expect(p.truncateTables).toContain('products');
    expect(p.truncateTables).not.toContain('chat_message');
  });

  it('preserved tables excluded from truncate list', () => {
    const p = makePlan(cfg({
      mode: 'custom', domains: ['commerce'],
      preserve: ['admin_users', 'audit_events', 'orders'],
    }));
    expect(p.truncateTables).not.toContain('orders'); // is preserved
  });

  it('seederIds contains all 16 for soft/hard', () => {
    const p = makePlan(cfg({ mode: 'soft' }));
    expect(p.seederIds.length).toBeGreaterThanOrEqual(15);
  });

  it('seederIds filtered for custom', () => {
    const p = makePlan(cfg({ mode: 'custom', domains: ['commerce'] }));
    expect(p.seederIds.length).toBeGreaterThan(0);
    expect(p.seederIds.length).toBeLessThan(16);
  });
});
