import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useMediaInView } from './useMediaInView';

let observers: MockIO[] = [];

class MockIO implements IntersectionObserver {
  root: Element | Document | null = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
  observed: Element[] = [];
  cb: IntersectionObserverCallback;
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    observers.push(this);
  }
  observe(t: Element) {
    this.observed.push(t);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function Probe({ onView }: { onView: (v: boolean) => void }) {
  const { ref, inView } = useMediaInView<HTMLDivElement>();
  onView(inView);
  return <div ref={ref} data-testid="probe" />;
}

describe('useMediaInView', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('observe le node monté et passe inView=true sur intersect', () => {
    const states: boolean[] = [];
    render(<Probe onView={(v) => states.push(v)} />);
    expect(observers).toHaveLength(1);
    expect(states[0]).toBe(false);
    act(() => {
      observers[0]!.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observers[0] as unknown as IntersectionObserver,
      );
    });
    expect(states[states.length - 1]).toBe(true);
    expect(observers[0]!.disconnected).toBe(true);
  });
});
