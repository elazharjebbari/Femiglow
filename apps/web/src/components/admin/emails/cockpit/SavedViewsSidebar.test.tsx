import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SavedViewsSidebar } from './SavedViewsSidebar';

const views = [
  { id: 'sys-1', name: 'All today', isSystem: true },
  { id: 'sys-2', name: 'Failed today', isSystem: true },
  { id: 'usr-1', name: 'My VIPs', isSystem: false },
];

describe('<SavedViewsSidebar />', () => {
  it('renders system + custom views', () => {
    render(<SavedViewsSidebar views={views} />);
    expect(screen.getByTestId('view-sys-1')).toBeInTheDocument();
    expect(screen.getByTestId('view-usr-1')).toBeInTheDocument();
    expect(screen.getByText(/Vues système/i)).toBeInTheDocument();
    expect(screen.getByText(/Mes vues/i)).toBeInTheDocument();
  });

  it('highlights active view via aria-current', () => {
    render(<SavedViewsSidebar views={views} activeViewId="usr-1" />);
    expect(screen.getByTestId('view-usr-1')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('view-sys-1')).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect when clicking a view', () => {
    const onSelect = vi.fn();
    render(<SavedViewsSidebar views={views} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('view-usr-1'));
    expect(onSelect).toHaveBeenCalledWith('usr-1');
  });

  it('shows + Nouvelle vue button when onCreate provided', () => {
    const onCreate = vi.fn();
    render(<SavedViewsSidebar views={views} onCreate={onCreate} />);
    fireEvent.click(screen.getByTestId('create-view-btn'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('shows empty state for custom views section when empty', () => {
    render(<SavedViewsSidebar views={[{ id: 'sys-1', name: 'X', isSystem: true }]} />);
    expect(screen.getByText(/Aucune vue personnalisée/i)).toBeInTheDocument();
  });

  it('does not allow rename/delete on system views', () => {
    const onDelete = vi.fn();
    render(<SavedViewsSidebar views={views} onDelete={onDelete} />);
    // Pas de menu sur les vues system : confirme par count
    const menus = screen.queryAllByLabelText(/Actions/i);
    // Custom views only get a menu → 1 menu pour 1 custom view
    expect(menus).toHaveLength(1);
  });

  it('rename flow : open menu → input appears → Enter applies', async () => {
    const onRename = vi.fn();
    render(<SavedViewsSidebar views={views} onRename={onRename} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/Actions/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Renommer/i }));
    });
    const input = screen.getByLabelText(/Renommer la vue/i) as HTMLInputElement;
    expect(input.value).toBe('My VIPs');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'VIPs renommé' } });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(onRename).toHaveBeenCalledWith('usr-1', 'VIPs renommé');
  });

  it('delete flow : open menu → click Supprimer → callback', async () => {
    const onDelete = vi.fn();
    render(<SavedViewsSidebar views={views} onDelete={onDelete} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/Actions/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Supprimer/i }));
    });
    expect(onDelete).toHaveBeenCalledWith('usr-1');
  });
});
