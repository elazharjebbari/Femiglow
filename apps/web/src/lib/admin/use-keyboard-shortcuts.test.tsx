import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts, type KeyboardShortcut } from './use-keyboard-shortcuts';

function Harness({ shortcuts }: { shortcuts: KeyboardShortcut[] }) {
  useKeyboardShortcuts(shortcuts);
  return (
    <div>
      <input data-testid="my-input" />
      <textarea data-testid="my-textarea" />
    </div>
  );
}

afterEach(() => cleanup());

describe('useKeyboardShortcuts', () => {
  it('déclenche le handler quand la touche correspond', () => {
    const onJ = vi.fn();
    render(<Harness shortcuts={[{ key: 'j', description: 'next', handler: onJ }]} />);
    fireEvent.keyDown(window, { key: 'j' });
    expect(onJ).toHaveBeenCalledTimes(1);
  });

  it("ignore le raccourci si focus sur un <input>", () => {
    const onJ = vi.fn();
    const { getByTestId } = render(
      <Harness shortcuts={[{ key: 'j', description: 'next', handler: onJ }]} />,
    );
    const input = getByTestId('my-input');
    (input as HTMLInputElement).focus();
    fireEvent.keyDown(input, { key: 'j' });
    expect(onJ).not.toHaveBeenCalled();
  });

  it('respecte evenInInput=true', () => {
    const onEsc = vi.fn();
    const { getByTestId } = render(
      <Harness
        shortcuts={[{ key: 'Escape', description: 'close', evenInInput: true, handler: onEsc }]}
      />,
    );
    const input = getByTestId('my-input');
    (input as HTMLInputElement).focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onEsc).toHaveBeenCalled();
  });

  it("ignore les raccourcis désactivés (enabled=false)", () => {
    const onA = vi.fn();
    render(
      <Harness shortcuts={[{ key: 'a', description: 'approve', enabled: false, handler: onA }]} />,
    );
    fireEvent.keyDown(window, { key: 'a' });
    expect(onA).not.toHaveBeenCalled();
  });

  it('ignore les touches combinées avec Ctrl/Cmd/Alt', () => {
    const onJ = vi.fn();
    render(<Harness shortcuts={[{ key: 'j', description: 'x', handler: onJ }]} />);
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'j', metaKey: true });
    fireEvent.keyDown(window, { key: 'j', altKey: true });
    expect(onJ).not.toHaveBeenCalled();
  });

  it('insensible à la casse', () => {
    const onA = vi.fn();
    render(<Harness shortcuts={[{ key: 'a', description: 'approve', handler: onA }]} />);
    fireEvent.keyDown(window, { key: 'A' });
    expect(onA).toHaveBeenCalled();
  });
});
