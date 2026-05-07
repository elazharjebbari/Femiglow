import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StickyCartCTA } from './StickyCartCTA';

type ObserverCb = (entries: IntersectionObserverEntry[]) => void;

let lastCb: ObserverCb | null = null;

beforeEach(() => {
  lastCb = null;
  class Observer {
    constructor(cb: ObserverCb) {
      lastCb = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  vi.stubGlobal('IntersectionObserver', Observer);
});

function renderCTA() {
  document.body.innerHTML = '<div id="sentinel"></div>';
  return render(
    <StickyCartCTA
      productName="Le rituel"
      priceCents={32000}
      currency="MAD"
      observeId="sentinel"
    >
      <button type="button">Ajouter</button>
    </StickyCartCTA>,
  );
}

describe('StickyCartCTA', () => {
  it('rend en région Achat rapide masquée tant que le sentinel est visible', () => {
    renderCTA();
    const region = screen.getByRole('region', { name: /achat rapide/i });
    expect(region).toHaveAttribute('data-visible', 'false');
  });

  it('passe data-visible à true quand le sentinel sort du viewport', () => {
    renderCTA();
    const region = screen.getByRole('region', { name: /achat rapide/i });
    expect(lastCb).not.toBeNull();
    act(() => {
      lastCb!([{ isIntersecting: false } as IntersectionObserverEntry]);
    });
    expect(region).toHaveAttribute('data-visible', 'true');
  });

  it('rend les enfants (CTA embarqué)', () => {
    renderCTA();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });
});
