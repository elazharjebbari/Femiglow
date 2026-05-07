import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable, type DataTableColumn } from './DataTable';

interface Row {
  id: string;
  name: string;
  count: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Charlie', count: 30 },
  { id: '2', name: 'Alice', count: 100 },
  { id: '3', name: 'Bob', count: 50 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Nom', sortable: true },
  { key: 'count', label: 'Vues', sortable: true, align: 'right', accessor: (r) => r.count },
];

describe('DataTable', () => {
  it('renders rows with column headers', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} />);
    expect(screen.getByText('Nom')).toBeInTheDocument();
    expect(screen.getByText('Vues')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('sorts on column click', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} />);
    fireEvent.click(screen.getByRole('button', { name: /Vues/i }));
    // first click → desc sort
    const cells = screen.getAllByRole('cell');
    // cells layout: [Charlie, 30, Alice, 100, ...]; after desc sort by count → 100, 50, 30
    expect(cells[0]).toHaveTextContent('Alice');
    fireEvent.click(screen.getByRole('button', { name: /Vues/i }));
    // toggle → asc
    const cellsAsc = screen.getAllByRole('cell');
    expect(cellsAsc[0]).toHaveTextContent('Charlie');
  });

  it('shows empty state when no rows', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        getRowId={(r) => r.id}
        emptyTitle="Vide"
      />,
    );
    expect(screen.getByText('Vide')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} loading />);
    expect(screen.getByTestId('data-table-skeleton')).toBeInTheDocument();
  });

  it('paginates when pageSize is provided', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(r) => r.id}
        pageSize={2}
      />,
    );
    expect(screen.getByText(/1–2 sur 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(screen.getByText(/3–3 sur 3/)).toBeInTheDocument();
  });
});
