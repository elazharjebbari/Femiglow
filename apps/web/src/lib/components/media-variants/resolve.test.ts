/**
 * Tests — résolution des slots (pur + bout en bout memoryStore),
 * `toResolvedImages` (alt par langue, art direction, flou) et
 * `mediaVariantTrackingValue`.
 *
 * `unstable_cache` est mocké avec un aller-retour JSON (sérialisation réelle
 * du cache de données Next) : le résultat publié doit y survivre à l'identique.
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.4 et §5
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `unstable_cache` émulé FIDÈLEMENT : la valeur passe par JSON (comme le
// cache de données de Next), et on compte les entrées sérialisées.
const cacheWrites: string[] = [];
vi.mock('next/cache', () => ({
  unstable_cache:
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const json = JSON.stringify(await fn(...args));
      cacheWrites.push(json);
      return json === undefined ? (undefined as R) : (JSON.parse(json) as R);
    },
  revalidateTag: vi.fn(),
}));

import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { createMedia } from '@/lib/db/queries/media';
import { createVariant } from '@/lib/db/queries/media-variants';
import { publishSet, upsertDraftSet } from '@/lib/db/queries/component-media-sets';
import { findComponentSeed } from '@/lib/components/registry';
import {
  delegatedTrace,
  mediaVariantTrackingValue,
  resolveComponentMediaSlots,
  resolveMediaSlotsFromSets,
  toResolvedImages,
} from './resolve.server';
import { mediaSetsCacheTag } from './sets.server';
import { KIT_POLICY, makeMedia, makeSet } from './__fixtures__/sets';
import type { MediaSlotTrace } from './types';

describe('toResolvedImages — alt par langue', () => {
  const media = makeMedia('m_alt', { alt: 'Kit FemiGlow posé sur une table' });

  it('alt[locale] en priorité', () => {
    const set = makeSet({ items: [{ media, alt: { fr: 'Alt FR', ar: 'نص عربي' } }] });
    expect(toResolvedImages(set.items, { locale: 'ar', fallbackAlt: 'X' })[0]?.alt).toBe('نص عربي');
    expect(toResolvedImages(set.items, { locale: 'fr' })[0]?.alt).toBe('Alt FR');
  });

  it('en fr : retombe sur media.alt (médiathèque rédigée en français)', () => {
    const set = makeSet({ items: [{ media, alt: {} }] });
    expect(toResolvedImages(set.items, { locale: 'fr', fallbackAlt: 'Kit' })[0]?.alt).toBe(
      'Kit FemiGlow posé sur une table',
    );
  });

  it('en ar/en : media.alt ne fuit pas, alt[fr] non plus → fallbackAlt', () => {
    const set = makeSet({ items: [{ media, alt: { fr: 'Alt FR' } }] });
    expect(toResolvedImages(set.items, { locale: 'ar', fallbackAlt: 'طقم فيميغلو' })[0]?.alt).toBe(
      'طقم فيميغلو',
    );
    expect(toResolvedImages(set.items, { locale: 'en', fallbackAlt: 'FemiGlow kit' })[0]?.alt).toBe(
      'FemiGlow kit',
    );
  });

  it('alt vide ou blanc ignoré ; sans rien → chaîne vide', () => {
    const set = makeSet({ items: [{ media, alt: { en: '   ' } }] });
    expect(toResolvedImages(set.items, { locale: 'en' })[0]?.alt).toBe('');
  });
});

describe('toResolvedImages — art direction, flou, focal', () => {
  it('expose mobile (3:4) quand le média mobile est affichable', () => {
    const desktop = makeMedia('d', { blurDataUrl: 'data:image/webp;base64,DDD' });
    const mobile = makeMedia('mob', {
      originalWidth: 900,
      originalHeight: 1200,
      blurDataUrl: 'data:image/webp;base64,MMM',
    });
    const set = makeSet({ id: 's1', items: [{ media: desktop, mobileMedia: mobile }] });
    set.items[0]!.focalX = 40;
    set.items[0]!.focalY = 30;
    set.items[0]!.objectPosition = 'top';
    const [img] = toResolvedImages(set.items, { locale: 'fr' });
    expect(img).toEqual({
      id: 'mset-s1-0',
      src: '/_media/d/lg.webp',
      width: 1200,
      height: 1500,
      alt: desktop.alt,
      blurDataURL: 'data:image/webp;base64,DDD',
      objectPosition: 'top',
      focalX: 40,
      focalY: 30,
      mobile: {
        src: '/_media/mob/lg.webp',
        width: 900,
        height: 1200,
        blurDataURL: 'data:image/webp;base64,MMM',
      },
    });
  });

  it('pas de mobile si le média mobile est absent / supprimé (null)', () => {
    const set = makeSet({ items: [{ mobileMedia: null }] });
    const [img] = toResolvedImages(set.items, { locale: 'fr' });
    expect(img?.mobile).toBeUndefined();
    expect(img?.blurDataURL).toBeUndefined();
  });

  it('retombe sur originalUrl sans variant', () => {
    const media = makeMedia('orig', { variants: [], originalUrl: '/uploads/orig.png' });
    const set = makeSet({ items: [{ media }] });
    expect(toResolvedImages(set.items, { locale: 'fr' })[0]?.src).toBe('/uploads/orig.png');
  });
});

describe('mediaVariantTrackingValue', () => {
  const trace = (t: Partial<MediaSlotTrace>): Record<string, MediaSlotTrace> => ({
    primary: {
      slot: 'primary',
      level: 1,
      setId: 's',
      variantDim: 'angle',
      variantKey: 'e',
      locale: 'ar',
      version: 3,
      ...t,
    },
  });

  it.each([
    [trace({}), 'angle-e.ar.v3'],
    [trace({ level: 2, locale: '*', version: 2 }), 'angle-e.any.v2'],
    [trace({ level: 4, variantDim: 'default', variantKey: '*', locale: 'fr', version: 1 }), 'default.fr.v1'],
    [trace({ level: 5, variantDim: 'default', variantKey: '*', locale: '*' }), 'default.any.v3'],
    [trace({ variantDim: 'ab:hero-media-2026-11', variantKey: 'b', locale: 'fr', version: 1 }), 'ab-hero-media-2026-11-b.fr.v1'],
    [{ primary: delegatedTrace('primary', 7) }, 'legacy'],
    [{ primary: delegatedTrace('primary', 8) }, 'product'],
    [{}, 'legacy'],
  ])('%j → %s', (traces, expected) => {
    expect(mediaVariantTrackingValue(traces)).toBe(expected);
  });

  it('lit le slot demandé', () => {
    const traces = {
      ...trace({}),
      secondary: { ...trace({ version: 9 }).primary!, slot: 'secondary' },
    };
    expect(mediaVariantTrackingValue(traces, 'secondary')).toBe('angle-e.ar.v9');
  });
});

describe('resolveMediaSlotsFromSets (pur)', () => {
  it('un slot résolu par ensemble, l’autre délégué (niveau 7, null)', () => {
    const sets = [makeSet({ id: 'p', slot: 'primary', dim: 'angle', key: 'e', locale: 'ar', version: 4 })];
    const r = resolveMediaSlotsFromSets(sets, KIT_POLICY, { locale: 'ar', variants: { angle: 'e' } }, 'Kit');
    expect(r.slots.primary).toHaveLength(1);
    expect(r.traces.primary).toMatchObject({ level: 1, setId: 'p', version: 4 });
    expect(r.slots.secondary).toBeNull();
    expect(r.traces.secondary).toEqual(delegatedTrace('secondary', 7));
    expect(mediaVariantTrackingValue(r.traces)).toBe('angle-e.ar.v4');
  });
});

describe('resolveComponentMediaSlots (bout en bout, memoryStore)', () => {
  let componentId: string;
  let mediaId: string;

  beforeEach(async () => {
    resetMemoryStore();
    const seed = findComponentSeed('kit-hero-produit');
    if (!seed) throw new Error('kit-hero-produit absent du registre');
    componentId = (await upsertSiteComponentFromSeed(seed)).id;
    const m = await createMedia({ kind: 'image', source: 'upload', slug: 'hero-e', alt: 'Alt FR', status: 'ready' });
    await createVariant({ mediaId: m.id, format: 'webp', breakpoint: 'xl', sizeBytes: 1, url: '/_media/hero-e/xl.webp', checksum: 'c' });
    mediaId = m.id;
  });

  it('composant inconnu → aucun slot, aucune trace (comportement historique conservé)', async () => {
    expect(await resolveComponentMediaSlots('inconnu', { locale: 'fr', variants: {} })).toEqual({
      slots: {},
      traces: {},
    });
  });

  it('sans ensemble publié → slots null (repli legacy délégué)', async () => {
    const r = await resolveComponentMediaSlots('kit-hero-produit', { locale: 'fr', variants: { angle: 'e' } });
    expect(r.slots).toEqual({ primary: null, secondary: null });
    expect(mediaVariantTrackingValue(r.traces)).toBe('legacy');
  });

  it('publié → résolu ; brouillon visible seulement en aperçu (draft)', async () => {
    const d = await upsertDraftSet({
      componentId,
      slot: 'primary',
      variantDim: 'angle',
      variantKey: 'e',
      locale: '*',
      items: [{ mediaId, alt: { ar: 'بديل' } }],
      authorId: null,
    });
    const ctx = { locale: 'ar' as const, variants: { angle: 'e' } };
    expect((await resolveComponentMediaSlots('kit-hero-produit', ctx)).slots.primary).toBeNull();

    const preview = await resolveComponentMediaSlots('kit-hero-produit', ctx, { draft: true });
    expect(preview.slots.primary?.[0]).toMatchObject({ src: '/_media/hero-e/xl.webp', alt: 'بديل' });

    await publishSet({ setId: d.id, actorId: null });
    cacheWrites.length = 0;
    const live = await resolveComponentMediaSlots('kit-hero-produit', ctx, { fallbackAlt: 'Kit' });
    expect(live.slots.primary?.[0]?.src).toBe('/_media/hero-e/xl.webp');
    expect(mediaVariantTrackingValue(live.traces)).toBe('angle-e.any.v1');
    // Après publication, l'aperçu (non caché) et le publié (via JSON) concordent.
    const previewAfter = await resolveComponentMediaSlots('kit-hero-produit', ctx, { draft: true, fallbackAlt: 'Kit' });
    expect(live).toEqual(previewAfter);
    // L'entrée de cache ne contient ni lignes `media` ni liste de variants.
    expect(cacheWrites).toHaveLength(1);
    const cached = JSON.parse(cacheWrites[0]!) as { sets: Array<{ items: object[] }> };
    expect(Object.keys(cached.sets[0]!.items[0]!).sort()).toEqual(
      ['alt', 'desktop', 'focalX', 'focalY', 'mediaAlt', 'mobile', 'objectPosition', 'position', 'setId'],
    );
    expect(cacheWrites[0]).not.toContain('"variants"');
  });

  it('tag de cache propre au composant', () => {
    expect(mediaSetsCacheTag('kit-hero-produit')).toBe('components:media-sets:kit-hero-produit');
  });
});
