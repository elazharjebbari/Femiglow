/**
 * Tests unitaires du wrapper d'éveil paresseux du chat widget.
 *
 * On vérifie que :
 *  1. Le wrapper rend `null` immédiatement (zéro UI tant qu'un trigger
 *     n'est pas tombé).
 *  2. Le trigger `timeout` arrive après `delayMs` quand aucune autre
 *     condition ne se réalise plus tôt.
 *  3. Le trigger `interaction` arme le mount sur scroll / touchstart /
 *     keydown / mousemove.
 *  4. Le trigger `hash` (deep link `#chat`) bypasse tous les délais.
 *  5. Les listeners sont nettoyés à l'unmount (pas de fuite).
 *  6. Plusieurs triggers concurrents ne provoquent qu'un seul mount
 *     (le premier qui arrive gagne).
 *
 * On mocke `next/dynamic` pour rendre le composant chargé de façon
 * synchrone (sinon le `loading=null` de dynamic empêcherait de voir
 * l'UI dans le test).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, cleanup } from '@testing-library/react';

import { ChatWidgetDeferred } from './ChatWidgetDeferred';
import type { ChatWidgetMountTrigger } from './ChatWidgetDeferred';

// next/dynamic — on retourne un composant léger marqueur qui apparaît
// dans le DOM dès que ChatWidgetDeferred a basculé `ready=true`.
vi.mock('next/dynamic', () => ({
  default: () => function MockChatWidget() {
    return <div data-testid="chat-widget-mocked" />;
  },
}));

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn() }),
}));

function setHash(hash: string) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, hash },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setHash('');
  // S'assure que `document.readyState` n'est PAS 'complete' au démarrage,
  // sinon le wrapper enclenche immédiatement via le code de fallback
  // `setTimeout(0)`. JSDOM met readyState à 'complete' par défaut.
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: 'loading',
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ChatWidgetDeferred', () => {
  it('rend null immédiatement (aucun trigger encore)', () => {
    const { queryByTestId } = render(
      <ChatWidgetDeferred delayMs={5000} />,
    );
    expect(queryByTestId('chat-widget-mocked')).toBeNull();
  });

  it('monte le widget après expiration du délai (filet timeout)', () => {
    const onReady = vi.fn();
    const { queryByTestId } = render(
      <ChatWidgetDeferred delayMs={2500} onReady={onReady} />,
    );
    expect(queryByTestId('chat-widget-mocked')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(queryByTestId('chat-widget-mocked')).not.toBeNull();
    expect(onReady).toHaveBeenCalledTimes(1);
    const trigger = onReady.mock.calls[0]?.[0] as ChatWidgetMountTrigger;
    // En env vitest, `requestIdleCallback` n'est pas dispo et `window.load`
    // ne fire pas, donc c'est `timeout` qui gagne.
    expect(['timeout', 'idle', 'load']).toContain(trigger);
  });

  it('monte immédiatement sur première interaction scroll', () => {
    const onReady = vi.fn();
    const { queryByTestId } = render(
      <ChatWidgetDeferred delayMs={10000} onReady={onReady} />,
    );
    expect(queryByTestId('chat-widget-mocked')).toBeNull();
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(queryByTestId('chat-widget-mocked')).not.toBeNull();
    expect(onReady).toHaveBeenCalledWith('interaction', expect.any(Number));
  });

  it('monte immédiatement sur touchstart', () => {
    const onReady = vi.fn();
    const { queryByTestId } = render(
      <ChatWidgetDeferred delayMs={10000} onReady={onReady} />,
    );
    act(() => {
      window.dispatchEvent(new Event('touchstart'));
    });
    expect(queryByTestId('chat-widget-mocked')).not.toBeNull();
    expect(onReady).toHaveBeenCalledWith('interaction', expect.any(Number));
  });

  it('monte immédiatement sur keydown', () => {
    const onReady = vi.fn();
    const { queryByTestId } = render(
      <ChatWidgetDeferred delayMs={10000} onReady={onReady} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    });
    expect(queryByTestId('chat-widget-mocked')).not.toBeNull();
    expect(onReady).toHaveBeenCalledWith('interaction', expect.any(Number));
  });

  it('bypass le délai si #chat dans l\'URL au mount', () => {
    setHash('#chat');
    const onReady = vi.fn();
    const { queryByTestId } = render(
      <ChatWidgetDeferred delayMs={10000} onReady={onReady} />,
    );
    // Pas besoin d'avancer le temps : le bypass est synchrone dans l'effect.
    expect(queryByTestId('chat-widget-mocked')).not.toBeNull();
    expect(onReady).toHaveBeenCalledWith('hash', 0);
  });

  it('un seul mount même si plusieurs triggers concurrents', () => {
    const onReady = vi.fn();
    render(<ChatWidgetDeferred delayMs={1000} onReady={onReady} />);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('touchstart'));
      vi.advanceTimersByTime(2000);
    });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('nettoie les listeners à l\'unmount (pas de mount post-unmount)', () => {
    const onReady = vi.fn();
    const { unmount } = render(
      <ChatWidgetDeferred delayMs={1000} onReady={onReady} />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new Event('scroll'));
    });
    expect(onReady).not.toHaveBeenCalled();
  });
});
