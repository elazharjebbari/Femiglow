/**
 * Tests `ChatLauncher` — comportement mobile UX (panel ouvert).
 *
 * Verrouille la décision Solution D §2.2 F3 : en mobile, quand le panel
 * est ouvert, le FAB doit être caché (`hidden`) pour ne pas recouvrir
 * la sheet `inset-0`. En desktop (`sm:flex`), le FAB reste affiché.
 *
 * Le fichier `ChatLauncher.test.tsx` (existant) couvre la régression
 * de POSITIONNEMENT (sticky `/kit`) — on ne le touche pas.
 *
 * cf. docs/chat-assistant/21-mobile-ux-plan.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

// Mocks DOIVENT être déclarés AVANT l'import de ChatLauncher pour que
// Vitest hoiste correctement et substitue les modules.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn() }),
}));

let mockedIsOpen = false;

vi.mock('./chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) =>
    sel({
      isOpen: mockedIsOpen,
      language: 'fr',
      toggle: vi.fn(),
      sessionId: 's1',
      messages: [],
    }),
}));

import { ChatLauncher } from './ChatLauncher';

beforeEach(() => {
  mockedIsOpen = false;
});

afterEach(() => {
  cleanup();
});

describe('ChatLauncher (mobile UX — visibilité conditionnelle)', () => {
  it('panel FERMÉ : FAB visible (flex), pas de classe hidden', () => {
    mockedIsOpen = false;
    const { container } = render(<ChatLauncher />);
    const button = container.querySelector('[data-testid="chat-launcher"]')!;
    expect(button.className).toContain('flex');
    expect(button.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it('panel OUVERT : FAB caché en mobile (hidden) mais affiché en desktop (sm:flex)', () => {
    mockedIsOpen = true;
    const { container } = render(<ChatLauncher />);
    const button = container.querySelector('[data-testid="chat-launcher"]')!;
    // Combo critique : `hidden` (mobile) + `sm:flex` (desktop).
    expect(button.className).toContain('hidden');
    expect(button.className).toContain('sm:flex');
  });

  it("aria-expanded reflète l'état du store", () => {
    mockedIsOpen = true;
    const { container } = render(<ChatLauncher />);
    const button = container.querySelector('[data-testid="chat-launcher"]')!;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toMatch(/fermer/i);
  });
});
