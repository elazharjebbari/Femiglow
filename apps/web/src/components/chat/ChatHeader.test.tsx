/**
 * CHA-244 — Tests `ChatHeader`.
 *
 * Bouton fermer : 44×44 (cible WCAG 2.5.5 AAA), aria-label + label
 * texte visible « Fermer », icône chevron-down.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

const close = vi.fn();

vi.mock('./chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) => sel({ close }),
}));

import { ChatHeader } from './ChatHeader';

afterEach(() => {
  cleanup();
  close.mockClear();
});

describe('ChatHeader (CHA-244)', () => {
  it('rend le bouton fermer avec label texte VISIBLE « Fermer »', () => {
    render(<ChatHeader />);
    const btn = screen.getByTestId('chat-close');
    // Le label texte est rendu en plus de l'aria-label, dans un <span>.
    expect(btn.textContent).toMatch(/Fermer/);
    expect(btn.getAttribute('aria-label')).toMatch(/Fermer/i);
  });

  it('cible tactile 44×44 (h-11 + min-w-[44px])', () => {
    render(<ChatHeader />);
    const btn = screen.getByTestId('chat-close');
    expect(btn.className).toContain('h-11');
    expect(btn.className).toContain('min-w-[44px]');
  });

  it('clique sur le bouton → appelle close()', () => {
    render(<ChatHeader />);
    fireEvent.click(screen.getByTestId('chat-close'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('icône chevron-down présente (idiome bottom-sheet)', () => {
    const { container } = render(<ChatHeader />);
    const svg = container.querySelector('[data-testid="chat-close"] svg');
    expect(svg).not.toBeNull();
    // Path du chevron-down : `M6 9l6 6 6-6`.
    const path = svg!.querySelector('path');
    expect(path?.getAttribute('d')).toContain('6 9');
  });
});
