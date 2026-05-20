/**
 * Tests `NarrativeIntro` — IntersectionObserver + tracking.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));

import { NarrativeIntro } from './NarrativeIntro';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observeMock: ReturnType<typeof vi.fn>;
let disconnectMock: ReturnType<typeof vi.fn>;
let observerCallback: ObserverCallback | null = null;

beforeEach(() => {
  emitMock.mockReset();
  observeMock = vi.fn();
  disconnectMock = vi.fn();
  observerCallback = null;
  (globalThis as any).IntersectionObserver = vi.fn(function (
    this: any,
    cb: ObserverCallback,
    _opts: unknown,
  ) {
    observerCallback = cb;
    this.observe = observeMock;
    this.disconnect = disconnectMock;
    this.unobserve = vi.fn();
  });
});

afterEach(() => {
  cleanup();
  delete (globalThis as any).IntersectionObserver;
});

describe('NarrativeIntro — rendu', () => {
  it('rend le texte en italique Cormorant', () => {
    render(<NarrativeIntro text="12 % de cire d’abeille." subProductId="1-paste" />);
    const el = screen.getByTestId('composition-narrative-1-paste');
    expect(el.textContent).toBe('12 % de cire d’abeille.');
    expect(el.className).toMatch(/italic/);
    expect(el.className).toMatch(/font-display/);
  });

  it('IntersectionObserver attaché au mount', () => {
    render(<NarrativeIntro text="…" subProductId="1-paste" />);
    expect(observeMock).toHaveBeenCalledTimes(1);
  });
});

describe('NarrativeIntro — tracking', () => {
  it('émet composition_narrative_view au franchissement seuil', () => {
    render(<NarrativeIntro text="…" subProductId="1-paste" />);
    observerCallback?.([{ isIntersecting: true }]);
    expect(emitMock).toHaveBeenCalledWith('composition_narrative_view', {
      sub_product_id: '1-paste',
    });
  });

  it('émit UNE SEULE fois même si le seuil est re-franchi', () => {
    render(<NarrativeIntro text="…" subProductId="1-paste" />);
    observerCallback?.([{ isIntersecting: true }]);
    observerCallback?.([{ isIntersecting: false }]);
    observerCallback?.([{ isIntersecting: true }]);
    expect(emitMock).toHaveBeenCalledTimes(1);
  });

  it('n\'émet pas si l\'élément n\'est jamais visible', () => {
    render(<NarrativeIntro text="…" subProductId="1-paste" />);
    observerCallback?.([{ isIntersecting: false }]);
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe('NarrativeIntro — cleanup', () => {
  it('disconnect au unmount', () => {
    const { unmount } = render(<NarrativeIntro text="…" subProductId="1-paste" />);
    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('disconnect après première émission', () => {
    render(<NarrativeIntro text="…" subProductId="1-paste" />);
    observerCallback?.([{ isIntersecting: true }]);
    expect(disconnectMock).toHaveBeenCalled();
  });
});
