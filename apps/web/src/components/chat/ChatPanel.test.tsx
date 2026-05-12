/**
 * Tests unitaires `ChatPanel` — verrouille le refactor responsive
 * Solution D (cf. docs/chat-assistant/21-mobile-ux-plan.md §2.2 F2).
 *
 * Mobile  : sheet full-screen (`inset-0 h-[100dvh]`) + safe-area + drag-handle.
 * Desktop : bubble bas-droite 380×560 inchangée (régression nulle).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

vi.mock('./chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) =>
    sel({
      isOpen: true,
      language: 'fr',
      close: vi.fn(),
    }),
}));

vi.mock('./hooks/use-chat-session', () => ({
  useChatSession: () => {},
}));

// On stube les enfants — on teste seulement la structure du wrapper.
vi.mock('./ChatComposer', () => ({
  ChatComposer: () => <div data-testid="stub-composer" />,
}));
vi.mock('./ChatHeader', () => ({
  ChatHeader: () => <div data-testid="stub-header" />,
}));
vi.mock('./MessageList', () => ({
  MessageList: () => <div data-testid="stub-messages" />,
}));

import { ChatPanel } from './ChatPanel';

afterEach(() => {
  cleanup();
});

describe('ChatPanel (sheet responsive — solution D)', () => {
  it('mobile (base) : inset-0 + h-[100dvh] + overscroll-contain + safe-area', () => {
    const { container } = render(<ChatPanel />);
    const panel = container.querySelector('[data-testid="chat-panel"]');
    expect(panel).not.toBeNull();
    const cls = panel!.className;
    expect(cls).toContain('inset-0');
    expect(cls).toContain('h-[100dvh]');
    expect(cls).toContain('overscroll-contain');
    expect(cls).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('desktop (sm+) : bottom-28 + w-[380px] + rounded-2xl + inset-auto', () => {
    const { container } = render(<ChatPanel />);
    const panel = container.querySelector('[data-testid="chat-panel"]')!;
    const cls = panel.className;
    expect(cls).toContain('sm:bottom-28');
    expect(cls).toContain('sm:w-[380px]');
    expect(cls).toContain('sm:rounded-2xl');
    // `sm:inset-auto` est CRITIQUE : sans lui, `inset-0` (mobile) resterait
    // actif en desktop et casserait le bubble bas-droite.
    expect(cls).toContain('sm:inset-auto');
    expect(cls).toContain('sm:h-auto');
  });

  it('drag-handle visuel mobile-only présent dans le DOM', () => {
    const { container } = render(<ChatPanel />);
    const handle = container.querySelector('[data-testid="chat-panel-drag-handle"]');
    expect(handle).not.toBeNull();
    // sm:hidden = visible en mobile, hidden en desktop.
    expect(handle!.className).toContain('sm:hidden');
    expect(handle!.getAttribute('aria-hidden')).toBe('true');
  });

  it('rend les 3 sous-composants (header, messages, composer)', () => {
    const { container } = render(<ChatPanel />);
    expect(container.querySelector('[data-testid="stub-header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stub-messages"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stub-composer"]')).not.toBeNull();
  });

  it('panel ouvert : role="dialog" + aria-label présent', () => {
    const { container } = render(<ChatPanel />);
    const panel = container.querySelector('[data-testid="chat-panel"]')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-label')).toMatch(/FemiGlow|chat|assistant/i);
  });
});
