/**
 * Tests Phase 5.A — resolver + store + schemas.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { mockKitPageContent } from '@/data/mock/kit';
import { kitCompositionOverrideUpsertSchema } from './schemas';
import {
  getKitCompositionOverride,
  publishKitCompositionOverride,
  resetKitCompositionOverride,
  unpublishKitCompositionOverride,
  upsertKitCompositionOverride,
} from './store';
import {
  resolveKitComposition,
  resolveKitCompositionDraft,
  resolveKitCompositionItemDraft,
} from './resolver';

beforeEach(() => {
  resetMemoryStore();
});

describe('kitCompositionOverrideUpsertSchema', () => {
  it('accepte un patch minimal { subProductId }', () => {
    const r = kitCompositionOverrideUpsertSchema.safeParse({
      subProductId: '1-paste',
    });
    expect(r.success).toBe(true);
  });

  it('refuse un subProductId hors enum', () => {
    const r = kitCompositionOverrideUpsertSchema.safeParse({
      subProductId: 'unknown',
    });
    expect(r.success).toBe(false);
  });

  it('refuse une narrative sans ponctuation finale', () => {
    const r = kitCompositionOverrideUpsertSchema.safeParse({
      subProductId: '1-paste',
      narrative: 'Filmé à Rabat',
    });
    expect(r.success).toBe(false);
  });

  it('refuse une ingredients[] vide', () => {
    const r = kitCompositionOverrideUpsertSchema.safeParse({
      subProductId: '1-paste',
      ingredients: [],
    });
    expect(r.success).toBe(false);
  });

  it('accepte null pour effacer un champ', () => {
    const r = kitCompositionOverrideUpsertSchema.safeParse({
      subProductId: '1-paste',
      narrative: null,
      ingredients: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('store — upsert/get/publish/reset', () => {
  it('renvoie null quand aucun override', () => {
    expect(getKitCompositionOverride('1-paste')).toBeNull();
  });

  it('upsert crée le singleton avec draftedAt', () => {
    const r = upsertKitCompositionOverride({
      subProductId: '1-paste',
      narrative: 'Test.',
    });
    expect(r.id).toBe('kit-composition:1-paste');
    expect(r.narrative).toBe('Test.');
    expect(r.publishedAt).toBeNull();
    expect(r.draftedAt).not.toBeNull();
  });

  it('upsert successif merge le patch', () => {
    upsertKitCompositionOverride({ subProductId: '1-paste', narrative: 'A.' });
    const r = upsertKitCompositionOverride({
      subProductId: '1-paste',
      usageHint: 'B',
    });
    expect(r.narrative).toBe('A.');
    expect(r.usageHint).toBe('B');
  });

  it('null efface le champ', () => {
    upsertKitCompositionOverride({ subProductId: '1-paste', narrative: 'A.' });
    const r = upsertKitCompositionOverride({
      subProductId: '1-paste',
      narrative: null,
    });
    expect(r.narrative).toBeNull();
  });

  it('publish pose publishedAt et clear draftedAt', () => {
    upsertKitCompositionOverride({ subProductId: '1-paste', narrative: 'A.' });
    const r = publishKitCompositionOverride('1-paste');
    expect(r?.publishedAt).not.toBeNull();
    expect(r?.draftedAt).toBeNull();
  });

  it('publish renvoie null si pas d\'override', () => {
    expect(publishKitCompositionOverride('1-paste')).toBeNull();
  });

  it('reset supprime', () => {
    upsertKitCompositionOverride({ subProductId: '1-paste', narrative: 'A.' });
    resetKitCompositionOverride('1-paste');
    expect(getKitCompositionOverride('1-paste')).toBeNull();
  });
});

describe('resolveKitComposition — public', () => {
  it('mock pur quand aucun override', () => {
    const r = resolveKitComposition();
    expect(r).toHaveLength(mockKitPageContent.composition.length);
    expect(r[0]?.meta.source).toBe('mock');
  });

  it('mock même si override draft', () => {
    upsertKitCompositionOverride({
      subProductId: '1-paste',
      narrative: 'Override draft.',
    });
    const r = resolveKitComposition();
    const paste = r.find((it) => it.subProduct.id === '1-paste');
    expect(paste?.meta.source).toBe('mock');
    expect(paste?.subProduct.narrative).toBe(
      mockKitPageContent.composition.find((s) => s.id === '1-paste')?.narrative,
    );
  });

  it('merge override publié sur le mock', () => {
    upsertKitCompositionOverride({
      subProductId: '1-paste',
      narrative: 'Override publié.',
    });
    publishKitCompositionOverride('1-paste');
    const r = resolveKitComposition();
    const paste = r.find((it) => it.subProduct.id === '1-paste');
    expect(paste?.meta.source).toBe('override-published');
    expect(paste?.subProduct.narrative).toBe('Override publié.');
  });
});

describe('resolveKitCompositionDraft — admin', () => {
  it('retourne mock pour les sous-produits sans override', () => {
    const r = resolveKitCompositionDraft();
    expect(r[0]?.meta.source).toBe('mock');
  });

  it('retourne draft même non publié', () => {
    upsertKitCompositionOverride({
      subProductId: '2-powder',
      narrative: 'Draft.',
    });
    const r = resolveKitCompositionDraft();
    const powder = r.find((it) => it.subProduct.id === '2-powder');
    expect(powder?.meta.source).toBe('override-draft');
    expect(powder?.subProduct.narrative).toBe('Draft.');
  });
});

describe('resolveKitCompositionItemDraft', () => {
  it('null si subProductId inconnu', () => {
    expect(resolveKitCompositionItemDraft('1-paste' as any)).not.toBeNull();
  });

  it('mock pour sub-product sans override', () => {
    const r = resolveKitCompositionItemDraft('1-paste');
    expect(r?.meta.source).toBe('mock');
  });

  it('retourne le draft', () => {
    upsertKitCompositionOverride({
      subProductId: '1-paste',
      usageHint: 'pinçage',
    });
    const r = resolveKitCompositionItemDraft('1-paste');
    expect(r?.meta.source).toBe('override-draft');
    expect(r?.subProduct.usageHint).toBe('pinçage');
  });
});
