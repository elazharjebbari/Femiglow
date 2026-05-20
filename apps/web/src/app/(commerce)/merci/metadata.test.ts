/**
 * Tests metadata `/merci`.
 *
 * cf. apps/web/src/app/commander/metadata.test.ts pour la justification du
 * pattern (mock des dépendances rendu, assertions ciblées sur l'export
 * `metadata`).
 *
 * Couvre :
 *  - title « Merci » (template root → « Merci — FemiGlow »).
 *  - description ≥ 80 chars.
 *  - robots noindex.
 *  - canonical explicite `/merci`.
 *  - Cache-Control no-store dans `other` (préserve l'existant — la page
 *    transactionnelle ne doit jamais être servie depuis le CDN).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/commerce/MerciClient', () => ({
  MerciClient: () => null,
  MerciFallback: () => null,
}));
vi.mock('@/lib/seo/json-ld', () => ({
  JsonLd: () => null,
  breadcrumbListSchema: () => ({}),
}));
vi.mock('@/lib/schemas', () => ({
  orderIdSchema: { safeParse: () => ({ success: false }) },
}));

import { metadata } from './page';

describe('metadata /merci', () => {
  it('expose un title court (template root applique « — FemiGlow »)', () => {
    expect(metadata.title).toBe('Merci');
  });

  it('décrit la page en au moins 80 caractères', () => {
    const desc = typeof metadata.description === 'string' ? metadata.description : '';
    expect(desc.length).toBeGreaterThanOrEqual(80);
  });

  it('refuse l\'indexation', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('déclare une canonical explicite vers /merci', () => {
    expect(metadata.alternates?.canonical).toBe('/merci');
  });

  it('préserve le Cache-Control no-store transactionnel', () => {
    expect(metadata.other?.['Cache-Control']).toBe('no-store');
  });
});
