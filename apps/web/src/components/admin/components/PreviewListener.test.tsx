/**
 * RTL — PreviewListener (F4 / P9).
 *
 * Couvre :
 *   - postMessage `PREVIEW_READY` au mount,
 *   - réception de `FIELDS_CHANGED` → `router.refresh()` debounced,
 *   - réception de `SCROLL_TO_FIELD` → scrollIntoView de l'élément cible,
 *   - rejet des messages d'origine étrangère / componentKey différent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

import { PreviewListener } from './PreviewListener';

const COMP = 'home-hero';

beforeEach(() => {
  refresh.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

function postFromSelf(data: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin: window.location.origin }),
  );
}

describe('PreviewListener', () => {
  it('postMessage PREVIEW_READY au parent au mount', () => {
    // Dans jsdom, `window.parent === window` ; on simule une iframe en
    // remplaçant `window.parent` par un objet distinct exposant postMessage.
    const postSpy = vi.fn();
    const originalParent = window.parent;
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => ({ postMessage: postSpy }),
    });
    try {
      render(<PreviewListener componentKey={COMP} />);
      expect(postSpy).toHaveBeenCalledWith(
        { type: 'PREVIEW_READY', componentKey: COMP },
        window.location.origin,
      );
    } finally {
      Object.defineProperty(window, 'parent', {
        configurable: true,
        get: () => originalParent,
      });
    }
  });

  it('appelle router.refresh() debounced sur FIELDS_CHANGED', async () => {
    vi.useFakeTimers();
    render(<PreviewListener componentKey={COMP} />);
    act(() => {
      postFromSelf({ type: 'FIELDS_CHANGED', componentKey: COMP });
    });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('coalesce plusieurs FIELDS_CHANGED rapprochés en un seul refresh', async () => {
    vi.useFakeTimers();
    render(<PreviewListener componentKey={COMP} />);
    act(() => {
      postFromSelf({ type: 'FIELDS_CHANGED', componentKey: COMP });
      postFromSelf({ type: 'FIELDS_CHANGED', componentKey: COMP });
      postFromSelf({ type: 'FIELDS_CHANGED', componentKey: COMP });
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignore les messages avec un componentKey différent', async () => {
    vi.useFakeTimers();
    render(<PreviewListener componentKey={COMP} />);
    act(() => {
      postFromSelf({ type: 'FIELDS_CHANGED', componentKey: 'other' });
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignore les messages d\'origine étrangère', async () => {
    vi.useFakeTimers();
    render(<PreviewListener componentKey={COMP} />);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'FIELDS_CHANGED', componentKey: COMP },
          origin: 'https://evil.example.com',
        }),
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('SCROLL_TO_FIELD scrollIntoView l\'élément data-field-key correspondant', () => {
    const target = document.createElement('div');
    target.setAttribute('data-field-key', 'title');
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    render(<PreviewListener componentKey={COMP} />);
    act(() => {
      postFromSelf({
        type: 'SCROLL_TO_FIELD',
        componentKey: COMP,
        fieldKey: 'title',
      });
    });
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    document.body.removeChild(target);
  });
});
