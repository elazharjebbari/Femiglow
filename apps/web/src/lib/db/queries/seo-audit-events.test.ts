/**
 * Tests `listSeoAuditEvents`.
 *
 * Stratégie : fallback memoryStore (`db()` retourne null en l'absence de
 * DATABASE_URL). On peuple `memoryStore().auditEvents` à la main et on
 * vérifie le filtrage, le tri, la pagination cursor.
 *
 * Couvre :
 *  - Filtrage par préfixe `seo.` ET par resourceType SEO.
 *  - Tri décroissant createdAt puis id.
 *  - Pagination cursor consomme l'événement après le cursor.
 *  - `nextCursor` est null si pas de page suivante.
 *  - Filtre `action` exact.
 *  - Filtre `actorId`.
 *  - Limites bornées [1, 100].
 *  - Événements non-SEO sont exclus.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore } from '@/lib/db/client';
import type { AuditEvent } from '@/lib/db/types';

import { listSeoAuditEvents } from './seo';

function event(partial: Partial<AuditEvent> & { id: string; action: string }): AuditEvent {
  return {
    actorId: partial.actorId ?? 'adm_test',
    resourceType: partial.resourceType ?? null,
    resourceId: partial.resourceId ?? null,
    meta: partial.meta ?? {},
    createdAt: partial.createdAt ?? new Date(`2026-05-19T10:00:00Z`),
    ...partial,
  };
}

beforeEach(() => {
  const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
  store.auditEvents = new Map();
});

describe('listSeoAuditEvents — filtrage scope SEO', () => {
  it('inclut les events avec action seo.*', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    store.auditEvents.set(
      'ae_1',
      event({ id: 'ae_1', action: 'seo.publish', createdAt: new Date('2026-05-19T10:00:00Z') }),
    );
    store.auditEvents.set(
      'ae_2',
      event({ id: 'ae_2', action: 'orders.create', createdAt: new Date('2026-05-19T10:01:00Z') }),
    );

    const page = await listSeoAuditEvents();
    expect(page.events.map((e) => e.id)).toEqual(['ae_1']);
  });

  it('inclut les events avec resourceType seo_*', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    store.auditEvents.set(
      'ae_1',
      event({
        id: 'ae_1',
        action: 'custom.action',
        resourceType: 'seo_overrides',
        createdAt: new Date('2026-05-19T10:00:00Z'),
      }),
    );
    store.auditEvents.set(
      'ae_2',
      event({
        id: 'ae_2',
        action: 'custom.action',
        resourceType: 'products',
        createdAt: new Date('2026-05-19T10:01:00Z'),
      }),
    );

    const page = await listSeoAuditEvents();
    expect(page.events.map((e) => e.id)).toEqual(['ae_1']);
  });
});

describe('listSeoAuditEvents — tri et pagination', () => {
  it('trie par createdAt DESC puis id DESC', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    store.auditEvents.set(
      'ae_a',
      event({ id: 'ae_a', action: 'seo.create', createdAt: new Date('2026-05-19T10:00:00Z') }),
    );
    store.auditEvents.set(
      'ae_b',
      event({ id: 'ae_b', action: 'seo.publish', createdAt: new Date('2026-05-19T11:00:00Z') }),
    );
    // Même createdAt — tie-break par id DESC.
    store.auditEvents.set(
      'ae_c',
      event({ id: 'ae_c', action: 'seo.update', createdAt: new Date('2026-05-19T11:00:00Z') }),
    );

    const page = await listSeoAuditEvents();
    expect(page.events.map((e) => e.id)).toEqual(['ae_c', 'ae_b', 'ae_a']);
  });

  it('respecte la limite et expose nextCursor quand il y a plus de pages', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    for (let i = 0; i < 5; i++) {
      const id = `ae_${i}`;
      store.auditEvents.set(
        id,
        event({
          id,
          action: 'seo.publish',
          createdAt: new Date(`2026-05-19T1${i}:00:00Z`),
        }),
      );
    }

    const page = await listSeoAuditEvents({ limit: 2 });
    expect(page.events).toHaveLength(2);
    expect(page.nextCursor).toBe(page.events.at(-1)?.id);
  });

  it('nextCursor=null sur la dernière page', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    store.auditEvents.set(
      'ae_1',
      event({ id: 'ae_1', action: 'seo.publish', createdAt: new Date('2026-05-19T10:00:00Z') }),
    );

    const page = await listSeoAuditEvents({ limit: 20 });
    expect(page.nextCursor).toBeNull();
  });

  it('le cursor consomme l\'événement après le cursor (sans le réinclure)', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    for (let i = 0; i < 4; i++) {
      const id = `ae_${i}`;
      store.auditEvents.set(
        id,
        event({
          id,
          action: 'seo.publish',
          createdAt: new Date(`2026-05-19T1${i}:00:00Z`),
        }),
      );
    }

    // 1re page (les 2 plus récents : ae_3, ae_2)
    const p1 = await listSeoAuditEvents({ limit: 2 });
    expect(p1.events.map((e) => e.id)).toEqual(['ae_3', 'ae_2']);
    expect(p1.nextCursor).toBe('ae_2');

    // 2e page (suite : ae_1, ae_0)
    const p2 = await listSeoAuditEvents({ limit: 2, cursor: p1.nextCursor ?? undefined });
    expect(p2.events.map((e) => e.id)).toEqual(['ae_1', 'ae_0']);
    expect(p2.nextCursor).toBeNull();
  });
});

describe('listSeoAuditEvents — filtres', () => {
  it('filtre par action exacte', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    store.auditEvents.set(
      'ae_a',
      event({ id: 'ae_a', action: 'seo.publish' }),
    );
    store.auditEvents.set(
      'ae_b',
      event({ id: 'ae_b', action: 'seo.unpublish' }),
    );

    const page = await listSeoAuditEvents({ action: 'seo.publish' });
    expect(page.events.map((e) => e.id)).toEqual(['ae_a']);
  });

  it('filtre par actorId', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    store.auditEvents.set(
      'ae_a',
      event({ id: 'ae_a', action: 'seo.publish', actorId: 'adm_x' }),
    );
    store.auditEvents.set(
      'ae_b',
      event({ id: 'ae_b', action: 'seo.publish', actorId: 'adm_y' }),
    );

    const page = await listSeoAuditEvents({ actorId: 'adm_y' });
    expect(page.events.map((e) => e.id)).toEqual(['ae_b']);
  });
});

describe('listSeoAuditEvents — bornes de limite', () => {
  it('limit < 1 → clamped à 1', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    store.auditEvents.set('ae_1', event({ id: 'ae_1', action: 'seo.publish' }));
    store.auditEvents.set('ae_2', event({ id: 'ae_2', action: 'seo.publish' }));

    const page = await listSeoAuditEvents({ limit: 0 });
    expect(page.events).toHaveLength(1);
  });

  it('limit > 100 → clamped à 100', async () => {
    const store = memoryStore() as unknown as { auditEvents: Map<string, AuditEvent> };
    for (let i = 0; i < 150; i++) {
      const id = `ae_${String(i).padStart(3, '0')}`;
      store.auditEvents.set(
        id,
        event({ id, action: 'seo.publish', createdAt: new Date(2026, 4, 1, 0, i) }),
      );
    }

    const page = await listSeoAuditEvents({ limit: 200 });
    expect(page.events.length).toBeLessThanOrEqual(100);
  });
});
