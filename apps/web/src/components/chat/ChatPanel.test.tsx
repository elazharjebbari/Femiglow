/**
 * Tests unitaires `ChatPanel` — verrouille le refactor responsive
 * Solution D (cf. docs/chat-assistant/21-mobile-ux-plan.md §2.2 F2).
 *
 * Mobile  : sheet full-screen (`inset-0 h-[100dvh]`) + safe-area + drag-handle.
 * Desktop : bubble bas-droite 380×560 inchangée (régression nulle).
 *
 * CHA-244 — Ajoute le contrat z-index overlay (au-dessus du Header /
 * sticky CTA), le body scroll lock + restauration, et `data-chat-scope`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

let mockIsOpen = true;
let mockClose = vi.fn();

vi.mock('./chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) =>
    sel({
      isOpen: mockIsOpen,
      language: 'fr',
      close: mockClose,
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

beforeEach(() => {
  mockIsOpen = true;
  mockClose = vi.fn();
  document.body.style.overflow = '';
  // jsdom n'implémente pas `window.scrollTo` — on le remplace directement
  // par un noop pour éviter le bruit dans la sortie des tests qui ne
  // ciblent pas cette restauration (le test dédié pose son propre spy).
  Object.defineProperty(window, 'scrollTo', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('ChatPanel (sheet responsive — solution D)', () => {
  it('mobile (base) : inset-0 + h-[100dvh] + overscroll-contain + safe-area', () => {
    const { container } = render(<ChatPanel />);
    const panel = container.querySelector('[data-testid="chat-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    const cls = panel.className;
    expect(cls).toContain('inset-0');
    expect(cls).toContain('h-[100dvh]');
    expect(cls).toContain('overscroll-contain');
    // CHA-mobile-focus — Le `pb-[env(safe-area-inset-bottom)]` Tailwind a été
    // remplacé par un `style.paddingBottom = max(safe-area, --chat-keyboard-inset)`
    // pour pousser le composer au-dessus du clavier mobile iOS quand
    // `visualViewport` change. Le `env(safe-area-inset-bottom)` reste donc
    // garanti par fallback CSS max().
    expect(panel.style.paddingBottom).toContain('env(safe-area-inset-bottom)');
    expect(panel.style.paddingBottom).toContain('--chat-keyboard-inset');
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

  // CHA-244 — contrats supplémentaires.
  describe('CHA-244 — overlay au-dessus de Header + sticky CTA', () => {
    it('porte un z-index `--z-chat-overlay` (250) via style inline', () => {
      const { container } = render(<ChatPanel />);
      const panel = container.querySelector<HTMLElement>('[data-testid="chat-panel"]')!;
      // Le style inline est la source de vérité du z-index. On vérifie
      // que la variable CSS dédiée est bien utilisée — pas un `z-40`
      // hardcodé.
      expect(panel.style.zIndex).toBe('var(--z-chat-overlay)');
      // Aucune classe Tailwind `z-…` ne doit subsister sur le panel
      // (sinon elle écraserait/conflituerait le style inline).
      expect(panel.className).not.toMatch(/\bz-\d+\b/);
    });

    it('expose `data-chat-scope` pour scoper les styles internes', () => {
      const { container } = render(<ChatPanel />);
      const panel = container.querySelector<HTMLElement>('[data-testid="chat-panel"]')!;
      expect(panel.getAttribute('data-chat-scope')).not.toBeNull();
    });
  });

  describe('CHA-244 — body scroll lock + restauration', () => {
    it('verrouille `body.overflow=hidden` à l\'ouverture', () => {
      render(<ChatPanel />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restaure l\'overflow d\'origine au démontage / fermeture', async () => {
      document.body.style.overflow = 'visible';
      const { unmount } = render(<ChatPanel />);
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('visible');
    });

    it('sauvegarde et restaure `window.scrollY` au démontage', async () => {
      // On remplace scrollTo par un spy dédié pour ce test (le noop
      // posé dans beforeEach n'aurait pas conservé l'appel).
      const scrollSpy = vi.fn();
      Object.defineProperty(window, 'scrollTo', {
        value: scrollSpy,
        writable: true,
        configurable: true,
      });
      // requestAnimationFrame synchronously dans jsdom — on l'aide.
      const rafSpy = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((cb) => {
          cb(0);
          return 0 as unknown as number;
        });
      Object.defineProperty(window, 'scrollY', { value: 420, writable: true });
      const { unmount } = render(<ChatPanel />);
      act(() => {
        unmount();
      });
      expect(scrollSpy).toHaveBeenCalledWith(0, 420);
      rafSpy.mockRestore();
    });
  });

  describe('CHA-244 — panel fermé', () => {
    it('ne rend rien si `isOpen=false` et ne touche pas au body', () => {
      mockIsOpen = false;
      document.body.style.overflow = 'visible';
      const { container } = render(<ChatPanel />);
      expect(container.querySelector('[data-testid="chat-panel"]')).toBeNull();
      expect(document.body.style.overflow).toBe('visible');
    });
  });
});
