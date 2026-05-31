/**
 * Tests metadata `/commander`.
 *
 * Le test importe l'export `metadata` du module page. Pour éviter de tirer
 * le composant `CheckoutPage` et toute la pile commerce (zustand, contexts…),
 * on mocke les dépendances rendu via `vi.mock`. La metadata reste évaluée
 * exactement comme à l'exécution.
 *
 * Couvre :
 *  - title court ; le template root `%s — FemiGlow` étend à « Commander — FemiGlow ».
 *  - description ≥ 80 chars (signal qualité Google snippet).
 *  - robots noindex (page transactionnelle, ne pas indexer).
 *  - canonical explicite `/commander` (évite la fuite vers home par défaut).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/commerce/CheckoutPage', () => ({
  CheckoutPage: () => null,
}));
vi.mock('@/lib/seo/json-ld', () => ({
  JsonLd: () => null,
  breadcrumbListSchema: () => ({}),
}));

import { metadata } from './page';

describe('metadata /commander', () => {
  it('expose un title court (template root applique « — FemiGlow »)', () => {
    expect(metadata.title).toBe('Commander');
  });

  it('décrit la page en au moins 80 caractères', () => {
    const desc = typeof metadata.description === 'string' ? metadata.description : '';
    expect(desc.length).toBeGreaterThanOrEqual(80);
  });

  it('refuse l\'indexation', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('déclare une canonical explicite vers /commander', () => {
    expect(metadata.alternates?.canonical).toBe('/commander');
  });
});
