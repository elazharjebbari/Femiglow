/**
 * Tests unitaires — queries `component_media_sets` (memoryStore backend).
 *
 * Couvre (cf. docs/hero-media-par-angle/05-architecture-technique.md §5) :
 *  - I1 un publié + un brouillon au plus par tuple ;
 *  - publication atomique (archive l'ancien, version+1, historique) et
 *    rollback si une étape échoue ;
 *  - conflit If-Match (updatedAt / version) ;
 *  - programmation → promotion par le cron ;
 *  - dépublication, restauration (crée un brouillon) ;
 *  - RESTRICT sur la suppression définitive d'un média référencé ;
 *  - validation (slot, nombre d'items, dimension, média supprimé) ;
 *  - lecture publiée avec médias, triée par position.
 *
 * Le pendant Postgres (index partiels, FK RESTRICT réelles) est dans
 * `component-media-sets.pglite.integration.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetTestDb, __setTestDb, memoryStore, resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { createMedia, hardDeleteMedia, MediaInUseError, softDeleteMedia } from '@/lib/db/queries/media';
import { createVariant } from '@/lib/db/queries/media-variants';
import { KIT_HERO_MEDIA_VARIANTS, type SiteComponentSeed } from '@/lib/components/registry';
import type { ComponentMediaSet, Media } from '@/lib/db/types';
import {
  cancelSetSchedule,
  discardDraft,
  getSetById,
  getSetWithItems,
  MEDIA_SET_DISCARD_NOTE,
  MEDIA_SET_SUPERSEDED_NOTE,
  MediaSetTransactionUnavailableError,
  listPreviewSetsWithMedia,
  listPublishedSetsWithMedia,
  listScheduledDueSets,
  listSetHistory,
  listSetsByComponent,
  MediaSetConflictError,
  MediaSetStateError,
  MediaSetValidationError,
  NotFoundError,
  promoteDueMediaSets,
  promoteScheduledSets,
  publishSet,
  restoreSetFromHistory,
  scheduleSet,
  unpublishSet,
  upsertDraftSet,
} from './component-media-sets';

const SEED: SiteComponentSeed = {
  key: 'kit-hero-produit',
  name: 'Hero Kit (produit)',
  description: 'test',
  category: 'hero',
  pageGroup: 'kit',
  filePath: 'src/components/sections/HeroProduit.tsx',
  slots: [
    { key: 'primary', label: 'Primary', required: true, acceptKinds: ['image'] },
    { key: 'context_1', label: 'C1', required: false, acceptKinds: ['image'] },
    { key: 'context_2', label: 'C2', required: false, acceptKinds: ['image'] },
  ],
  defaultSvgFallback: null,
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
  mediaVariants: KIT_HERO_MEDIA_VARIANTS,
};

let componentId: string;
let m1: Media;
let m2: Media;
let m3: Media;

async function makeMedia(slug: string): Promise<Media> {
  // Médias de test prêts (statut exploitable) avec une variant webp.
  const m = await createMedia({ kind: 'image', source: 'upload', slug, alt: `Alt ${slug}`, status: 'ready' });
  await createVariant({
    mediaId: m.id,
    format: 'webp',
    breakpoint: 'lg',
    width: 1200,
    height: 1500,
    sizeBytes: 1000,
    url: `/_media/${slug}/lg.webp`,
    checksum: slug,
  });
  return m;
}

function draftInput(overrides: Partial<Parameters<typeof upsertDraftSet>[0]> = {}) {
  return {
    componentId,
    slot: 'primary',
    variantDim: 'angle',
    variantKey: 'e',
    locale: 'ar',
    items: [{ mediaId: m1.id, alt: { ar: 'نص بديل' } }],
    authorId: null,
    ...overrides,
  };
}

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000);

beforeEach(async () => {
  resetMemoryStore();
  const cmp = await upsertSiteComponentFromSeed(SEED);
  componentId = cmp.id;
  m1 = await makeMedia('m1');
  m2 = await makeMedia('m2');
  m3 = await makeMedia('m3');
});

describe('upsertDraftSet', () => {
  it('crée un brouillon v1 avec items en position 0..n et une entrée d’historique `create`', async () => {
    const set = await upsertDraftSet(
      draftInput({ slot: 'secondary', items: [{ mediaId: m1.id }, { mediaId: m2.id }] }),
    );
    expect(set.status).toBe('draft');
    expect(set.version).toBe(1);
    expect(set.items.map((i) => [i.position, i.mediaId])).toEqual([
      [0, m1.id],
      [1, m2.id],
    ]);
    const history = await listSetHistory(set);
    expect(history.map((h) => h.action)).toEqual(['create']);
    expect(history[0]?.items).toHaveLength(2);
  });

  it('un second upsert remplace le brouillon (même id, items en bloc) — un seul brouillon par tuple', async () => {
    const a = await upsertDraftSet(draftInput({ slot: 'secondary', items: [{ mediaId: m1.id }, { mediaId: m2.id }] }));
    const b = await upsertDraftSet(draftInput({ slot: 'secondary', items: [{ mediaId: m3.id }] }));
    expect(b.id).toBe(a.id);
    expect(b.items.map((i) => i.mediaId)).toEqual([m3.id]);
    const all = await listSetsByComponent(componentId);
    expect(all.filter((s) => s.status === 'draft')).toHaveLength(1);
    expect(Array.from(memoryStore().componentMediaSetItems.values())).toHaveLength(1);
  });

  it('conflit si expectedUpdatedAt ne correspond plus', async () => {
    const a = await upsertDraftSet(draftInput());
    await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await expect(
      upsertDraftSet(draftInput({ items: [{ mediaId: m3.id }], expectedUpdatedAt: a.updatedAt })),
    ).rejects.toBeInstanceOf(MediaSetConflictError);
  });

  it('conflit si expectedVersion ne correspond plus', async () => {
    await upsertDraftSet(draftInput());
    await expect(upsertDraftSet(draftInput({ expectedVersion: 7 }))).rejects.toBeInstanceOf(
      MediaSetConflictError,
    );
  });

  it('deux écritures dans la même milliseconde gardent des updatedAt distincts', async () => {
    const a = await upsertDraftSet(draftInput());
    const b = await upsertDraftSet(draftInput({ expectedUpdatedAt: a.updatedAt }));
    expect(b.updatedAt.getTime()).toBeGreaterThan(a.updatedAt.getTime());
  });

  it.each([
    ['slot inconnu', { slot: 'banner' }, 'slot.unknown'],
    ['single avec 2 items', { items: [{ mediaId: 'x' }, { mediaId: 'y' }] }, 'items.single'],
    ['liste vide', { items: [] }, 'items.empty'],
    ['dimension non déclarée', { variantDim: 'city' }, 'variant_dim.unknown'],
    ['clé d’angle inconnue', { variantKey: 'z' }, 'variant_key.invalid'],
    ['default avec une clé', { variantDim: 'default', variantKey: 'e' }, 'variant_key.invalid'],
    ['langue inconnue', { locale: 'de' }, 'locale.invalid'],
  ])('refuse : %s', async (_label, overrides, code) => {
    const err = await upsertDraftSet(draftInput(overrides)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MediaSetValidationError);
    expect((err as MediaSetValidationError).issues.map((i) => i.code)).toContain(code);
  });

  it('refuse plus de maxItems (6) sur la liste secondaire', async () => {
    const items = Array.from({ length: 7 }, () => ({ mediaId: m1.id }));
    const err = await upsertDraftSet(draftInput({ slot: 'secondary', items })).catch((e: unknown) => e);
    expect((err as MediaSetValidationError).issues.map((i) => i.code)).toContain('items.too_many');
  });

  it('refuse un média inexistant ou supprimé (soft delete)', async () => {
    await softDeleteMedia(m2.id);
    const err = await upsertDraftSet(
      draftInput({ slot: 'secondary', items: [{ mediaId: 'med_ghost' }, { mediaId: m2.id }] }),
    ).catch((e: unknown) => e);
    expect((err as MediaSetValidationError).issues.map((i) => i.code)).toEqual([
      'item.media_not_found',
      'item.media_deleted',
    ]);
    expect(memoryStore().componentMediaSets.size).toBe(0);
  });

  it('refuse un composant sans politique mediaVariants', async () => {
    const other = await upsertSiteComponentFromSeed({ ...SEED, key: 'kit-other', mediaVariants: undefined });
    const err = await upsertDraftSet(draftInput({ componentId: other.id })).catch((e: unknown) => e);
    expect((err as MediaSetValidationError).issues[0]?.code).toBe('policy.missing');
  });

  it('composant inconnu → NotFoundError', async () => {
    await expect(upsertDraftSet(draftInput({ componentId: 'cmp_ghost' }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('publishSet', () => {
  it('publie : statut, publishedAt, historique `publish`', async () => {
    const draft = await upsertDraftSet(draftInput());
    const pub = await publishSet({ setId: draft.id, actorId: null });
    expect(pub.status).toBe('published');
    expect(pub.version).toBe(1);
    expect(pub.publishedAt).toBeInstanceOf(Date);
    const history = await listSetHistory(pub);
    expect(history.map((h) => h.action)).toEqual(['publish', 'create']);
  });

  it('atomique : archive l’ancien publié du tuple, version+1, un seul publié', async () => {
    const d1 = await upsertDraftSet(draftInput());
    const p1 = await publishSet({ setId: d1.id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    expect(d2.id).not.toBe(p1.id);
    const p2 = await publishSet({ setId: d2.id, actorId: null });

    expect(p2.version).toBe(p1.version + 1);
    const all = await listSetsByComponent(componentId, { includeArchived: true });
    expect(all.filter((s) => s.status === 'published').map((s) => s.id)).toEqual([p2.id]);
    expect(all.find((s) => s.id === p1.id)?.status).toBe('archived');

    const actions = (await listSetHistory(p2, 50)).map((h) => `${h.setId === p1.id ? 'old' : 'new'}:${h.action}`);
    expect(actions).toContain('old:archive');
    expect(actions).toContain('new:publish');
  });

  it('les tuples différents (autre langue, autre angle) coexistent publiés', async () => {
    const a = await upsertDraftSet(draftInput({ locale: 'ar' }));
    const b = await upsertDraftSet(draftInput({ locale: 'fr' }));
    const c = await upsertDraftSet(draftInput({ variantKey: 'a' }));
    for (const s of [a, b, c]) await publishSet({ setId: s.id, actorId: null });
    const published = (await listSetsByComponent(componentId)).filter((s) => s.status === 'published');
    expect(published).toHaveLength(3);
  });

  it('un brouillon et un publié coexistent pour le même tuple', async () => {
    const d1 = await upsertDraftSet(draftInput());
    await publishSet({ setId: d1.id, actorId: null });
    await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    const statuses = (await listSetsByComponent(componentId)).map((s) => s.status).sort();
    expect(statuses).toEqual(['draft', 'published']);
  });

  it('rollback complet si une étape échoue (média supprimé entre-temps)', async () => {
    const d1 = await upsertDraftSet(draftInput());
    const p1 = await publishSet({ setId: d1.id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await softDeleteMedia(m2.id);
    const historyBefore = memoryStore().componentMediaSetHistory.size;

    await expect(publishSet({ setId: d2.id, actorId: null })).rejects.toBeInstanceOf(
      MediaSetValidationError,
    );
    const after = await listSetsByComponent(componentId, { includeArchived: true });
    expect(after.find((s) => s.id === p1.id)?.status).toBe('published');
    expect(after.find((s) => s.id === d2.id)?.status).toBe('draft');
    expect(memoryStore().componentMediaSetHistory.size).toBe(historyBefore);
  });

  it('rollback mémoire APRÈS l’archivage : une panne sur l’historique `publish` annule tout', async () => {
    const d1 = await upsertDraftSet(draftInput());
    const p1 = await publishSet({ setId: d1.id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    const history = memoryStore().componentMediaSetHistory;
    const sizeBefore = history.size;
    const originalSet = history.set.bind(history);
    const spy = vi.spyOn(history, 'set').mockImplementation((key, entry) => {
      if (entry.action === 'publish') throw new Error('boom');
      return originalSet(key, entry);
    });
    try {
      await expect(publishSet({ setId: d2.id, actorId: null })).rejects.toThrow('boom');
    } finally {
      spy.mockRestore();
    }
    const after = await listSetsByComponent(componentId, { includeArchived: true });
    expect(after.find((s) => s.id === p1.id)?.status).toBe('published');
    expect(after.find((s) => s.id === d2.id)?.status).toBe('draft');
    expect(memoryStore().componentMediaSetHistory.size).toBe(sizeBefore);
  });

  it('conflit If-Match sur publish', async () => {
    const d = await upsertDraftSet(draftInput());
    await expect(
      publishSet({ setId: d.id, actorId: null, expectedUpdatedAt: new Date(0) }),
    ).rejects.toBeInstanceOf(MediaSetConflictError);
  });

  it('refuse de publier un ensemble archivé ; NotFound pour un id inconnu', async () => {
    const d = await upsertDraftSet(draftInput());
    const p = await publishSet({ setId: d.id, actorId: null });
    await unpublishSet({ setId: p.id, actorId: null });
    await expect(publishSet({ setId: p.id, actorId: null })).rejects.toBeInstanceOf(MediaSetStateError);
    await expect(publishSet({ setId: 'cms_ghost', actorId: null })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('programmation', () => {
  it('schedule → listScheduledDueSets → promoteDueMediaSets publie à échéance', async () => {
    const d = await upsertDraftSet(draftInput());
    const at = FUTURE();
    const scheduled = await scheduleSet({ setId: d.id, actorId: null, scheduledAt: at });
    expect(scheduled.status).toBe('scheduled');

    expect(await listScheduledDueSets(new Date())).toHaveLength(0);
    const later = new Date(at.getTime() + 1000);
    expect((await listScheduledDueSets(later)).map((s) => s.id)).toEqual([d.id]);

    const res = await promoteDueMediaSets(later);
    expect(res.failed).toEqual([]);
    expect(res.promoted.map((s) => [s.id, s.status])).toEqual([[d.id, 'published']]);
    expect('items' in (res.promoted[0] as object)).toBe(false);
    expect((await getSetWithItems(d.id))?.publishedAt?.getTime()).toBe(later.getTime());
  });

  it('un brouillon programmé libère la place du brouillon (I1)', async () => {
    const d = await upsertDraftSet(draftInput());
    await scheduleSet({ setId: d.id, actorId: null, scheduledAt: FUTURE() });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    expect(d2.id).not.toBe(d.id);
  });

  it('refuse une date passée ou trop proche', async () => {
    const d = await upsertDraftSet(draftInput());
    await expect(
      scheduleSet({ setId: d.id, actorId: null, scheduledAt: new Date(Date.now() + 10_000) }),
    ).rejects.toThrow('schedule.in_past');
  });

  it('cancelSetSchedule : redevient brouillon ; refusé si un brouillon existe déjà', async () => {
    const d = await upsertDraftSet(draftInput());
    await scheduleSet({ setId: d.id, actorId: null, scheduledAt: FUTURE() });
    const back = await cancelSetSchedule({ setId: d.id, actorId: null });
    expect(back.status).toBe('draft');
    expect(back.scheduledAt).toBeNull();

    await scheduleSet({ setId: d.id, actorId: null, scheduledAt: FUTURE() });
    await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await expect(cancelSetSchedule({ setId: d.id, actorId: null })).rejects.toThrow(
      'cancel_schedule.draft_exists',
    );
  });

  it('promoteDueMediaSets : un échec n’empêche pas les suivants', async () => {
    const ok = await upsertDraftSet(draftInput({ locale: 'fr' }));
    const ko = await upsertDraftSet(draftInput({ locale: 'en', items: [{ mediaId: m3.id }] }));
    const at = FUTURE();
    await scheduleSet({ setId: ok.id, actorId: null, scheduledAt: at });
    await scheduleSet({ setId: ko.id, actorId: null, scheduledAt: at });
    await softDeleteMedia(m3.id);
    const res = await promoteDueMediaSets(new Date(at.getTime() + 1));
    expect(res.promoted.map((s) => s.id)).toEqual([ok.id]);
    // Média supprimé : programmation « bloquée », pas une erreur.
    expect(res.stuck).toEqual([{ setId: ko.id, issues: ['item.media_deleted'] }]);
    expect(res.failed).toEqual([]);
  });

  it('promoteDueMediaSets : course avec un autre tick → `skipped`, pas `failed`', async () => {
    const a = await upsertDraftSet(draftInput({ locale: 'fr' }));
    const b = await upsertDraftSet(draftInput({ locale: 'en' }));
    const at = FUTURE();
    await scheduleSet({ setId: a.id, actorId: null, scheduledAt: at });
    await scheduleSet({ setId: b.id, actorId: null, scheduledAt: at });
    const now = new Date(at.getTime() + 1);
    // Lecture « due » obtenue AVANT qu'un autre tick ne publie a, et qu'une
    // écriture concurrente ne touche b (updatedAt changé).
    const due = await listScheduledDueSets(now);
    await publishSet({ setId: a.id, actorId: null });
    const store = memoryStore();
    store.componentMediaSets.set(b.id, {
      ...store.componentMediaSets.get(b.id)!,
      updatedAt: new Date(Date.now() + 5),
    });
    const res = await promoteScheduledSets(due, now);
    expect(res.skipped).toEqual(
      expect.arrayContaining([
        { setId: a.id, reason: 'already_published' },
        { setId: b.id, reason: 'version_conflict' },
      ]),
    );
    expect(res.failed).toEqual([]);
    expect(res.promoted).toEqual([]);
  });

  it('promoteDueMediaSets : programmation annulée par une publication manuelle → `skipped` (superseded)', async () => {
    const s1 = await upsertDraftSet(draftInput());
    const at = FUTURE();
    await scheduleSet({ setId: s1.id, actorId: null, scheduledAt: at });
    const now = new Date(at.getTime() + 1);
    const due = await listScheduledDueSets(now);
    const manual = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await publishSet({ setId: manual.id, actorId: null }); // archive la programmation
    const res = await promoteScheduledSets(due, now);
    expect(res.skipped).toEqual([{ setId: s1.id, reason: 'superseded' }]);
    expect(res.failed).toEqual([]);
  });

  it('promoteDueMediaSets : échec de lecture du composant → publié quand même, clé null', async () => {
    const d = await upsertDraftSet(draftInput());
    const at = FUTURE();
    await scheduleSet({ setId: d.id, actorId: null, scheduledAt: at });
    const sc = await import('@/lib/db/queries/site-components');
    const spy = vi.spyOn(sc, 'getSiteComponentById');
    // La publication ne relit pas le composant : seul le lookup de la clé échoue.
    spy.mockRejectedValue(new Error('db down'));
    try {
      const res = await promoteDueMediaSets(new Date(at.getTime() + 1));
      expect(res.failed).toEqual([]);
      expect(res.promoted.map((p) => [p.id, p.componentKey])).toEqual([[d.id, null]]);
    } finally {
      spy.mockRestore();
    }
    expect((await getSetById(d.id))?.status).toBe('published');
  });
});

describe('unpublishSet / restoreSetFromHistory', () => {
  it('dépublie : archivé, plus rien de publié pour le tuple (repli)', async () => {
    const d = await upsertDraftSet(draftInput());
    const p = await publishSet({ setId: d.id, actorId: null });
    const u = await unpublishSet({ setId: p.id, actorId: null });
    expect(u.status).toBe('archived');
    expect(await listPublishedSetsWithMedia(componentId)).toEqual([]);
    expect((await listSetHistory(p))[0]?.action).toBe('unpublish');
  });

  it('refuse de dépublier un brouillon', async () => {
    const d = await upsertDraftSet(draftInput());
    await expect(unpublishSet({ setId: d.id, actorId: null })).rejects.toBeInstanceOf(MediaSetStateError);
  });

  it('restaure une version en BROUILLON (jamais publiée directement)', async () => {
    const d1 = await upsertDraftSet(draftInput({ slot: 'secondary', items: [{ mediaId: m1.id }, { mediaId: m2.id }], crossLocale: true }));
    const p1 = await publishSet({ setId: d1.id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ slot: 'secondary', items: [{ mediaId: m3.id }] }));
    await publishSet({ setId: d2.id, actorId: null });

    const v1Publish = (await listSetHistory(p1, 50)).find(
      (h) => h.setId === p1.id && h.action === 'publish',
    )!;
    const restored = await restoreSetFromHistory({ historyId: v1Publish.id, actorId: null });
    expect(restored.status).toBe('draft');
    expect(restored.crossLocale).toBe(true);
    expect(restored.items.map((i) => i.mediaId)).toEqual([m1.id, m2.id]);
    expect(restored.notes).toBe(`restore from version ${p1.version}`);
    const restoredHistory = (await listSetHistory(restored, 50)).filter((h) => h.setId === restored.id);
    expect(restoredHistory.map((h) => h.action)).toEqual(['restore']);
    // Le publié courant n'a pas bougé.
    expect((await listPublishedSetsWithMedia(componentId))[0]?.items.map((i) => i.mediaId)).toEqual([m3.id]);
  });

  it('restore : NotFound sur un historique inconnu', async () => {
    await expect(restoreSetFromHistory({ historyId: 'cmsh_ghost', actorId: null })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('suppression d’un média référencé (RESTRICT)', () => {
  it('hardDeleteMedia refuse un média référencé (desktop ou mobile)', async () => {
    await upsertDraftSet(draftInput({ items: [{ mediaId: m1.id, mobileMediaId: m2.id }] }));
    await expect(hardDeleteMedia(m1.id)).rejects.toBeInstanceOf(MediaInUseError);
    await expect(hardDeleteMedia(m2.id)).rejects.toBeInstanceOf(MediaInUseError);
    expect(memoryStore().media.has(m1.id)).toBe(true);
    await expect(hardDeleteMedia(m3.id)).resolves.toBeUndefined();
  });
});

describe('lecture avec médias', () => {
  it('listPublishedSetsWithMedia : items triés par position, variants joints, média supprimé → null', async () => {
    const d = await upsertDraftSet(
      draftInput({
        slot: 'secondary',
        items: [{ mediaId: m3.id }, { mediaId: m1.id, mobileMediaId: m2.id }, { mediaId: m2.id }],
      }),
    );
    await publishSet({ setId: d.id, actorId: null });
    await softDeleteMedia(m2.id);

    const [set] = await listPublishedSetsWithMedia(componentId);
    expect(set?.items.map((i) => i.position)).toEqual([0, 1, 2]);
    expect(set?.items.map((i) => i.mediaId)).toEqual([m3.id, m1.id, m2.id]);
    expect(set?.items[0]?.media?.variants[0]?.url).toBe('/_media/m3/lg.webp');
    expect(set?.items[1]?.mobileMedia).toBeNull(); // mobile supprimé
    expect(set?.items[2]?.media).toBeNull();
  });

  it('média pas prêt (status pending) → null', async () => {
    const d = await upsertDraftSet(draftInput());
    await publishSet({ setId: d.id, actorId: null });
    memoryStore().media.set(m1.id, { ...m1, status: 'pending' });
    const [set] = await listPublishedSetsWithMedia(componentId);
    expect(set?.items[0]?.media).toBeNull();
  });

  it('listPreviewSetsWithMedia : brouillon prioritaire sur publié, par tuple', async () => {
    const d1 = await upsertDraftSet(draftInput());
    await publishSet({ setId: d1.id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    const other = await upsertDraftSet(draftInput({ locale: 'fr' }));
    await publishSet({ setId: other.id, actorId: null });

    const preview = await listPreviewSetsWithMedia(componentId);
    const byLocale = Object.fromEntries(preview.map((s) => [s.locale, s] as const));
    expect(byLocale.ar?.id).toBe(d2.id);
    expect(byLocale.fr?.status).toBe('published');
    expect(preview).toHaveLength(2);
  });

  it('listSetsByComponent exclut les archivés par défaut et trie de façon stable', async () => {
    const a = await upsertDraftSet(draftInput({ slot: 'secondary' }));
    const b = await upsertDraftSet(draftInput({ slot: 'primary', variantDim: 'default', variantKey: '*', locale: '*' }));
    const p = await publishSet({ setId: b.id, actorId: null });
    await unpublishSet({ setId: p.id, actorId: null });
    const list = await listSetsByComponent(componentId);
    expect(list.map((s: ComponentMediaSet) => s.id)).toEqual([a.id]);
    expect(await listSetsByComponent(componentId, { includeArchived: true })).toHaveLength(2);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Corrections de revue (PR 1/2)
 * ────────────────────────────────────────────────────────────────── */

describe('driver sans transaction (neon-http) : échec fermé', () => {
  afterEach(() => __resetTestDb());

  it('une mutation lève MediaSetTransactionUnavailableError sans aucune écriture séquentielle', async () => {
    const d = await upsertDraftSet(draftInput());
    const writes: string[] = [];
    const neonLike = {
      transaction: async () => {
        throw new Error('No transactions support in neon-http driver');
      },
      // Toute écriture hors transaction serait tracée ici (ancien repli séquentiel).
      insert: () => writes.push('insert'),
      update: () => writes.push('update'),
      delete: () => writes.push('delete'),
      select: () => writes.push('select'),
    };
    __setTestDb(neonLike as unknown as Parameters<typeof __setTestDb>[0]);
    for (const run of [
      () => publishSet({ setId: d.id, actorId: null }),
      () => discardDraft({ setId: d.id, actorId: null }),
      () => scheduleSet({ setId: d.id, actorId: null, scheduledAt: FUTURE() }),
    ]) {
      const err = await run().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MediaSetTransactionUnavailableError);
      expect((err as Error).message).toMatch(/interactive transactions/);
    }
    expect(writes).toEqual([]);
  });
});

describe('MediaSetConflictError (23505) porte l’état courant', () => {
  afterEach(() => __resetTestDb());

  it('relit le tuple hors transaction après la violation d’index unique', async () => {
    const d = await upsertDraftSet(draftInput());
    const current = (await getSetById(d.id))!;
    const tuple = { componentId, slot: 'primary', variantDim: 'angle', variantKey: 'e', locale: 'ar' };
    // Chaîne `select().from().where()` minimale renvoyant l'ensemble concurrent.
    const chain = { from: () => chain, where: () => Promise.resolve([current]) };
    const pgLike = {
      transaction: async () => {
        throw new MediaSetConflictError(null, { tuple, status: 'draft' });
      },
      select: () => chain,
    };
    __setTestDb(pgLike as unknown as Parameters<typeof __setTestDb>[0]);
    const err = await publishSet({ setId: d.id, actorId: null }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MediaSetConflictError);
    expect((err as MediaSetConflictError).set?.id).toBe(d.id);
  });
});

describe('une seule programmation par tuple', () => {
  it('refuse de programmer un second brouillon quand une programmation est en attente', async () => {
    const d1 = await upsertDraftSet(draftInput());
    await scheduleSet({ setId: d1.id, actorId: null, scheduledAt: FUTURE() });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await expect(scheduleSet({ setId: d2.id, actorId: null, scheduledAt: FUTURE() })).rejects.toThrow(
      'schedule.scheduled_exists',
    );
    // Reprogrammer la MÊME programmation reste possible.
    const again = await scheduleSet({ setId: d1.id, actorId: null, scheduledAt: FUTURE() });
    expect(again.status).toBe('scheduled');
  });

  it('publication manuelle : la programmation en attente est archivée avec historique', async () => {
    const d1 = await upsertDraftSet(draftInput());
    await scheduleSet({ setId: d1.id, actorId: null, scheduledAt: FUTURE() });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    const p2 = await publishSet({ setId: d2.id, actorId: null });

    expect((await getSetById(d1.id))?.status).toBe('archived');
    expect(await listScheduledDueSets(new Date(Date.now() + 10 * 3_600_000))).toEqual([]);
    const history = await listSetHistory(p2, 50);
    const superseded = history.find((h) => h.setId === d1.id && h.action === 'archive');
    expect(superseded?.notes).toBe(`${MEDIA_SET_SUPERSEDED_NOTE}:${d2.id}`);
    expect(superseded?.status).toBe('archived');
    // Ordre : publish (dernier) puis l'archivage de la programmation.
    expect(history.slice(0, 2).map((h) => `${h.setId === d2.id ? 'new' : 'old'}:${h.action}`)).toEqual([
      'new:publish',
      'old:archive',
    ]);
  });
});

describe('discardDraft', () => {
  it('supprime le brouillon et ses items, garde l’historique (archive + note), libère les médias', async () => {
    const d = await upsertDraftSet(draftInput({ items: [{ mediaId: m1.id, mobileMediaId: m2.id }] }));
    const discarded = await discardDraft({ setId: d.id, actorId: null, expectedUpdatedAt: d.updatedAt });
    expect(discarded.id).toBe(d.id);
    expect(discarded.items.map((i) => i.mediaId)).toEqual([m1.id]);

    expect(await getSetById(d.id)).toBeNull();
    expect(Array.from(memoryStore().componentMediaSetItems.values())).toEqual([]);
    const history = await listSetHistory(d);
    expect(history.map((h) => [h.action, h.status, h.notes])).toEqual([
      ['archive', 'draft', MEDIA_SET_DISCARD_NOTE],
      ['create', 'draft', null],
    ]);
    expect(history[0]?.items.map((i) => i.mediaId)).toEqual([m1.id]);
    // Plus aucune référence : la suppression définitive passe.
    await expect(hardDeleteMedia(m2.id)).resolves.toBeUndefined();
  });

  it('restaurable depuis l’historique après abandon', async () => {
    const d = await upsertDraftSet(draftInput());
    await discardDraft({ setId: d.id, actorId: null });
    const entry = (await listSetHistory(d)).find((h) => h.notes === MEDIA_SET_DISCARD_NOTE)!;
    const restored = await restoreSetFromHistory({ historyId: entry.id, actorId: null });
    expect(restored.status).toBe('draft');
    expect(restored.items.map((i) => i.mediaId)).toEqual([m1.id]);
  });

  it('permet d’annuler une programmation une fois le brouillon concurrent abandonné', async () => {
    const d1 = await upsertDraftSet(draftInput());
    await scheduleSet({ setId: d1.id, actorId: null, scheduledAt: FUTURE() });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    await expect(cancelSetSchedule({ setId: d1.id, actorId: null })).rejects.toThrow(
      'cancel_schedule.draft_exists',
    );
    await discardDraft({ setId: d2.id, actorId: null });
    const back = await cancelSetSchedule({ setId: d1.id, actorId: null });
    expect(back.status).toBe('draft');
    expect(back.items.map((i) => i.mediaId)).toEqual([m1.id]);
  });

  it('refuse un non-brouillon, un If-Match périmé ; NotFound sur id inconnu', async () => {
    const d = await upsertDraftSet(draftInput());
    await expect(
      discardDraft({ setId: d.id, actorId: null, expectedUpdatedAt: new Date(0) }),
    ).rejects.toBeInstanceOf(MediaSetConflictError);
    const p = await publishSet({ setId: d.id, actorId: null });
    await expect(discardDraft({ setId: p.id, actorId: null })).rejects.toThrow('discard.invalid_status:published');
    await expect(discardDraft({ setId: 'cms_ghost', actorId: null })).rejects.toBeInstanceOf(NotFoundError);
    expect((await getSetById(p.id))?.status).toBe('published');
  });
});

describe('hardDeleteMedia — Postgres : 23503 → MediaInUseError', () => {
  afterEach(() => __resetTestDb());

  function pgDeleting(err: unknown) {
    return {
      delete: () => ({ where: () => Promise.reject(err) }),
    } as unknown as Parameters<typeof __setTestDb>[0];
  }

  it.each([
    ['postgres-js', { code: '23503', constraint_name: 'component_media_set_items_media_id_media_id_fk' }],
    ['PGlite', { code: '23503', constraint: 'component_media_set_items_mobile_media_id_media_id_fk' }],
    ['enveloppe Drizzle', { message: 'Failed query', cause: { code: '23503', table_name: 'component_media_set_items' } }],
  ])('%s', async (_label, raw) => {
    __setTestDb(pgDeleting(Object.assign(new Error('fk'), raw)));
    const err = await hardDeleteMedia('med_x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MediaInUseError);
    expect((err as MediaInUseError).mediaId).toBe('med_x');
  });

  it('une autre FK ou une autre erreur est relancée telle quelle', async () => {
    const other = Object.assign(new Error('other fk'), { code: '23503', constraint_name: 'orders_media_fk' });
    __setTestDb(pgDeleting(other));
    await expect(hardDeleteMedia('med_x')).rejects.toBe(other);
    const boom = new Error('boom');
    __setTestDb(pgDeleting(boom));
    await expect(hardDeleteMedia('med_x')).rejects.toBe(boom);
  });
});

describe('promoteDueMediaSets — componentKey', () => {
  it('chaque ensemble promu porte la clé de son composant (revalidateTag)', async () => {
    const d = await upsertDraftSet(draftInput());
    const at = FUTURE();
    await scheduleSet({ setId: d.id, actorId: null, scheduledAt: at });
    const res = await promoteDueMediaSets(new Date(at.getTime() + 1));
    expect(res.promoted.map((s) => [s.id, s.componentKey])).toEqual([[d.id, 'kit-hero-produit']]);
  });
});

describe('listSetHistory — ordre déterministe', () => {
  it('archive et publish d’une même publication ont des createdAt distincts', async () => {
    const p1 = await publishSet({ setId: (await upsertDraftSet(draftInput())).id, actorId: null });
    const d2 = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    const now = new Date('2026-11-01T10:00:00.000Z');
    await publishSet({ setId: d2.id, actorId: null, now });
    const [first, second] = await listSetHistory(p1, 50);
    expect([first?.setId, first?.action]).toEqual([d2.id, 'publish']);
    expect([second?.setId, second?.action]).toEqual([p1.id, 'archive']);
    expect(first!.createdAt.getTime()).toBeGreaterThan(second!.createdAt.getTime());
  });

  it('à createdAt égal, départage par id décroissant (stable d’un appel à l’autre)', async () => {
    const d = await upsertDraftSet(draftInput());
    const base = (await listSetHistory(d))[0]!;
    const history = memoryStore().componentMediaSetHistory;
    const t = new Date('2030-01-01T00:00:00Z');
    for (const id of ['cmsh_b', 'cmsh_c', 'cmsh_a']) history.set(id, { ...base, id, createdAt: t });
    const ids = (await listSetHistory(d)).slice(0, 3).map((h) => h.id);
    expect(ids).toEqual(['cmsh_c', 'cmsh_b', 'cmsh_a']);
    expect((await listSetHistory(d)).map((h) => h.id)).toEqual((await listSetHistory(d)).map((h) => h.id));
  });
});

describe('upsertDraftSet — If-Match sur un brouillon disparu', () => {
  it('brouillon publié entre-temps → conflit avec l’état courant (pas de recréation silencieuse)', async () => {
    const d = await upsertDraftSet(draftInput());
    const p = await publishSet({ setId: d.id, actorId: null });
    const err = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }], expectedUpdatedAt: d.updatedAt })).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(MediaSetConflictError);
    expect((err as MediaSetConflictError).set).toMatchObject({ id: p.id, status: 'published' });
    expect((await listSetsByComponent(componentId)).filter((s) => s.status === 'draft')).toEqual([]);

    await expect(upsertDraftSet(draftInput({ expectedVersion: 1 }))).rejects.toBeInstanceOf(MediaSetConflictError);
    // Sans If-Match : création normale.
    await expect(upsertDraftSet(draftInput())).resolves.toMatchObject({ status: 'draft' });
  });

  it('If-Match sur un tuple vierge → conflit avec set=null', async () => {
    const err = await upsertDraftSet(draftInput({ expectedUpdatedAt: new Date() })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MediaSetConflictError);
    expect((err as MediaSetConflictError).set).toBeNull();
  });
});

describe('listPreviewSetsWithMedia — brouillon sans image affichable', () => {
  it('retombe sur le publié du tuple au lieu de masquer la cellule', async () => {
    const p = await publishSet({ setId: (await upsertDraftSet(draftInput())).id, actorId: null });
    const d = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    expect((await listPreviewSetsWithMedia(componentId)).map((s) => s.id)).toEqual([d.id]);
    await softDeleteMedia(m2.id);
    expect((await listPreviewSetsWithMedia(componentId)).map((s) => s.id)).toEqual([p.id]);
  });

  it('sans publié : le brouillon reste renvoyé (le sélecteur passera au repli)', async () => {
    const d = await upsertDraftSet(draftInput({ items: [{ mediaId: m2.id }] }));
    memoryStore().media.set(m2.id, { ...m2, status: 'pending' });
    expect((await listPreviewSetsWithMedia(componentId)).map((s) => s.id)).toEqual([d.id]);
  });
});

describe('API : les mutations renvoient l’ensemble avec ses items', () => {
  it('scheduleSet / cancelSetSchedule / unpublishSet', async () => {
    const d = await upsertDraftSet(draftInput({ slot: 'secondary', items: [{ mediaId: m1.id }, { mediaId: m2.id }] }));
    const expected = [m1.id, m2.id];
    const s = await scheduleSet({ setId: d.id, actorId: null, scheduledAt: FUTURE() });
    expect(s.items.map((i) => i.mediaId)).toEqual(expected);
    const c = await cancelSetSchedule({ setId: d.id, actorId: null });
    expect(c.items.map((i) => i.mediaId)).toEqual(expected);
    await publishSet({ setId: d.id, actorId: null });
    const u = await unpublishSet({ setId: d.id, actorId: null });
    expect(u.items.map((i) => i.mediaId)).toEqual(expected);
  });
});
