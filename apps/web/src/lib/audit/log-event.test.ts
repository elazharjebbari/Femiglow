import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { logAuditEvent } from './log-event';

beforeEach(() => {
  resetMemoryStore();
});

describe('logAuditEvent', () => {
  it('crée un audit_event persisté', async () => {
    const event = await logAuditEvent({
      action: 'admin.login.success',
      actorId: 'a_1',
      resourceType: 'admin_user',
      resourceId: 'a_1',
    });
    expect(event.id).toMatch(/^ae_/);
    expect(memoryStore().auditEvents.size).toBe(1);
  });

  it('défauts null pour resourceType/Id et meta vide', async () => {
    const event = await logAuditEvent({ action: 'system.tick', actorId: null });
    expect(event.resourceType).toBeNull();
    expect(event.resourceId).toBeNull();
    expect(event.meta).toEqual({});
  });

  it('conserve meta', async () => {
    const event = await logAuditEvent({
      action: 'webhook.create',
      actorId: 'a_1',
      meta: { url: 'https://x.test' },
    });
    expect(event.meta).toEqual({ url: 'https://x.test' });
  });
});
