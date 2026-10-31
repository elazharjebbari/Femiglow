import { describe, expect, it } from 'vitest';
import { KIT_HERO_MEDIA_VARIANTS } from '@/lib/components/registry';
import { computeMediaSetCoverage } from '@/lib/components/media-variants/coverage';
import {
  coverageCellFor,
  indexSets,
  inheritanceFor,
  matrixRows,
  previewUrl,
  resolveVariants,
  rowLabel,
  statusPills,
} from './model';
import {
  formFingerprint,
  formFromSet,
  missingAltLocales,
  moveItem,
  parseFocal,
  toDraftPayload,
} from './editor-model';
import type { AdminMediaSetJson } from './types';
import type { MediaSetDTO } from '@/lib/components/media-variants/types';

const DIMS = [{ id: 'angle', label: 'Angle publicitaire', values: ['a', 'b', 'c', 'd', 'e', 'temoin'] }];
const [primaryPolicy, secondaryPolicy] = KIT_HERO_MEDIA_VARIANTS.slots;

function set(p: Partial<AdminMediaSetJson> & { id: string }): AdminMediaSetJson {
  return {
    componentId: 'sc',
    slot: 'primary',
    variantDim: 'default',
    variantKey: '*',
    locale: '*',
    crossLocale: false,
    status: 'published',
    version: 1,
    publishedAt: null,
    scheduledAt: null,
    source: 'admin',
    notes: null,
    authorId: null,
    createdAt: '2026-10-30T08:00:00.000Z',
    updatedAt: '2026-10-30T08:00:00.000Z',
    items: [],
    ...p,
  };
}

function dto(s: AdminMediaSetJson): MediaSetDTO {
  return {
    ...s,
    items: [{ setId: s.id, position: 0, desktop: { src: 'x', width: 1, height: 1 }, mobile: null, alt: {}, mediaAlt: null, objectPosition: null, focalX: null, focalY: null }],
  };
}

describe('matrice — lignes et libellés', () => {
  it('défaut puis les six angles', () => {
    const rows = matrixRows(DIMS);
    expect(rows.map((r) => r.variantKey)).toEqual(['*', 'a', 'b', 'c', 'd', 'e', 'temoin']);
    expect(rowLabel(rows[0]!).title).toBe('Défaut');
    expect(rowLabel(rows[5]!)).toEqual({ title: 'Angle E', hint: 'salon ou 99 DH' });
    expect(rowLabel(rows[6]!).title).toBe('Témoin');
  });
});

describe('statusPills', () => {
  it('publié vN, programmé, bloqué, brouillon importé', () => {
    const published = set({ id: 'p', version: 3 });
    const scheduled = set({ id: 's', status: 'scheduled', scheduledAt: '2026-11-02T08:00:00.000Z' });
    const draft = set({ id: 'd', status: 'draft', source: 'import' });
    const entry = indexSets([published, scheduled, draft]).get('primary|default|*|*');
    const labels = statusPills(entry, new Set()).map((p) => p.label);
    expect(labels[0]).toBe('publié v3');
    expect(labels[1]).toMatch(/^programmé 2 nov\./);
    expect(labels[2]).toBe('brouillon importé');
    expect(statusPills(entry, new Set(['s'])).map((p) => p.label)).toContain('bloqué');
  });
});

describe('inheritanceFor (couverture serveur)', () => {
  const sets = [
    set({ id: 'def_fr', locale: 'fr', crossLocale: true }),
    set({ id: 'e_any', variantDim: 'angle', variantKey: 'e', locale: '*', version: 2 }),
  ];
  const coverage = computeMediaSetCoverage(sets.map(dto), KIT_HERO_MEDIA_VARIANTS);

  it('angle e en ar hérite de « angle e · * »', () => {
    const cell = coverageCellFor(coverage.cells, { variantDim: 'angle', variantKey: 'e' }, 'ar', 'primary');
    expect(inheritanceFor(cell, primaryPolicy, new Set())).toMatchObject({
      kind: 'inherited',
      label: 'hérite de : angle e · *',
      setId: 'e_any',
    });
  });

  it('angle a en ar hérite du défaut fr sans texte', () => {
    const cell = coverageCellFor(coverage.cells, { variantDim: 'angle', variantKey: 'a' }, 'ar', 'primary');
    expect(inheritanceFor(cell, primaryPolicy, new Set())?.label).toBe('hérite de : défaut · fr (sans texte)');
  });

  it('défaut fr : ensemble propre', () => {
    const cell = coverageCellFor(coverage.cells, { variantDim: 'default', variantKey: '*' }, 'fr', 'primary');
    expect(inheritanceFor(cell, primaryPolicy, new Set())?.kind).toBe('own');
  });

  it('niveau 7 : liaison existante si un slot de repli est lié, sinon image produit', () => {
    const cell = coverageCellFor(coverage.cells, { variantDim: 'angle', variantKey: 'a' }, 'fr', 'secondary');
    expect(inheritanceFor(cell, secondaryPolicy, new Set(['context_1']))?.label).toBe('liaison existante');
    expect(inheritanceFor(cell, secondaryPolicy, new Set(['primary']))?.label).toBe('image produit');
  });
});

describe('previewUrl', () => {
  it('angle + langue, `*` → fr, défaut sans angle', () => {
    expect(previewUrl({ variantDim: 'angle', variantKey: 'e' }, 'ar')).toBe('/ar/kit?angle=e&hmv_preview=draft');
    expect(previewUrl({ variantDim: 'angle', variantKey: 'temoin' }, '*')).toBe(
      '/fr/kit?angle=temoin&hmv_preview=draft',
    );
    expect(previewUrl({ variantDim: 'default', variantKey: '*' }, 'en')).toBe('/en/kit?hmv_preview=draft');
    expect(resolveVariants({ variantDim: 'default', variantKey: '*' })).toEqual({});
    expect(resolveVariants({ variantDim: 'angle', variantKey: 'b' })).toEqual({ angle: 'b' });
  });
});

describe('editor-model', () => {
  const draft = set({
    id: 'd',
    status: 'draft',
    crossLocale: true,
    notes: ' note ',
    items: [
      {
        id: 'i2', setId: 'd', position: 1, mediaId: 'me_2', mobileMediaId: null, alt: { ar: 'نص' },
        objectPosition: null, focalX: null, focalY: null, createdAt: '',
      },
      {
        id: 'i1', setId: 'd', position: 0, mediaId: 'me_1', mobileMediaId: 'me_1m', alt: { fr: ' Alt ' },
        objectPosition: 'top', focalX: 40, focalY: 60, createdAt: '',
      },
    ],
  });

  it('trie par position et produit le payload PUT /draft', () => {
    const form = formFromSet(draft);
    expect(toDraftPayload({ slot: 'secondary', variantDim: 'angle', variantKey: 'e', locale: 'ar' }, form)).toEqual({
      slot: 'secondary',
      variantDim: 'angle',
      variantKey: 'e',
      locale: 'ar',
      crossLocale: true,
      notes: 'note',
      items: [
        { mediaId: 'me_1', mobileMediaId: 'me_1m', alt: { fr: 'Alt' }, objectPosition: 'top', focalX: 40, focalY: 60 },
        { mediaId: 'me_2', mobileMediaId: null, alt: { ar: 'نص' }, objectPosition: null, focalX: null, focalY: null },
      ],
    });
  });

  it('empreinte stable ; réordonner = modifié', () => {
    const form = formFromSet(draft);
    const fp = formFingerprint(form);
    expect(formFingerprint(formFromSet(draft))).toBe(fp);
    expect(formFingerprint({ ...form, items: moveItem(form.items, 0, 1) })).not.toBe(fp);
  });

  it('alt manquants selon la langue de la cellule', () => {
    const [first] = formFromSet(draft).items;
    expect(missingAltLocales(first!, 'fr')).toEqual([]);
    expect(missingAltLocales(first!, 'ar')).toEqual(['ar']);
    expect(missingAltLocales(first!, '*')).toEqual(['ar', 'en']);
  });

  it('parseFocal borne 0–100', () => {
    expect(parseFocal('')).toBeNull();
    expect(parseFocal('140')).toBe(100);
    expect(parseFocal('-3')).toBe(0);
    expect(parseFocal('33.6')).toBe(34);
  });
});
