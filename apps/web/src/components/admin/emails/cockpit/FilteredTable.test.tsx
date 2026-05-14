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

describe('<FilteredTable />', () => {
  const noopSelect = () => {};

  it('renders skeleton when loading', () => {
    render(<FilteredTable rows={[]} total={0} isLoading selectedIds={new Set()} onSelectionChange={noopSelect} />);
    expect(screen.getByTestId('filtered-table-skeleton')).toBeInTheDocument();
  });

  it('renders empty state when 0 rows', () => {
    render(<FilteredTable rows={[]} total={0} selectedIds={new Set()} onSelectionChange={noopSelect} />);
    expect(screen.getByTestId('filtered-table-empty')).toBeInTheDocument();
  });

  it('renders rows', () => {
    const rows = [makeRow({ id: 'r1' }), makeRow({ id: 'r2', toEmail: 'b@b.c' })];
    render(<FilteredTable rows={rows} total={2} selectedIds={new Set()} onSelectionChange={noopSelect} />);
    expect(screen.getByTestId('row-r1')).toBeInTheDocument();
    expect(screen.getByTestId('row-r2')).toBeInTheDocument();
  });

  it('applies status badge color', () => {
    render(
      <FilteredTable
        rows={[makeRow({ id: 'r1', status: 'failed' })]}
        total={1}
        selectedIds={new Set()}
        onSelectionChange={noopSelect}
      />,
    );
    const badge = within(screen.getByTestId('row-r1')).getByText('failed');
    expect(badge.className).toMatch(/red/);
  });

  it('toggle one row via checkbox', () => {
    const onSelectionChange = vi.fn();
    render(
      <FilteredTable
        rows={[makeRow({ id: 'r1' })]}
        total={1}
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );
    const row = screen.getByTestId('row-r1');
    fireEvent.click(within(row).getByRole('checkbox'));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const set = onSelectionChange.mock.calls[0]![0] as Set<string>;
    expect(set.has('r1')).toBe(true);
  });

  it('select all via header checkbox', () => {
    const onSelectionChange = vi.fn();
    render(
      <FilteredTable
        rows={[makeRow({ id: 'r1' }), makeRow({ id: 'r2' })]}
        total={2}
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('select-all'));
    const next = onSelectionChange.mock.calls[0]![0] as Set<string>;
    expect(next.has('r1')).toBe(true);
    expect(next.has('r2')).toBe(true);
  });

  it('clears all when header checkbox is clicked again', () => {
    const onSelectionChange = vi.fn();
    render(
      <FilteredTable
        rows={[makeRow({ id: 'r1' })]}
        total={1}
        selectedIds={new Set(['r1'])}
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('select-all'));
    const next = onSelectionChange.mock.calls[0]![0] as Set<string>;
    expect(next.size).toBe(0);
  });

  it('shift-click range selects between last and current', () => {
    const onSelectionChange = vi.fn();
    const rows = [makeRow({ id: 'r1' }), makeRow({ id: 'r2' }), makeRow({ id: 'r3' })];
    const { rerender } = render(
      <FilteredTable
        rows={rows}
        total={3}
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Click r1 first (sets last index = 0)
    fireEvent.click(within(screen.getByTestId('row-r1')).getByRole('checkbox'));
    let next = onSelectionChange.mock.calls[0]![0] as Set<string>;
    rerender(
      <FilteredTable
        rows={rows}
        total={3}
        selectedIds={next}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Shift+click r3 → should add r2 + r3 (r1 stays)
    const checkbox = within(screen.getByTestId('row-r3')).getByRole('checkbox');
    fireEvent.click(checkbox, { shiftKey: true });
    next = onSelectionChange.mock.calls[1]![0] as Set<string>;
    expect(next.has('r1')).toBe(true);
    expect(next.has('r2')).toBe(true);
    expect(next.has('r3')).toBe(true);
  });

  it('calls onRowClick when destinataire is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <FilteredTable
        rows={[makeRow({ id: 'r1' })]}
        total={1}
        selectedIds={new Set()}
        onSelectionChange={noopSelect}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(within(screen.getByTestId('row-r1')).getByText('user@x.y'));
    expect(onRowClick).toHaveBeenCalledWith('r1');
  });

  it('calls onSortChange when clicking sortable header', () => {
    const onSortChange = vi.fn();
    render(
      <FilteredTable
        rows={[makeRow({ id: 'r1' })]}
        total={1}
        selectedIds={new Set()}
        onSelectionChange={noopSelect}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByText('Statut'));
    expect(onSortChange).toHaveBeenCalledWith('status');
  });

  it('shows footer with total + selection count', () => {
    render(
      <FilteredTable
        rows={[makeRow({ id: 'r1' })]}
        total={47}
        selectedIds={new Set(['r1'])}
        onSelectionChange={noopSelect}
      />,
    );
    expect(screen.getByText(/47/)).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toHaveTextContent('1 sélectionné');
  });
});
