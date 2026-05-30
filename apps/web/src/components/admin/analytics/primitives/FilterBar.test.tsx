/**
 * Non-régression AF-05 — la FilterBar globale est masquée sur l'onglet Insights
 * (qui possède sa propre barre de filtres window/env/locale), pour éviter deux
 * barres aux modèles divergents.
 * cf. docs/analytics-audit-qa-2026-05-30/00-audit/findings-register.csv
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { FilterBar } from './FilterBar';

let pathname = '/admin/analytics/funnel';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => pathname,
}));

afterEach(() => {
  pathname = '/admin/analytics/funnel';
});

describe('FilterBar — AF-05', () => {
  it('rend la barre sur les onglets standards (funnel/cta/checkout)', () => {
    pathname = '/admin/analytics/cta';
    const { queryByTestId } = render(<FilterBar />);
    expect(queryByTestId('filter-bar')).not.toBeNull();
  });

  it('ne rend rien sur /analytics/insights (barre propre à Insights)', () => {
    pathname = '/admin/analytics/insights';
    const { queryByTestId } = render(<FilterBar />);
    expect(queryByTestId('filter-bar')).toBeNull();
  });
});
