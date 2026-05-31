import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveOrphanBindings,
  cancelSchedule,
  ConflictError,
  ensureSeedPublishedBinding,
  getDraftBinding,
  getPublishedBinding,
  listAllScheduled,
  listHistory,
  listPublishedBindings,
  listScheduledDue,
  publishBinding,
  purgeFieldHistoryBefore,
  restoreFromHistory,
  scheduleBinding,
  upsertDraftBinding,
} from './component-fields';
import { resetMemoryStore } from '@/lib/db/client';

const componentId = 'cmp_home_hero';

beforeEach(() => {
  resetMemoryStore();
});

describe('upsertDraftBinding', () => {
  it('creates a new draft when none exists (I2)', async () => {
    const b = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'Hello' },
      authorId: 'admin_1',
    });
    expect(b.status).toBe('draft');
    expect(b.version).toBe(1);
    expect(b.value).toEqual({ v: 'Hello' });
  });

  it('reuses the existing draft on second call (I2)', async () => {
    const a = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'A' },
      authorId: 'admin_1',
    });
    const b = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'B' },
      authorId: 'admin_1',
    });
    expect(b.id).toBe(a.id);
    expect(b.value).toEqual({ v: 'B' });
  });

  it('throws ConflictError on stale expectedUpdatedAt (E1)', async () => {
    const initial = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'A' },
      authorId: 'admin_1',
    });
    // Simuler une nouvelle écriture concurrente
    await new Promise((r) => setTimeout(r, 5));
    await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'B' },
      authorId: 'admin_2',
    });
    await expect(
      upsertDraftBinding({
        componentId,
        fieldKey: 'title',
        value: { v: 'C' },
        authorId: 'admin_1',
        expectedUpdatedAt: initial.updatedAt,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('publishBinding', () => {
  it('promotes draft and archives previous published (I3)', async () => {
    // Setup : un published v1 existant
    const v1 = await ensureSeedPublishedBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'V1' },
    });
    expect(v1.version).toBe(1);
    expect(v1.status).toBe('published');

    // Création d'un draft
    const draft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'V2' },
      authorId: 'admin_1',
    });
    // Publication
    const published = await publishBinding({ bindingId: draft.id, actorId: 'admin_1' });
    expect(published.status).toBe('published');
    expect(published.version).toBe(2);

    const current = await getPublishedBinding(componentId, 'title', 'fr');
    expect(current?.id).toBe(published.id);
    expect(current?.value).toEqual({ v: 'V2' });

    // Plus de draft
    expect(await getDraftBinding(componentId, 'title', 'fr')).toBeNull();
  });

  it('handles first publish (no previous published)', async () => {
    const draft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'X' },
      authorId: 'admin_1',
    });
    const pub = await publishBinding({ bindingId: draft.id, actorId: 'admin_1' });
    expect(pub.version).toBe(1);
  });
});

describe('scheduleBinding', () => {
  it('rejects schedule in past (E3)', async () => {
    const draft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'X' },
      authorId: 'admin_1',
    });
    await expect(
      scheduleBinding({
        bindingId: draft.id,
        scheduledAt: new Date(Date.now() - 1000),
        actorId: 'admin_1',
      }),
    ).rejects.toThrow('schedule.in_past');
  });

  it('schedules a draft and lists when due', async () => {
    const draft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'X' },
      authorId: 'admin_1',
    });
    const future = new Date(Date.now() + 120_000);
    await scheduleBinding({ bindingId: draft.id, scheduledAt: future, actorId: 'admin_1' });

    expect(await listScheduledDue(new Date(Date.now() + 60_000))).toHaveLength(0);
    expect(await listScheduledDue(new Date(Date.now() + 200_000))).toHaveLength(1);
  });

  it('cancelSchedule reverts to draft', async () => {
    const draft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'X' },
      authorId: 'admin_1',
    });
    const future = new Date(Date.now() + 120_000);
    const sched = await scheduleBinding({ bindingId: draft.id, scheduledAt: future, actorId: 'admin_1' });
    const back = await cancelSchedule(sched.id, 'admin_1');
    expect(back.status).toBe('draft');
    expect(back.scheduledAt).toBeNull();
  });
});

describe('listPublishedBindings', () => {
  it('returns only published in the requested locale', async () => {
    await ensureSeedPublishedBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'fr' },
    });
    await ensureSeedPublishedBinding({
      componentId,
      fieldKey: 'subtitle',
      value: { v: 'fr-sub' },
    });
    await ensureSeedPublishedBinding({
      componentId,
      fieldKey: 'title',
      locale: 'en',
      value: { v: 'en' },
    });
    const fr = await listPublishedBindings(componentId, 'fr');
    expect(fr).toHaveLength(2);
    const en = await listPublishedBindings(componentId, 'en');
    expect(en).toHaveLength(1);
  });
});

describe('ensureSeedPublishedBinding', () => {
  it('is idempotent (R1)', async () => {
    const first = await ensureSeedPublishedBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'A' },
    });
    const second = await ensureSeedPublishedBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'B' },
    });
    expect(second.id).toBe(first.id);
    expect(second.value).toEqual({ v: 'A' }); // pas écrasé
  });
});

describe('history + restore', () => {
  it('appends history entries on each transition', async () => {
    const draft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'A' },
      authorId: 'admin_1',
    });
    await publishBinding({ bindingId: draft.id, actorId: 'admin_1' });
    const hist = await listHistory(componentId, 'title');
    // Au moins create + publish
    expect(hist.length).toBeGreaterThanOrEqual(2);
    const actions = hist.map((h) => h.action);
    expect(actions).toContain('create');
    expect(actions).toContain('publish');
  });

  it('restoreFromHistory creates a new draft from a snapshot', async () => {
    const draft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'V1' },
      authorId: 'admin_1',
    });
    const v1 = await publishBinding({ bindingId: draft.id, actorId: 'admin_1' });
    const draft2 = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'V2' },
      authorId: 'admin_1',
    });
    await publishBinding({ bindingId: draft2.id, actorId: 'admin_1' });

    const hist = await listHistory(componentId, 'title', 'fr', 100);
    const v1Snapshot = hist.find((h) => h.action === 'publish' && h.value && (h.value as { v: string }).v === 'V1');
    expect(v1Snapshot).toBeDefined();
    const restored = await restoreFromHistory({
      componentId,
      fieldKey: 'title',
      locale: 'fr',
      historyId: v1Snapshot!.id,
      actorId: 'admin_1',
    });
    expect(restored.status).toBe('draft');
    expect(restored.value).toEqual({ v: 'V1' });
  });
});

describe('archiveOrphanBindings', () => {
  it('archives bindings whose fieldKey is no longer in the registry (EC1)', async () => {
    await ensureSeedPublishedBinding({ componentId, fieldKey: 'title', value: { v: 'A' } });
    await ensureSeedPublishedBinding({ componentId, fieldKey: 'kicker', value: { v: 'K' } });
    const count = await archiveOrphanBindings(componentId, ['title']);
    expect(count).toBe(1);
    expect(await getPublishedBinding(componentId, 'kicker', 'fr')).toBeNull();
  });
});

describe('listAllScheduled', () => {
  it('liste tous les bindings programmés triés par scheduledAt asc', async () => {
    const dA = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'A' },
      authorId: 'admin_1',
    });
    const dB = await upsertDraftBinding({
      componentId: 'cmp_other',
      fieldKey: 'subtitle',
      value: { v: 'B' },
      authorId: 'admin_1',
    });
    const future1 = new Date(Date.now() + 60 * 60 * 1000);
    const future2 = new Date(Date.now() + 30 * 60 * 1000);
    await scheduleBinding({ bindingId: dA.id, scheduledAt: future1, actorId: 'admin_1' });
    await scheduleBinding({ bindingId: dB.id, scheduledAt: future2, actorId: 'admin_1' });

    const scheduled = await listAllScheduled();
    expect(scheduled.map((b) => b.fieldKey)).toEqual(['subtitle', 'title']);
  });

  it('exclut les bindings non scheduled', async () => {
    await ensureSeedPublishedBinding({ componentId, fieldKey: 'title', value: { v: 'A' } });
    const scheduled = await listAllScheduled();
    expect(scheduled).toHaveLength(0);
  });
});

describe('purgeFieldHistoryBefore', () => {
  it('supprime les entrées plus anciennes que cutoff mais conserve la dernière par binding', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const draft = await upsertDraftBinding({
        componentId,
        fieldKey: 'title',
        value: { v: 'A' },
        authorId: 'admin_1',
      });
      vi.setSystemTime(new Date('2026-01-15T00:00:00Z'));
      await upsertDraftBinding({
        componentId,
        fieldKey: 'title',
        value: { v: 'B' },
        authorId: 'admin_1',
      });
      vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
      await publishBinding({ bindingId: draft.id, actorId: 'admin_1' });

      const beforeAll = await listHistory(componentId, 'title', 'fr', 100);
      expect(beforeAll.length).toBeGreaterThanOrEqual(3);

      // Cutoff = 2026-01-20 → tout ce qui est < cutoff est candidat,
      // sauf l'entrée la plus récente par binding (qui est conservée).
      const cutoff = new Date('2026-01-20T00:00:00Z');
      const purged = await purgeFieldHistoryBefore(cutoff);
      expect(purged).toBeGreaterThanOrEqual(1);

      const remaining = await listHistory(componentId, 'title', 'fr', 100);
      // L'entrée publish (2026-02-01) doit toujours être là.
      expect(remaining.some((h) => h.action === 'publish')).toBe(true);
      // Au moins une entrée < cutoff a été conservée (la plus récente
      // < cutoff est gardée comme garde-fou).
      expect(remaining.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retourne 0 quand aucune entrée n\'est antérieure à cutoff', async () => {
    await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      value: { v: 'A' },
      authorId: 'admin_1',
    });
    const cutoff = new Date('2020-01-01T00:00:00Z');
    expect(await purgeFieldHistoryBefore(cutoff)).toBe(0);
  });
});

/**
 * T3.8 — isolation des bindings par locale.
 *
 * Le schéma a un index unique partiel `(componentId, fieldKey, locale)` par
 * status. Le repo doit donc traiter FR/AR/EN comme des rows totalement
 * indépendantes : créer en AR ne doit pas écraser ou polluer la row FR.
 */
describe('component-fields — isolation par locale (T3.8)', () => {
  it('getDraftBinding retourne null pour AR quand seul un draft FR existe', async () => {
    await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      locale: 'fr',
      value: { v: 'Bonjour' },
      authorId: 'admin_1',
    });
    expect(await getDraftBinding(componentId, 'title', 'ar')).toBeNull();
    expect(await getDraftBinding(componentId, 'title', 'en')).toBeNull();
    // FR existe bien.
    const fr = await getDraftBinding(componentId, 'title', 'fr');
    expect(fr?.value).toEqual({ v: 'Bonjour' });
    expect(fr?.locale).toBe('fr');
  });

  it('upsertDraftBinding crée des rows indépendantes par locale', async () => {
    const fr = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      locale: 'fr',
      value: { v: 'Bonjour' },
      authorId: 'admin_1',
    });
    const ar = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      locale: 'ar',
      value: { v: 'مرحبا' },
      authorId: 'admin_1',
    });
    const en = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      locale: 'en',
      value: { v: 'Hello' },
      authorId: 'admin_1',
    });
    // 3 IDs distincts → 3 rows.
    expect(new Set([fr.id, ar.id, en.id]).size).toBe(3);
    expect(fr.locale).toBe('fr');
    expect(ar.locale).toBe('ar');
    expect(en.locale).toBe('en');
    // Chaque locale conserve sa valeur.
    expect((await getDraftBinding(componentId, 'title', 'fr'))?.value).toEqual({
      v: 'Bonjour',
    });
    expect((await getDraftBinding(componentId, 'title', 'ar'))?.value).toEqual({
      v: 'مرحبا',
    });
    expect((await getDraftBinding(componentId, 'title', 'en'))?.value).toEqual({
      v: 'Hello',
    });
  });

  it('publishBinding(draft AR) ne touche pas au published FR existant', async () => {
    // FR : déjà publié.
    const frPub = await ensureSeedPublishedBinding({
      componentId,
      fieldKey: 'title',
      locale: 'fr',
      value: { v: 'Bonjour' },
    });
    // AR : draft → publish.
    const arDraft = await upsertDraftBinding({
      componentId,
      fieldKey: 'title',
      locale: 'ar',
      value: { v: 'مرحبا' },
      authorId: 'admin_1',
    });
    const arPub = await publishBinding({
      bindingId: arDraft.id,
      actorId: 'admin_1',
    });
    expect(arPub.locale).toBe('ar');
    expect(arPub.status).toBe('published');

    // FR doit toujours être présent en published et inchangé.
    const frStill = await getPublishedBinding(componentId, 'title', 'fr');
    expect(frStill?.id).toBe(frPub.id);
    expect(frStill?.value).toEqual({ v: 'Bonjour' });
    expect(frStill?.status).toBe('published');
  });
});
