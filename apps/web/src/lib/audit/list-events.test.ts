import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { logAuditEvent } from './log-event';
import {
  listAuditEventsByResourceType,
  listAuditEventsForResource,
} from './list-events';

beforeEach(() => {
  resetMemoryStore();
});

describe('listAuditEventsByResourceType', () => {
  it('retourne uniquement les events d\'un type, triés desc par createdAt', async () => {
    await logAuditEvent({
      action: 'field.publish',
      actorId: 'adm_1',
      resourceType: 'component_field_binding',
      resourceId: 'cfb_1',
    });
    await new Promise((r) => setTimeout(r, 5));
    await logAuditEvent({
      action: 'media.create',
      actorId: 'adm_1',
      resourceType: 'media',
      resourceId: 'me_1',
    });
    await new Promise((r) => setTimeout(r, 5));
    await logAuditEvent({
      action: 'field.restore',
      actorId: 'adm_1',
      resourceType: 'component_field_binding',
      resourceId: 'cfb_2',
    });

    const events = await listAuditEventsByResourceType('component_field_binding', 10);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.action)).toEqual(['field.restore', 'field.publish']);
  });

  it('respecte la limite', async () => {
    for (let i = 0; i < 5; i++) {
      await logAuditEvent({
        action: `field.update${i}`,
        actorId: 'adm_1',
        resourceType: 'component_field_binding',
        resourceId: `cfb_${i}`,
      });
    }
    const events = await listAuditEventsByResourceType('component_field_binding', 3);
    expect(events).toHaveLength(3);
  });

  it('liste vide si pas d\'events de ce type', async () => {
    await logAuditEvent({
      action: 'media.create',
      actorId: 'adm_1',
      resourceType: 'media',
      resourceId: 'me_1',
    });
    expect(await listAuditEventsByResourceType('component_field_binding')).toEqual([]);
  });
});

describe('listAuditEventsForResource (régression)', () => {
  it('filtre par type + id', async () => {
    await logAuditEvent({
      action: 'field.publish',
      actorId: 'adm_1',
      resourceType: 'component_field_binding',
      resourceId: 'cfb_target',
    });
    await logAuditEvent({
      action: 'field.update',
      actorId: 'adm_1',
      resourceType: 'component_field_binding',
      resourceId: 'cfb_other',
    });
    const ev = await listAuditEventsForResource('component_field_binding', 'cfb_target');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.action).toBe('field.publish');
  });
});
