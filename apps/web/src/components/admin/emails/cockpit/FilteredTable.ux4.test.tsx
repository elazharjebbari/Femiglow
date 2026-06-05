/**
 * VAGUE 4 — COCKPIT : FilteredTable (UX-COCKPIT-006/010, UX-TRANSVERSE-005).
 *
 * Oracles :
 *  - UX4-COCKPIT-007 : allSelected && total>rows.length → bannière
 *    « Les N de cette page sont sélectionnés ».
 *  - UX-COCKPIT-010 : aria-sort bascule descending↔ascending sur la colonne Date.
 *  - UX-TRANSVERSE-005 : statut rendu via StatusBadge canonique (libellé FR,
 *    plus de slug anglais).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FilteredTable } from './FilteredTable';
import type { OutboxSearchRow } from '@/lib/mail/transactional/search';

function makeRow(over: Partial<OutboxSearchRow> = {}): OutboxSearchRow {
  return {
    id: 'row-1',
    template: 'welcome',
    toEmail: 'user@x.y',
    toName: 'User One',
    subject: 'Bienvenue',
    status: 'delivered',
    attempts: 1,
    maxAttempts: 3,
    lastError: null,
    source: 'api.contact',
    createdAt: new Date('2026-05-14T20:00:00Z'),
    deliveredAt: new Date('2026-05-14T20:00:05Z'),
    bounceType: null,
    ...over,
  } as OutboxSearchRow;
}

const noop = () => {};

describe('FilteredTable — vague 4', () => {
  // UX4-COCKPIT-007 : sélection « tout » couvrant la page seule → bannière d'alerte.
  it('UX4-COCKPIT-007 : allSelected && total>rows.length → bannière « Les N de cette page sont sélectionnés »', () => {
    const rows = [makeRow({ id: 'r1' }), makeRow({ id: 'r2', toEmail: 'b@b.c' })];
    render(
      <FilteredTable
        rows={rows}
        total={4321}
        selectedIds={new Set(['r1', 'r2'])}
        onSelectionChange={noop}
      />,
    );
    const banner = screen.getByTestId('select-all-page-warning');
    expect(banner).toHaveTextContent(/Les\s*2\s*de cette page sont sélectionnés/i);
    // Mentionne le total des correspondances aux filtres (faux sentiment d'exhaustivité évité).
    expect(banner).toHaveTextContent(/4\s*321/);
  });

  it('UX4-COCKPIT-007b : page ENTIÈRE couverte (total === rows.length) → PAS de bannière', () => {
    const rows = [makeRow({ id: 'r1' }), makeRow({ id: 'r2', toEmail: 'b@b.c' })];
    render(
      <FilteredTable
        rows={rows}
        total={2}
        selectedIds={new Set(['r1', 'r2'])}
        onSelectionChange={noop}
      />,
    );
    expect(screen.queryByTestId('select-all-page-warning')).toBeNull();
  });

  it('UX4-COCKPIT-007c : sélection partielle (pas allSelected) → PAS de bannière', () => {
    const rows = [makeRow({ id: 'r1' }), makeRow({ id: 'r2', toEmail: 'b@b.c' })];
    render(
      <FilteredTable
        rows={rows}
        total={9999}
        selectedIds={new Set(['r1'])}
        onSelectionChange={noop}
      />,
    );
    expect(screen.queryByTestId('select-all-page-warning')).toBeNull();
  });

  // UX-COCKPIT-010 : aria-sort reflète la direction réelle et bascule au re-clic.
  it('UX-COCKPIT-010 : colonne Date — aria-sort descending puis ascending au toggle', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <FilteredTable
        rows={[makeRow({ id: 'r1' })]}
        total={1}
        selectedIds={new Set()}
        onSelectionChange={noop}
        sort="date_desc"
        onSortChange={onSortChange}
      />,
    );
    const dateHeader = screen.getByText('Date').closest('th') as HTMLElement;
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    // Re-cliquer la colonne active bascule vers la variante ascendante.
    fireEvent.click(screen.getByText('Date'));
    expect(onSortChange).toHaveBeenCalledWith('date_asc');

    // Quand le tri courant est date_asc, l'en-tête annonce « ascending ».
    rerender(
      <FilteredTable
        rows={[makeRow({ id: 'r1' })]}
        total={1}
        selectedIds={new Set()}
        onSelectionChange={noop}
        sort="date_asc"
        onSortChange={onSortChange}
      />,
    );
    const dateHeaderAsc = screen.getByText('Date').closest('th') as HTMLElement;
    expect(dateHeaderAsc).toHaveAttribute('aria-sort', 'ascending');
  });

  // UX-TRANSVERSE-005 : libellés FR canoniques, plus de slug anglais brut.
  it('UX-TRANSVERSE-005 : statuts rendus en FR via StatusBadge (Bounce perm., DLQ)', () => {
    render(
      <FilteredTable
        rows={[
          makeRow({ id: 'r1', status: 'bounced_permanent' }),
          makeRow({ id: 'r2', status: 'dlq', toEmail: 'b@b.c' }),
        ]}
        total={2}
        selectedIds={new Set()}
        onSelectionChange={noop}
      />,
    );
    expect(within(screen.getByTestId('row-r1')).getByText('Bounce perm.')).toBeInTheDocument();
    expect(within(screen.getByTestId('row-r1')).queryByText('bounced_permanent')).toBeNull();
    expect(within(screen.getByTestId('row-r2')).getByText('DLQ')).toBeInTheDocument();
  });
});
