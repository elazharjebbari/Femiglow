/**
 * Tests GlobalCommandPalette — open via Cmd-K, fuzzy filter, keyboard nav, escape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalCommandPalette } from '../GlobalCommandPalette';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
}

describe('GlobalCommandPalette', () => {
  it('is closed by default — not in the DOM', () => {
    render(<GlobalCommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Ctrl-K and closes on Escape', () => {
    render(<GlobalCommandPalette />);
    openPalette();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('filters commands fuzzy', () => {
    render(<GlobalCommandPalette />);
    openPalette();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'audi' } });
    expect(screen.getByText('Audiences')).toBeInTheDocument();
    expect(screen.queryByText('Templates HTML')).not.toBeInTheDocument();
  });

  it('navigates to href on Enter', () => {
    render(<GlobalCommandPalette />);
    openPalette();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'audi' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/admin/emails/audiences');
  });

  it('shows "Aucun résultat" when no match', () => {
    render(<GlobalCommandPalette />);
    openPalette();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'xxxxxxxxx' } });
    expect(screen.getByText(/Aucun résultat/i)).toBeInTheDocument();
  });

  it('runs custom action commands', async () => {
    const action = vi.fn();
    render(
      <GlobalCommandPalette
        extraCommands={[
          { id: 'x', label: 'Test action', group: 'Actions', action },
        ]}
      />,
    );
    openPalette();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test action' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(action).toHaveBeenCalled();
  });

  it('arrow-down advances active item', () => {
    render(<GlobalCommandPalette />);
    openPalette();
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // First two options : "Dashboard emails" (idx 0) then "Emails transactionnels" (idx 1)
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('has a11y attributes: role=dialog + aria-modal + role=listbox', () => {
    render(<GlobalCommandPalette />);
    openPalette();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
  });
});
