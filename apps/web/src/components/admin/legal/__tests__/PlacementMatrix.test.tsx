import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { server } from '@/test/msw/server';
import { defaultLegalState, legalHandlers } from '@/test/msw/legal-handlers';
import { PlacementMatrix } from '../PlacementMatrix';

const ZONES = [
  { key: 'footer-main', label: 'Footer', isRequired: true, maxItemsRecommended: 8 },
  { key: 'mobile-menu', label: 'Menu mobile', isRequired: false, maxItemsRecommended: 5 },
];

const PAGES = [
  { slug: 'cgv', title: 'CGV', status: 'published' },
  { slug: 'cookies', title: 'Cookies', status: 'draft' },
];

const PLACEMENTS = [
  {
    pageSlug: 'cgv',
    zoneKey: 'footer-main',
    isVisible: true,
    displayOrder: 1,
    labelOverride: null,
  },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => server.use(...legalHandlers()));

describe('PlacementMatrix — rendu', () => {
  it('rend la matrice avec en-têtes de zones', () => {
    render(<PlacementMatrix zones={ZONES} pages={PAGES} placements={PLACEMENTS} />);
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(screen.getByText('Menu mobile')).toBeInTheDocument();
  });

  it('affiche le ratio par zone (compte des placements visibles)', () => {
    render(<PlacementMatrix zones={ZONES} pages={PAGES} placements={PLACEMENTS} />);
    // footer-main : 1 placement visible / 8 max recommandé
    expect(screen.getByText(/footer-main · 1\/8/)).toBeInTheDocument();
    expect(screen.getByText(/mobile-menu · 0\/5/)).toBeInTheDocument();
  });

  it('coche les cases avec placement visible', () => {
    render(<PlacementMatrix zones={ZONES} pages={PAGES} placements={PLACEMENTS} />);
    const placedBtn = screen.getByLabelText(/cgv dans Footer.*visible/);
    expect(placedBtn).toHaveTextContent('✓');
  });
});

describe('PlacementMatrix — toggle', () => {
  it('cliquer sur une case non-placée la place', async () => {
    const user = userEvent.setup();
    render(<PlacementMatrix zones={ZONES} pages={PAGES} placements={PLACEMENTS} />);
    const btn = screen.getByLabelText(/cookies dans Footer.*non placé/);
    await user.click(btn);
    await waitFor(() =>
      expect(screen.getByLabelText(/cookies dans Footer.*visible/)).toBeInTheDocument(),
    );
  });

  it('cliquer sur une case placée la décoche', async () => {
    const user = userEvent.setup();
    render(<PlacementMatrix zones={ZONES} pages={PAGES} placements={PLACEMENTS} />);
    const btn = screen.getByLabelText(/cgv dans Footer.*visible/);
    await user.click(btn);
    await waitFor(() =>
      expect(screen.getByLabelText(/cgv dans Footer.*non placé/)).toBeInTheDocument(),
    );
  });
});
