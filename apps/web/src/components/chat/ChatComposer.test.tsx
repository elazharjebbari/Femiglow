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
  it('expose un font-size ≥ 16 px sur la textarea (classe text-base)', () => {
    render(<ChatComposer />);
    const ta = screen.getByTestId('chat-input');
    expect(ta.className).toContain('text-base');
    // Garde-fou : `text-sm` (14 px) ne doit JAMAIS revenir sur la textarea.
    expect(ta.className).not.toMatch(/(^|\s)text-sm(\s|$)/);
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
