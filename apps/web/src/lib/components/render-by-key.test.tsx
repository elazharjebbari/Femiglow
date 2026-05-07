/**
 * Vitest — renderComponentByKey (F4 / P9 / P12).
 *
 * Couvre :
 *   - placeholder rendu pour un composant pas encore migré (`unknown-key`),
 *   - dans le placeholder, chaque champ a un `[data-field-key]` (cible
 *     du SCROLL_TO_FIELD côté preview iframe),
 *   - l'absence de champs résolus produit un placeholder "Aucun champ",
 *   - P12 — `home-hero` est migré et rend le Hero RSC avec les champs
 *     fusionnés ; pas de placeholder.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderComponentByKey } from './render-by-key';
import type { ResolvedFields } from '@/lib/db/types';

describe('renderComponentByKey', () => {
  it('rend un placeholder pour un composant pas encore migré', async () => {
    const fields: ResolvedFields = {
      title: { value: 'Bonjour', meta: { source: 'binding', version: 1, locale: 'fr' } },
      kicker: { value: 'BIENVENUE', meta: { source: 'default', version: 0, locale: 'fr' } },
    };
    const tree = await renderComponentByKey('unknown-key', { fields });
    const { container, getByText } = render(tree);
    expect(container.querySelector('[data-preview-placeholder]')).toBeInTheDocument();
    expect(getByText('unknown-key')).toBeInTheDocument();
    expect(container.querySelector('[data-field-key="title"]')).toBeInTheDocument();
    expect(container.querySelector('[data-field-key="kicker"]')).toBeInTheDocument();
  });

  it('signale "Aucun champ" quand fields est vide', async () => {
    const tree = await renderComponentByKey('unknown-key', { fields: {} });
    const { getByText } = render(tree);
    expect(getByText(/Aucun champ éditorial/)).toBeInTheDocument();
  });

  it('P12 — home-hero est migré : rend le Hero RSC avec les champs fusionnés', async () => {
    const fields: ResolvedFields = {
      kicker: { value: 'CMS kicker', meta: { source: 'binding', version: 1, locale: 'fr' } },
      title: { value: 'CMS title', meta: { source: 'binding', version: 2, locale: 'fr' } },
    };
    const tree = await renderComponentByKey('home-hero', { fields });
    const { container, getByText } = render(tree);
    // Pas de placeholder
    expect(container.querySelector('[data-preview-placeholder]')).not.toBeInTheDocument();
    // Champs CMS visibles
    expect(getByText('CMS kicker')).toBeInTheDocument();
    expect(getByText('CMS title')).toBeInTheDocument();
  });
});
