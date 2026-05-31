import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBar } from './BulkActionsBar';

describe('<BulkActionsBar />', () => {
  it('renders nothing when selectedCount === 0', () => {
    render(<BulkActionsBar selectedCount={0} />);
    expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
  });

  it('shows count text (singular)', () => {
    render(<BulkActionsBar selectedCount={1} />);
    expect(screen.getByTestId('bulk-actions-bar')).toHaveTextContent(/1 ligne sélectionnée/);
  });

  it('shows count text (plural)', () => {
    render(<BulkActionsBar selectedCount={12} />);
    expect(screen.getByTestId('bulk-actions-bar')).toHaveTextContent(/12 lignes sélectionnées/);
  });

  it('renders the 3 default actions', () => {
    render(<BulkActionsBar selectedCount={1} />);
    expect(screen.getByTestId('bulk-action-retry')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-action-suppress')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-action-export')).toBeInTheDocument();
  });

  it('calls onAction with id when clicked', () => {
    const onAction = vi.fn();
    render(<BulkActionsBar selectedCount={1} onAction={onAction} />);
    fireEvent.click(screen.getByTestId('bulk-action-retry'));
    expect(onAction).toHaveBeenCalledWith('retry');
  });

  it('calls onClear when ✕ clicked', () => {
    const onClear = vi.fn();
    render(<BulkActionsBar selectedCount={1} onClear={onClear} />);
    fireEvent.click(screen.getByTestId('bulk-clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('applies danger style on suppress', () => {
    render(<BulkActionsBar selectedCount={1} />);
    expect(screen.getByTestId('bulk-action-suppress').className).toMatch(/red/);
  });

  it('accepts custom action set', () => {
    render(
      <BulkActionsBar
        selectedCount={1}
        actions={[{ id: 'retry', label: 'Custom retry' }]}
      />,
    );
    expect(screen.getByText(/Custom retry/)).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-action-suppress')).not.toBeInTheDocument();
  });
});
