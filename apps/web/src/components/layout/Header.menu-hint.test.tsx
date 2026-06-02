/**
 * Tests du gating de l'indice menu (« ↑ Voir le pack ci-dessous ») par le
 * flag admin `menuHintEnabled`, passé en prop au `Header`.
 *
 *  - prop absente / false → l'indice ne s'arme jamais (même après le délai).
 *  - prop true → l'indice apparaît après `HINT_DELAY_MS`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

vi.mock('@/components/chat/chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) => sel({ isOpen: false }),
}));

vi.mock('@/components/ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stub-container">{children}</div>
  ),
}));

vi.mock('@/components/i18n/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="stub-locale-switcher" />,
}));

vi.mock('./SommaireOverlay', () => ({
  SommaireOverlay: ({ open }: { open: boolean }) => (
    <div data-testid="stub-sommaire" data-open={open} />
  ),
}));

import { Header } from './Header';

const HINT_TEXT = 'Voir le pack ci-dessous';

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false, // prefers-reduced-motion: no
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('Header — gating de l\'indice menu', () => {
  it('flag OFF (défaut) : l\'indice ne s\'affiche jamais, même après 8 s', () => {
    const { container } = render(<Header />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(container.textContent).not.toContain(HINT_TEXT);
  });

  it('flag ON : l\'indice apparaît après le délai', () => {
    const { container } = render(<Header menuHintEnabled />);
    // Avant le délai : rien.
    expect(container.textContent).not.toContain(HINT_TEXT);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(container.textContent).toContain(HINT_TEXT);
  });
});
