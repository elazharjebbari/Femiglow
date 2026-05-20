/**
 * Tests `SubProductBlock` — accordéon + composition + post-CTA.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));

import { SubProductBlock } from './SubProductBlock';
import { mockKitPageContent } from '@/data/mock/kit';

beforeEach(() => emitMock.mockReset());
afterEach(() => cleanup());

const subProduct = mockKitPageContent.composition[0]!;

describe('SubProductBlock — rendu', () => {
  it('rend le titre + volume + usageHint inline', () => {
    render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toContain('1 Paste');
    expect(heading.textContent).toContain('15 g');
    expect(heading.textContent).toContain('une noisette filme dix doigts');
  });

  it('omet l\'usageHint si absent', () => {
    const sub = { ...subProduct, usageHint: undefined };
    render(
      <SubProductBlock
        subProduct={sub}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).not.toContain('·');
  });

  it('rend l\'intro narrative en italique Cormorant si présent', () => {
    render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    const intro = screen.getByTestId(`composition-narrative-${subProduct.id}`);
    expect(intro).toBeDefined();
    expect(intro.className).toMatch(/italic/);
    expect(intro.className).toMatch(/font-display/);
  });

  it('omet l\'intro si narrative absente', () => {
    const sub = { ...subProduct, narrative: undefined };
    render(
      <SubProductBlock
        subProduct={sub}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    expect(screen.queryByTestId(`composition-narrative-${sub.id}`)).toBeNull();
  });

  it('rend la liste responsive (cards mobile + tableau desktop)', () => {
    render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    expect(
      screen.getByTestId(`responsive-list-mobile-${subProduct.id}`),
    ).toBeDefined();
    expect(
      screen.getByTestId(`responsive-list-desktop-${subProduct.id}`),
    ).toBeDefined();
  });

  it('rend les certifications si présentes', () => {
    render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    const certs = screen.getByTestId(`certifications-${subProduct.id}`);
    expect(certs).toBeDefined();
    expect(certs.querySelectorAll('li').length).toBe(
      subProduct.certifications.length,
    );
  });

  it('rend le lien PostCtaLink avec subProductId', () => {
    render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    expect(
      screen.getByTestId(`composition-post-cta-${subProduct.id}`),
    ).toBeDefined();
  });

  it('rend la pastille NumberBadge avec label « 01 » et couleur d\'accent', () => {
    render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
      />,
    );
    expect(screen.getByText('01')).toBeDefined();
  });

  it('rend l\'ancre stable `${anchor}-${id}`', () => {
    const { container } = render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
      />,
    );
    expect(container.querySelector('article')?.id).toBe(
      `ingredients-details-${subProduct.id}`,
    );
  });
});

describe('SubProductBlock — accordéon', () => {
  it('ouvert par défaut si defaultOpen=true', () => {
    const { container } = render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    const details = container.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(true);
  });

  it('fermé par défaut si defaultOpen=false', () => {
    // Notice : useIsDesktop retourne false côté SSR/jsdom.
    const { container } = render(
      <SubProductBlock
        subProduct={subProduct}
        index={1}
        anchor="ingredients-details"
        defaultOpen={false}
      />,
    );
    const details = container.querySelector('details');
    // Sur jsdom, useIsDesktop est false par défaut → details fermé
    expect(details?.hasAttribute('open')).toBe(false);
  });

  it('ID accessible labelledby pointe sur le summary', () => {
    const { container } = render(
      <SubProductBlock
        subProduct={subProduct}
        index={0}
        anchor="ingredients-details"
        defaultOpen
      />,
    );
    const article = container.querySelector('article');
    const summary = container.querySelector('summary');
    expect(article?.getAttribute('aria-labelledby')).toBe(summary?.id);
  });
});
