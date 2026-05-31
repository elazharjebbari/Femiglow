import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShortcutsCheatsheet } from './ShortcutsCheatsheet';

afterEach(() => cleanup());

const shortcuts = [
  { key: 'j', description: 'Suivant', handler: () => {} },
  { key: 'k', description: 'Précédent', handler: () => {}, enabled: false },
  { key: 'a', description: 'Approuver', handler: () => {} },
];

describe('ShortcutsCheatsheet', () => {
  it("n'est pas rendu si open=false", () => {
    render(<ShortcutsCheatsheet open={false} onClose={() => {}} shortcuts={shortcuts} />);
    expect(screen.queryByTestId('shortcuts-cheatsheet')).toBeNull();
  });

  it('rend la liste des raccourcis quand open', () => {
    render(<ShortcutsCheatsheet open={true} onClose={() => {}} shortcuts={shortcuts} />);
    expect(screen.getByTestId('shortcuts-cheatsheet')).toBeTruthy();
    expect(screen.getByText('Suivant')).toBeTruthy();
    expect(screen.getByText('Approuver')).toBeTruthy();
  });

  it('marque les raccourcis désactivés (opacity)', () => {
    const { container } = render(
      <ShortcutsCheatsheet open={true} onClose={() => {}} shortcuts={shortcuts} />,
    );
    const greyed = container.querySelectorAll('.opacity-40');
    expect(greyed.length).toBeGreaterThan(0);
  });

  it('ferme via Escape', () => {
    const onClose = vi.fn();
    render(<ShortcutsCheatsheet open={true} onClose={onClose} shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('ferme via clic sur overlay', () => {
    const onClose = vi.fn();
    render(<ShortcutsCheatsheet open={true} onClose={onClose} shortcuts={shortcuts} />);
    fireEvent.click(screen.getByTestId('shortcuts-cheatsheet'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ne ferme pas en cliquant dans la modale', () => {
    const onClose = vi.fn();
    render(<ShortcutsCheatsheet open={true} onClose={onClose} shortcuts={shortcuts} />);
    const dialog = screen.getByTestId('shortcuts-cheatsheet');
    const inner = dialog.querySelector('h2');
    fireEvent.click(inner!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
