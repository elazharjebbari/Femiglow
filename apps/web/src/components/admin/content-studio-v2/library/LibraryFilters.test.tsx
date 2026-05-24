/**
 * Tests for LibraryFilters — toolbar with status / platform / pillar
 * filters, date range, result count, and reset button.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryFilters } from './LibraryFilters';
import type { LibraryFilterState } from '@/lib/content-studio-v2/library/types';
import { EMPTY_FILTERS } from '@/lib/content-studio-v2/library/types';

function emptyFilters(overrides: Partial<LibraryFilterState> = {}): LibraryFilterState {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe('LibraryFilters', () => {
  it('renders status, platform, pillar filter triggers', () => {
    render(
      <LibraryFilters
        filters={emptyFilters()}
        onChange={vi.fn()}
        resultCount={10}
        totalCount={20}
      />,
    );
    expect(screen.getByText(/Statut/i)).toBeInTheDocument();
    expect(screen.getByText(/Plateforme/i)).toBeInTheDocument();
    expect(screen.getByText(/Pilier/i)).toBeInTheDocument();
  });

  it('result count is displayed', () => {
    render(
      <LibraryFilters
        filters={emptyFilters()}
        onChange={vi.fn()}
        resultCount={5}
        totalCount={12}
      />,
    );
    expect(screen.getByText(/5 \/ 12 résultats/i)).toBeInTheDocument();
  });

  it('singular "résultat" when totalCount is 1', () => {
    render(
      <LibraryFilters
        filters={emptyFilters()}
        onChange={vi.fn()}
        resultCount={1}
        totalCount={1}
      />,
    );
    expect(screen.getByText(/1 \/ 1 résultat$/)).toBeInTheDocument();
  });

  it('reset button clears filters', () => {
    const onChange = vi.fn();
    render(
      <LibraryFilters
        filters={emptyFilters({ platform: 'instagram' })}
        onChange={onChange}
        resultCount={5}
        totalCount={10}
      />,
    );
    const resetBtn = screen.getByRole('button', { name: /Réinitialiser/i });
    fireEvent.click(resetBtn);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: [],
        platform: 'all',
        pillar: 'all',
        dateFrom: null,
        dateTo: null,
      }),
    );
  });

  it('clicking a platform option calls onChange with that platform', async () => {
    const onChange = vi.fn();
    render(
      <LibraryFilters
        filters={emptyFilters()}
        onChange={onChange}
        resultCount={10}
        totalCount={10}
      />,
    );
    // Open the platform popover
    const platformBtn = screen.getByRole('button', {
      name: /Plateforme.*Toutes/i,
    });
    fireEvent.click(platformBtn);

    // Click "Instagram" option
    const igOption = await screen.findByRole('option', { name: /Instagram/i });
    fireEvent.click(igOption);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'instagram' }),
    );
  });

  it('no reset button when filters are empty', () => {
    render(
      <LibraryFilters
        filters={emptyFilters()}
        onChange={vi.fn()}
        resultCount={10}
        totalCount={10}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /Réinitialiser/i }),
    ).not.toBeInTheDocument();
  });

  it('renders date range inputs', () => {
    render(
      <LibraryFilters
        filters={emptyFilters()}
        onChange={vi.fn()}
        resultCount={10}
        totalCount={10}
      />,
    );
    expect(screen.getByLabelText(/Date de début/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date de fin/i)).toBeInTheDocument();
  });

  it('renders toolbar with aria-label', () => {
    render(
      <LibraryFilters
        filters={emptyFilters()}
        onChange={vi.fn()}
        resultCount={10}
        totalCount={10}
      />,
    );
    expect(
      screen.getByRole('toolbar', { name: /Filtres bibliothèque/i }),
    ).toBeInTheDocument();
  });
});
