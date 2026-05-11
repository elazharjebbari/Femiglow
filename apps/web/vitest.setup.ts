import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

process.env.ADMIN_SESSION_PASSWORD = process.env.ADMIN_SESSION_PASSWORD ?? 'a'.repeat(32);
process.env.WEBHOOK_SECRET_KEY = process.env.WEBHOOK_SECRET_KEY ?? 'b'.repeat(32);
process.env.CRON_SECRET = process.env.CRON_SECRET ?? 'c'.repeat(32);

afterEach(() => {
  cleanup();
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
