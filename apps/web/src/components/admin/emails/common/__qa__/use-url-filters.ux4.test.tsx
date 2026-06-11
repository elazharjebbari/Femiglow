/**
 * Vague 4 — FONDATION — useUrlFilters (UX-TRANSVERSE-009).
 *
 * Oracle UX4-FONDATION-009 : le hook lit les filtres depuis searchParams
 * (fusionnés sur les défauts), `setFilter` écrit dans l'URL via router.replace
 * (les valeurs par défaut/vides sont retirées → URL minimale), `resetFilters`
 * nettoie l'URL.
 *
 * `next/navigation` est mocké : on capture les appels `router.replace` et on
 * pilote `useSearchParams` via un état contrôlé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/admin/emails/campaigns',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { useUrlFilters } from '../use-url-filters';

function Probe() {
  const { filters, setFilter, setFilters, resetFilters } = useUrlFilters({
    status: 'all',
    q: '',
    page: '1',
  });
  return (
    <div>
      <output data-testid="status">{filters.status}</output>
      <output data-testid="q">{filters.q}</output>
      <output data-testid="page">{filters.page}</output>
      <button onClick={() => setFilter('status', 'sent')}>set-status</button>
      <button onClick={() => setFilter('q', 'amal')}>set-q</button>
      <button onClick={() => setFilter('status', 'all')}>set-status-default</button>
      <button onClick={() => setFilters({ q: 'x', page: '3' })}>set-many</button>
      <button onClick={() => resetFilters()}>reset</button>
    </div>
  );
}

beforeEach(() => {
  replace.mockClear();
  currentSearch = '';
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('useUrlFilters — UX4-FONDATION-009', () => {
  it('UX4-FONDATION-009 : lit les défauts quand l’URL est vide', () => {
    render(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('all');
    expect(screen.getByTestId('q')).toHaveTextContent('');
    expect(screen.getByTestId('page')).toHaveTextContent('1');
  });

  it('UX4-FONDATION-009b : lit la valeur depuis searchParams (override du défaut)', () => {
    currentSearch = 'status=failed&q=kao';
    render(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('failed');
    expect(screen.getByTestId('q')).toHaveTextContent('kao');
  });

  it('UX4-FONDATION-009c : setFilter écrit le param non-défaut dans l’URL', async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByText('set-status'));
    expect(replace).toHaveBeenCalledWith('/admin/emails/campaigns?status=sent', {
      scroll: false,
    });
  });

  it('UX4-FONDATION-009d : une valeur égale au défaut est RETIRÉE de l’URL', async () => {
    currentSearch = 'status=sent';
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByText('set-status-default')); // status -> 'all' (défaut)
    // status retiré → URL nettoyée (pathname seul, pas de ?).
    expect(replace).toHaveBeenCalledWith('/admin/emails/campaigns', { scroll: false });
  });

  it('UX4-FONDATION-009e : setFilters patch plusieurs clés d’un coup', async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByText('set-many'));
    const arg = replace.mock.calls.at(-1)?.[0] as string;
    expect(arg).toContain('q=x');
    expect(arg).toContain('page=3');
  });

  it('UX4-FONDATION-009f : resetFilters nettoie tous les params', async () => {
    currentSearch = 'status=failed&q=kao&page=4';
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByText('reset'));
    expect(replace).toHaveBeenCalledWith('/admin/emails/campaigns', { scroll: false });
  });
});
