/**
 * Tests d'intégration light du LibraryClient :
 * - URL sync (changement de filtre → router.replace + nouveau query string)
 * - debounced search (250ms) émet via filtersToSearchParams
 * - bulk-select toggle change le state visible (toolbar apparaît)
 *
 * Pour ne pas embarquer un router App Router complet, on re-mock
 * `next/navigation` localement avec un router observable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { LibraryItem } from '@/lib/content-studio-v2/library/types';

const routerReplace = vi.fn();
let currentSearch = '';
const pathname = '/admin/content-studio-v2/library';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: (url: string) => {
      routerReplace(url);
      const q = url.split('?')[1] ?? '';
      currentSearch = q;
    },
    push: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

// Le composant Toaster + sonner aren't needed: mock toast to avoid console.
vi.mock('sonner', () => ({
  toast: {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  },
}));

import { CommandRegistryProvider } from '@/lib/content-studio-v2/state/CommandRegistry';
import { HotkeyRegistryProvider } from '@/lib/content-studio-v2/state/useHotkey';
import { LibraryClient } from './LibraryClient';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <HotkeyRegistryProvider>
      <CommandRegistryProvider>{children}</CommandRegistryProvider>
    </HotkeyRegistryProvider>
  );
}

function makeItem(over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'cp_1',
    draftId: 'cd_1',
    postId: 'cp_1',
    caption: 'Rituel du soir hydratation profonde',
    variantLabel: 'A',
    platform: 'instagram',
    format: 'post',
    pillar: 'rituel',
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    sortAt: '2026-05-15T10:00:00.000Z',
    thumbnail: { url: null, kind: null, alt: '' },
    ...over,
  };
}

beforeEach(() => {
  routerReplace.mockReset();
  currentSearch = '';
});

describe('LibraryClient', () => {
  it('renders the result counter from initial items', () => {
    const items = [makeItem({ id: '1' }), makeItem({ id: '2' }), makeItem({ id: '3' })];
    render(<Wrapper><LibraryClient initialItems={items} /></Wrapper>);
    expect(screen.getByText(/3 \/ 3 résultats/i)).toBeInTheDocument();
  });

  it('URL-syncs filter changes via router.replace', () => {
    const items = [
      makeItem({ id: '1', status: 'approved' }),
      makeItem({ id: '2', status: 'rejected' }),
    ];
    render(<Wrapper><LibraryClient initialItems={items} /></Wrapper>);

    // Open the status popover and check "approved".
    fireEvent.click(screen.getByRole('button', { name: /Statut/i }));
    const checkbox = screen.getByRole('checkbox', { name: /Approuvé/i });
    fireEvent.click(checkbox);

    expect(routerReplace).toHaveBeenCalled();
    const lastCall = routerReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toContain('status=approved');
  });

  it('debounced search (250ms) emits a URL update with q=', async () => {
    vi.useFakeTimers();
    const items = [makeItem({ id: '1', caption: 'Hydratation' })];
    render(<Wrapper><LibraryClient initialItems={items} /></Wrapper>);
    const input = screen.getByLabelText(/Rechercher dans la bibliothèque/i);
    fireEvent.change(input, { target: { value: 'hydra' } });
    // Avant 250ms : pas d'émission.
    expect(routerReplace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(routerReplace).toHaveBeenCalled();
    const lastCall = routerReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toContain('q=hydra');
    vi.useRealTimers();
  });

  it('bulk selection toggles the action bar visibility', () => {
    const items = [makeItem({ id: '1' })];
    render(<Wrapper><LibraryClient initialItems={items} /></Wrapper>);
    // Initially: no bulk bar.
    expect(screen.queryByRole('region', { name: /Actions groupées/i })).toBeNull();
    // Click the per-card checkbox.
    const checkbox = screen.getByLabelText(/Sélectionner :/i);
    fireEvent.click(checkbox);
    expect(screen.getByRole('region', { name: /Actions groupées/i })).toBeInTheDocument();
    expect(screen.getByText(/1 sélectionné/)).toBeInTheDocument();
  });

  it('emits a URL with multiple selected statuses (multiselect)', () => {
    const items = [makeItem({ id: '1', status: 'approved' })];
    render(<Wrapper><LibraryClient initialItems={items} /></Wrapper>);
    fireEvent.click(screen.getByRole('button', { name: /Statut/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Approuvé/i }));
    expect(routerReplace).toHaveBeenCalled();
    const url1 = routerReplace.mock.calls.at(-1)?.[0] as string;
    expect(url1).toMatch(/status=approved/);
    // Toggle a second status — pop is still open.
    fireEvent.click(screen.getByRole('checkbox', { name: /Programmé/i }));
    const url2 = routerReplace.mock.calls.at(-1)?.[0] as string;
    // After Radix portal close + re-open, we may need to use queryAll, but
    // either way the URL we just emitted must contain 'scheduled'.
    expect(url2).toMatch(/scheduled/);
  });
});
