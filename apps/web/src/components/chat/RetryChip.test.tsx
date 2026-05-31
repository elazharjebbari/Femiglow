/**
 * CHA-230 Phase 2 — Tests RetryChip.
 *
 * Vérifie le contrat clé du composant : conditions d'affichage,
 * delegation au hook `useChatSend`, locale FR/AR/AR-MA.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { RetryChip } from './RetryChip';
import { useChatStore } from './chat-store';

// On mock `useChatSend` pour observer les appels `send()` sans dépendre
// du fetch / SSE réseau.
const sendMock = vi.fn();
vi.mock('./hooks/use-chat-send', () => ({
  useChatSend: () => ({ send: sendMock, cancel: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  sendMock.mockClear();
  // Reset complet du store entre tests.
  useChatStore.getState().reset();
});

describe('RetryChip', () => {
  it("ne rend rien quand error est null", () => {
    render(<RetryChip />);
    expect(screen.queryByTestId('chat-retry-chip')).toBeNull();
  });

  it("ne rend rien quand error.retryable est false", () => {
    useChatStore.getState().setError({
      code: 'auth',
      message: 'auth failed',
      retryable: false,
      lastUserText: 'Bonjour',
    });
    render(<RetryChip />);
    expect(screen.queryByTestId('chat-retry-chip')).toBeNull();
  });

  it("ne rend rien quand lastUserText est null (rien à réenvoyer)", () => {
    useChatStore.getState().setError({
      code: 'session-load-failed',
      message: 'fail',
      retryable: true,
      lastUserText: null,
    });
    render(<RetryChip />);
    expect(screen.queryByTestId('chat-retry-chip')).toBeNull();
  });

  it("ne rend rien pendant un stream actif", () => {
    useChatStore.getState().setError({
      code: 'timeout',
      message: 'tmo',
      retryable: true,
      lastUserText: 'Bonjour',
    });
    // Simule un stream en cours.
    useChatStore.setState({ isStreaming: true });
    render(<RetryChip />);
    expect(screen.queryByTestId('chat-retry-chip')).toBeNull();
  });

  it("rend le chip quand retryable=true + lastUserText présent + pas de stream", () => {
    useChatStore.getState().setError({
      code: 'timeout',
      message: 'Délai dépassé',
      retryable: true,
      lastUserText: 'Bonjour',
    });
    render(<RetryChip />);
    expect(screen.getByTestId('chat-retry-chip')).toBeInTheDocument();
  });

  it("au clic : clear l'erreur et appelle send avec le lastUserText", () => {
    useChatStore.getState().setError({
      code: 'timeout',
      message: 'Délai dépassé',
      retryable: true,
      lastUserText: 'Salut FemiGlow',
    });
    render(<RetryChip />);
    fireEvent.click(screen.getByTestId('chat-retry-chip'));
    // L'erreur doit être effacée immédiatement (UX fluide).
    expect(useChatStore.getState().error).toBeNull();
    // send() doit avoir reçu exactement le texte original.
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('Salut FemiGlow');
  });

  it("affiche le label FR par défaut", () => {
    useChatStore.getState().setError({
      code: 'timeout',
      message: null,
      retryable: true,
      lastUserText: 'Bonjour',
    });
    render(<RetryChip />);
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  it("affiche le label AR quand language='ar'", () => {
    useChatStore.setState({ language: 'ar' });
    useChatStore.getState().setError({
      code: 'timeout',
      message: null,
      retryable: true,
      lastUserText: 'مرحبا',
    });
    render(<RetryChip />);
    expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument();
  });

  it("affiche le label AR-MA (Darija) quand language='ar-MA'", () => {
    useChatStore.setState({ language: 'ar-MA' });
    useChatStore.getState().setError({
      code: 'timeout',
      message: null,
      retryable: true,
      lastUserText: 'salam',
    });
    render(<RetryChip />);
    expect(screen.getByText('عاود')).toBeInTheDocument();
  });

  it("applique dir=rtl pour les locales arabes", () => {
    useChatStore.setState({ language: 'ar' });
    useChatStore.getState().setError({
      code: 'timeout',
      message: null,
      retryable: true,
      lastUserText: 'مرحبا',
    });
    render(<RetryChip />);
    expect(screen.getByTestId('chat-retry-chip-wrap')).toHaveAttribute('dir', 'rtl');
  });
});
