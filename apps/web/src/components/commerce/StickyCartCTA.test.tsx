import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { StickyCartCTA } from './StickyCartCTA';

type ObserverCb = (entries: IntersectionObserverEntry[]) => void;

let lastCb: ObserverCb | null = null;
let mockChatIsOpen = false;

vi.mock('@/components/chat/chat-store', () => ({
  useChatStore: (sel: (s: unknown) => unknown) =>
    sel({ isOpen: mockChatIsOpen }),
}));

beforeEach(() => {
  lastCb = null;
  mockChatIsOpen = false;
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

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
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

  // CHA-244 — Sticky CTA disparaît quand le chat s'ouvre.
  describe('CHA-244 — masquage quand le chat est ouvert', () => {
    it('chat ouvert : data-chat-open=true + aria-hidden=true + data-visible forcé à false', () => {
      mockChatIsOpen = true;
      const { container } = renderCTA();
      // `aria-hidden="true"` exclut l'élément de l'accessibility tree —
      // testing-library ne le retrouve plus via getByRole. On retombe
      // sur une query DOM directe.
      const region = container.querySelector('[aria-label="Achat rapide"]')!;
      expect(region).not.toBeNull();
      expect(region.getAttribute('data-chat-open')).toBe('true');
      expect(region.getAttribute('aria-hidden')).toBe('true');
      expect(region.getAttribute('data-visible')).toBe('false');
    });

    it('chat ouvert : classes Tailwind drive le slide-down (translate-y-full) + opacity-0 + pointer-events-none', () => {
      mockChatIsOpen = true;
      const { container } = renderCTA();
      const region = container.querySelector('[aria-label="Achat rapide"]')!;
      const cls = region.className;
      // Le slide-down est déjà piloté par `data-[visible=false]:translate-y-full`
      // (réutilisé), et l'opacity/pointer-events par `data-[chat-open=true]:`.
      expect(cls).toContain('data-[visible=false]:translate-y-full');
      expect(cls).toContain('data-[chat-open=true]:opacity-0');
      expect(cls).toContain('data-[chat-open=true]:pointer-events-none');
    });

    it('chat fermé : data-chat-open=false (régression)', () => {
      mockChatIsOpen = false;
      renderCTA();
      const region = screen.getByRole('region', { name: /achat rapide/i });
      expect(region.getAttribute('data-chat-open')).toBe('false');
      expect(region.getAttribute('aria-hidden')).toBe('false');
    });
  });
});
