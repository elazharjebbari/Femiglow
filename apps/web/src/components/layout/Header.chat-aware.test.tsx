/**
 * CHA-244 — Tests `Header` chat-aware.
 *
 * Quand `useChatStore.isOpen === true`, le header sticky doit :
 *   - porter `data-chat-open="true"` (drive l'animation Tailwind)
 *   - être marqué `aria-hidden="true"` (pas focusable pour le chat)
 *   - rester dans le DOM (focus est restauré au close)
 *
 * On stube les enfants (Container, CartButton, SommaireOverlay) — on
 * teste uniquement le contrat chat-aware du wrapper <header>.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

let mockIsOpen = false;

vi.mock('@/components/chat/chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) =>
    sel({ isOpen: mockIsOpen }),
}));

vi.mock('@/components/ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stub-container">{children}</div>
  ),
}));

vi.mock('@/components/commerce/CartButton', () => ({
  CartButton: () => <button data-testid="stub-cart">Cart</button>,
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

beforeEach(() => {
  // jsdom n'implémente pas matchMedia.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

afterEach(() => {
  cleanup();
  mockIsOpen = false;
});

describe('Header chat-aware (CHA-244)', () => {
  it('chat fermé : data-chat-open=false + aria-hidden=false', () => {
    mockIsOpen = false;
    const { container } = render(<Header />);
    const header = container.querySelector('header[role="banner"]')!;
    expect(header.getAttribute('data-chat-open')).toBe('false');
    expect(header.getAttribute('aria-hidden')).toBe('false');
  });

  it('chat ouvert : data-chat-open=true + aria-hidden=true', () => {
    mockIsOpen = true;
    const { container } = render(<Header />);
    const header = container.querySelector('header[role="banner"]')!;
    expect(header.getAttribute('data-chat-open')).toBe('true');
    expect(header.getAttribute('aria-hidden')).toBe('true');
  });

  it('chat ouvert : classes Tailwind drive le slide-up (translate-y-full + opacity-0 + pointer-events-none)', () => {
    mockIsOpen = true;
    const { container } = render(<Header />);
    const header = container.querySelector('header[role="banner"]')!;
    // Les variantes `data-[chat-open=true]:` n'évaluent rien dans jsdom
    // (pas de Tailwind runtime), mais elles DOIVENT apparaître dans le
    // className pour que Tailwind les compile en CSS. Contrat de classes.
    const cls = header.className;
    expect(cls).toContain('data-[chat-open=true]:-translate-y-full');
    expect(cls).toContain('data-[chat-open=true]:opacity-0');
    expect(cls).toContain('data-[chat-open=true]:pointer-events-none');
  });

  it('le header reste DANS le DOM (pas démonté) quand le chat s\'ouvre', () => {
    // Important pour la restauration du focus + éviter le layout shift.
    mockIsOpen = true;
    const { container } = render(<Header />);
    expect(container.querySelector('header[role="banner"]')).not.toBeNull();
    // Logo + bouton sommaire toujours rendus, juste hors-écran via CSS.
    expect(container.querySelector('a[aria-label*="FemiGlow"]')).not.toBeNull();
  });

  it('motion-reduce : translate annulé, mais opacity-0 conservé', () => {
    mockIsOpen = true;
    const { container } = render(<Header />);
    const header = container.querySelector('header[role="banner"]')!;
    const cls = header.className;
    // Fallback motion-reduce : on annule le translate (saccade visuelle)
    // mais on garde l'opacity-0 (le header reste invisible au-dessus).
    expect(cls).toContain('motion-reduce:data-[chat-open=true]:translate-y-0');
  });
});
