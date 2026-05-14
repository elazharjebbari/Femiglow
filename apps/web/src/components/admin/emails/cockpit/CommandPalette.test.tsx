/**
 * Tests RTL — CommandPalette.
 *
 * On simule ⌘K + saisie + Enter + Esc + sélection view/action.
 * cmdk lib monte un Dialog Radix — on l'ouvre via le shortcut clavier.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';

function pressCmdK() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
}

describe('<CommandPalette />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show by default (closed)', () => {
    render(<CommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Cmd+K', async () => {
    render(<CommandPalette />);
    await act(async () => {
      pressCmdK();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/status:failed/i)).toBeInTheDocument();
  });

  it('opens on Ctrl+K (Windows/Linux)', async () => {
    render(<CommandPalette />);
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('parses status:failed as we type', async () => {
    render(<CommandPalette />);
    await act(async () => pressCmdK());
    const input = screen.getByPlaceholderText(/status:failed/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: 'status:failed' } });
    });

    // L'aperçu "Filtres résolus" devrait contenir status
    expect(screen.getByText(/1 filtre/i)).toBeInTheDocument();
  });

  it('shows error badge when filter is invalid', async () => {
    render(<CommandPalette />);
    await act(async () => pressCmdK());
    const input = screen.getByPlaceholderText(/status:failed/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: 'status:invalidvalue' } });
    });

    expect(screen.getByText(/1 erreur/i)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('calls onApply with parsed filters on Enter', async () => {
    const onApply = vi.fn();
    render(<CommandPalette onApply={onApply} />);
    await act(async () => pressCmdK());
    const input = screen.getByPlaceholderText(/status:failed/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: 'status:failed' } });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]![0]!.filters).toHaveLength(1);
  });

  it('renders saved views', async () => {
    render(
      <CommandPalette
        savedViews={[
          { id: 'v-1', name: 'Failed today', isSystem: true },
          { id: 'v-2', name: 'My VIPs', isSystem: false },
        ]}
      />,
    );
    await act(async () => pressCmdK());
    expect(screen.getByText(/Failed today/)).toBeInTheDocument();
    expect(screen.getByText(/My VIPs/)).toBeInTheDocument();
    expect(screen.getByText(/système/i)).toBeInTheDocument();
  });

  it('renders actions', async () => {
    render(<CommandPalette actions={[{ id: 'retry', label: 'Retry selected' }]} />);
    await act(async () => pressCmdK());
    expect(screen.getByText(/Retry selected/)).toBeInTheDocument();
  });

  it('calls onSelectView when clicking a view', async () => {
    const onSelectView = vi.fn();
    render(
      <CommandPalette
        savedViews={[{ id: 'v-1', name: 'Failed today', isSystem: true }]}
        onSelectView={onSelectView}
      />,
    );
    await act(async () => pressCmdK());

    const item = screen.getByText(/Failed today/);
    await act(async () => {
      fireEvent.click(item);
    });
    expect(onSelectView).toHaveBeenCalledWith('v-1');
  });

  it('shows status suggestions when typing "status:"', async () => {
    render(<CommandPalette />);
    await act(async () => pressCmdK());
    const input = screen.getByPlaceholderText(/status:failed/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: 'status:' } });
    });

    // Devrait afficher "Statuts" heading + suggestions failed, sent, etc.
    expect(screen.getByText(/Statuts/i)).toBeInTheDocument();
    expect(screen.getByText(/status:failed/i)).toBeInTheDocument();
    expect(screen.getByText(/status:delivered/i)).toBeInTheDocument();
  });

  it('respects initialValue prefill', async () => {
    render(<CommandPalette initialValue="status:failed" />);
    await act(async () => pressCmdK());
    const input = screen.getByPlaceholderText(/status:failed/i) as HTMLInputElement;
    expect(input.value).toBe('status:failed');
  });
});
