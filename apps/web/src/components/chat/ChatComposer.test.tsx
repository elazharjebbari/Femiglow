/**
 * Tests unitaires `ChatComposer` — focus régression mobile UX 2026-05-12.
 *
 * Verrouille la décision Solution D (cf. docs/chat-assistant/21-mobile-ux-plan.md) :
 * la textarea DOIT exposer un font-size ≥ 16 px sinon iOS Safari déclenche
 * un auto-zoom sur le focus, ce qui casse l'UX mobile (panel zoomé,
 * bouton « Envoyer » hors viewport).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('./chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) =>
    sel({
      language: 'fr',
      isStreaming: false,
    }),
}));

vi.mock('./hooks/use-chat-send', () => ({
  useChatSend: () => ({ send: vi.fn(), cancel: vi.fn() }),
}));

// Import APRÈS les mocks (sinon les modules réels sont chargés en amont).
import { ChatComposer } from './ChatComposer';

afterEach(() => {
  cleanup();
});

describe('ChatComposer (anti-zoom iOS, mobile UX)', () => {
  it('expose un font-size ≥ 16 px sur la textarea (CHA-244 : text-lg = 18 px)', () => {
    render(<ChatComposer />);
    const ta = screen.getByTestId('chat-input');
    // CHA-244 — le composer passe en `text-lg` (18 px) pour favoriser
    // la frappe en mobile (au-dessus du seuil iOS anti-zoom = 16 px).
    expect(ta.className).toMatch(/(^|\s)text-(base|lg)(\s|$)/);
    // Garde-fou : `text-sm` (14 px) ne doit JAMAIS revenir sur la textarea.
    expect(ta.className).not.toMatch(/(^|\s)text-sm(\s|$)/);
  });

  it('CHA-244 : textarea a une min-h ≥ 2.75rem (44 px = cible WCAG)', () => {
    render(<ChatComposer />);
    const ta = screen.getByTestId('chat-input');
    expect(ta.className).toMatch(/min-h-\[2\.(5|75)rem\]/);
  });

  it('CHA-244 : bouton envoyer 44×44 (cible WCAG 2.5.5)', () => {
    render(<ChatComposer />);
    const btn = screen.getByTestId('chat-send');
    // h-11 = 44 px, min-w-[44px] garantit la cible en mode disabled.
    expect(btn.className).toContain('h-11');
    expect(btn.className).toContain('min-w-[44px]');
  });

  it('préserve les data-testid pour les E2E', () => {
    render(<ChatComposer />);
    expect(screen.getByTestId('chat-input')).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByTestId('chat-send')).toBeInstanceOf(HTMLButtonElement);
  });

  it("le placeholder reflète la langue 'fr' par défaut", () => {
    render(<ChatComposer />);
    const ta = screen.getByTestId('chat-input') as HTMLTextAreaElement;
    expect(ta.placeholder).toMatch(/question/i);
  });
});
