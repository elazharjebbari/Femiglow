/**
 * Tests du resolver kit-pack.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveKitPack, resolveKitPackDraft } from './resolver';
import {
  publishKitPackOverride,
  resetKitPackOverride,
  upsertKitPackOverride,
} from './store';
import { mockKitPageContent } from '@/data/mock/kit';

const product = {
  id: 'kit_femiglow',
  slug: 'kit-femiglow',
  name: 'Kit',
  description: 'desc',
  priceCents: 3500,
  promoPriceCents: null,
  currency: 'EUR',
  inStock: true,
  images: [
    {
      src: '/products/kit-principale.png',
      alt: 'Kit',
      width: 1200,
      height: 1500,
    },
  ],
} as never;

beforeEach(() => resetKitPackOverride());
afterEach(() => resetKitPackOverride());

describe('resolveKitPack — sans override', () => {
  it('retourne le feed mock par défaut + source=mock', () => {
    const r = resolveKitPack(product, mockKitPageContent);
    expect(r.meta.source).toBe('mock');
    expect(r.feed.hero.ctaLabel).toBe('Commander le rituel');
  });
});

describe('resolveKitPack — avec override draft (non publié)', () => {
  it('ne lit PAS le draft → fallback mock', () => {
    upsertKitPackOverride({ ctaLabel: 'Draft only' });
    const r = resolveKitPack(product, mockKitPageContent);
    expect(r.meta.source).toBe('mock');
    expect(r.feed.hero.ctaLabel).toBe('Commander le rituel');
  });
});

describe('resolveKitPack — avec override publié', () => {
  it('merge le hero.ctaLabel sur le mock', () => {
    upsertKitPackOverride({ ctaLabel: 'Override label' });
    publishKitPackOverride();
    const r = resolveKitPack(product, mockKitPageContent);
    expect(r.meta.source).toBe('override-published');
    expect(r.feed.hero.ctaLabel).toBe('Override label');
  });

  it('null dans override → retour valeur mock', () => {
    upsertKitPackOverride({ ctaLabel: 'X' });
    publishKitPackOverride();
    upsertKitPackOverride({ ctaLabel: null });
    publishKitPackOverride();
    const r = resolveKitPack(product, mockKitPageContent);
    expect(r.feed.hero.ctaLabel).toBe('Commander le rituel');
  });

  it('countLabelGeo override appliqué sur socialProof, avec le vrai compteur', () => {
    const stats = { rating: null, reviewsCount: 51 };
    upsertKitPackOverride({ countLabelGeo: '{count} maisons à Rabat' });
    publishKitPackOverride();
    expect(resolveKitPack(product, mockKitPageContent, stats).feed.socialProof?.countLabelGeo).toBe(
      '51 maisons à Rabat',
    );
    // Legacy : un nombre figé en tête est remplacé par le vrai compteur.
    upsertKitPackOverride({ countLabelGeo: '287 maisons au Maroc' });
    publishKitPackOverride();
    expect(resolveKitPack(product, mockKitPageContent, stats).feed.socialProof?.countLabelGeo).toBe(
      '51 maisons au Maroc',
    );
  });

  it('sans avis, pas de socialProof même avec un override géo', () => {
    upsertKitPackOverride({ countLabelGeo: '{count} maisons au Maroc' });
    publishKitPackOverride();
    expect(resolveKitPack(product, mockKitPageContent).feed.socialProof).toBeUndefined();
  });

  it('valueBreakdown override remplace la liste entière', () => {
    upsertKitPackOverride({
      valueBreakdown: [
        { label: 'Custom A', valueLabel: '10 €' },
        { label: 'Custom B', valueLabel: '20 €' },
      ],
    });
    publishKitPackOverride();
    const r = resolveKitPack(product, mockKitPageContent);
    expect(r.feed.hero.valueBreakdown).toHaveLength(2);
    expect(r.feed.hero.valueBreakdown?.[0]?.label).toBe('Custom A');
  });
});

describe('resolveKitPackDraft — admin preview', () => {
  it('inclut le draft non publié → source=override-draft', () => {
    upsertKitPackOverride({ ctaLabel: 'Draft' });
    const r = resolveKitPackDraft(product, mockKitPageContent);
    expect(r.meta.source).toBe('override-draft');
    expect(r.feed.hero.ctaLabel).toBe('Draft');
  });

  it('si publié, source=override-published (priorité publié sur draft)', () => {
    upsertKitPackOverride({ ctaLabel: 'Published' });
    publishKitPackOverride();
    const r = resolveKitPackDraft(product, mockKitPageContent);
    expect(r.meta.source).toBe('override-published');
  });
});
