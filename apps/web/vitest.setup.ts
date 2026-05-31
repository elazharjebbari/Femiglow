import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

import { clearAnalyticsCache } from './src/lib/analytics/cache';

// jsdom n'implémente pas ResizeObserver — utilisé par cmdk (CommandPalette M5.1).
if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe() {
      /* no-op */
    }
    unobserve() {
      /* no-op */
    }
    disconnect() {
      /* no-op */
    }
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

// jsdom n'implémente pas Element.scrollIntoView — appelé par cmdk pour
// keeper l'item sélectionné visible. No-op suffit en test.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {
    /* no-op */
  };
}

// jsdom n'implémente pas Blob.prototype.text / arrayBuffer — polyfill simple
// pour permettre aux composants qui font `await file.text()` de fonctionner
// dans les tests (ValidatePairWizard, etc.).
if (typeof globalThis.Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function () {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this as Blob);
    });
  };
}

process.env.ADMIN_SESSION_PASSWORD = process.env.ADMIN_SESSION_PASSWORD ?? 'a'.repeat(32);
process.env.WEBHOOK_SECRET_KEY = process.env.WEBHOOK_SECRET_KEY ?? 'b'.repeat(32);
process.env.CRON_SECRET = process.env.CRON_SECRET ?? 'c'.repeat(32);

afterEach(() => {
  cleanup();
  clearAnalyticsCache(); // évite la pollution inter-tests (cache long-window par défaut)
});

vi.mock('next/font/google', () => ({
  Cormorant_Garamond: () => ({ variable: '--font-cormorant', className: '' }),
  Inter: () => ({ variable: '--font-inter', className: '' }),
  Pinyon_Script: () => ({ variable: '--font-pinyon', className: '' }),
}));

// Mock minimal de `useRouter` pour les tests RTL : sans contexte App Router
// monté, `next/navigation`'s `useRouter()` lève « invariant expected app
// router to be mounted ». Les composants client (`AddToCartButton`, etc.)
// utilisent uniquement `router.push` en réaction à un onClick — un stub
// suffit. Les tests qui veulent observer la navigation peuvent re-mocker
// localement avec `vi.mock('next/navigation', …)`.
vi.mock('next/navigation', async () => {
  const actual =
    await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      push: () => {},
      replace: () => {},
      refresh: () => {},
      back: () => {},
      forward: () => {},
      prefetch: () => {},
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  };
});

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  class MockIntersectionObserver {
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
  // @ts-expect-error mock
  window.IntersectionObserver = MockIntersectionObserver;
}
