/**
 * F07 P3.4-l (Lot 6) — filtre + tri PURS de la liste des templates.
 */
import { describe, expect, it } from 'vitest';
import {
  filterTemplates,
  sortTemplates,
  type TemplateListItem,
} from '../template-list';

const items: TemplateListItem[] = [
  { id: '1', slug: 'bienvenue', name: 'Accueil', subjectTmpl: 'Salut !', updatedAt: '2026-06-01T00:00:00.000Z' },
  { id: '2', slug: 'relance', name: 'Panier abandonné', subjectTmpl: 'Reviens', updatedAt: '2026-06-10T00:00:00.000Z' },
  { id: '3', slug: 'aid-promo', name: 'Promo Aïd', subjectTmpl: '-30% Aïd', updatedAt: '2026-06-05T00:00:00.000Z' },
];

describe('F07 — filtre liste templates', () => {
  it('F07-U-126 — vide → liste intacte', () => {
    expect(filterTemplates(items, '   ').map((t) => t.id)).toEqual(['1', '2', '3']);
  });

  it('F07-U-127 — matche slug, nom OU sujet, insensible à la casse', () => {
    expect(filterTemplates(items, 'PROMO').map((t) => t.id)).toEqual(['3']); // nom + slug
    expect(filterTemplates(items, 'reviens').map((t) => t.id)).toEqual(['2']); // sujet
    expect(filterTemplates(items, 'zzz')).toEqual([]);
  });
});

describe('F07 — tri liste templates', () => {
  it('F07-U-128 — tri par slug asc/desc (locale fr)', () => {
    expect(sortTemplates(items, 'slug', 'asc').map((t) => t.slug)).toEqual([
      'aid-promo',
      'bienvenue',
      'relance',
    ]);
    expect(sortTemplates(items, 'slug', 'desc').map((t) => t.slug)).toEqual([
      'relance',
      'bienvenue',
      'aid-promo',
    ]);
  });

  it('F07-U-129 — tri par date (récent d’abord en desc), sans muter l’entrée', () => {
    const snapshot = items.map((t) => t.id);
    expect(sortTemplates(items, 'updatedAt', 'desc').map((t) => t.id)).toEqual(['2', '3', '1']);
    expect(items.map((t) => t.id)).toEqual(snapshot); // pas de mutation in-place
  });
});
