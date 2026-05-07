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
