import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { logInsightsAudit } from './audit';

beforeEach(() => {
  resetMemoryStore();
});

describe('logInsightsAudit', () => {
  it('crée une entrée audit_events', async () => {
    await logInsightsAudit({
      action: 'analytics.insights.refresh',
      actorId: 'adm_1',
      meta: { trigger: 'manual' },
    });
    expect(memoryStore().auditEvents.size).toBe(1);
    const entry = Array.from(memoryStore().auditEvents.values())[0]!;
    expect(entry.action).toBe('analytics.insights.refresh');
    expect(entry.actorId).toBe('adm_1');
    expect(entry.resourceType).toBe('analytics_insights');
    expect((entry.meta as { trigger: string }).trigger).toBe('manual');
  });

  it('actorId null accepté (cron)', async () => {
    await logInsightsAudit({
      action: 'analytics.insights.refresh',
      actorId: null,
    });
    const entry = Array.from(memoryStore().auditEvents.values())[0]!;
    expect(entry.actorId).toBeNull();
  });

  it('resourceId optionnel', async () => {
    await logInsightsAudit({
      action: 'analytics.insights.export',
      actorId: 'adm_1',
      resourceId: 'export_xyz',
    });
    const entry = Array.from(memoryStore().auditEvents.values())[0]!;
    expect(entry.resourceId).toBe('export_xyz');
  });

  it('toutes les actions sont valides', async () => {
    const actions = [
      'analytics.insights.refresh',
      'analytics.insights.toggle',
      'analytics.insights.settings_update',
      'analytics.insights.export',
      'analytics.insights.drilldown.page',
      'analytics.insights.drilldown.component',
      'analytics.insights.purge',
    ] as const;
    for (const action of actions) {
      await logInsightsAudit({ action, actorId: null });
    }
    expect(memoryStore().auditEvents.size).toBe(actions.length);
  });

  it('meta est conservée intacte', async () => {
    const meta = {
      trigger: 'cron',
      durationsMs: { event: 1000, page: 200 },
      counts: { event: 50 },
      nested: { deep: { value: true } },
    };
    await logInsightsAudit({
      action: 'analytics.insights.refresh',
      actorId: null,
      meta,
    });
    const entry = Array.from(memoryStore().auditEvents.values())[0]!;
    expect(entry.meta).toEqual(meta);
  });
});
