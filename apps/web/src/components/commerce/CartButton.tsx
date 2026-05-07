'use client';

import Link from 'next/link';
import { useCartStore, selectCartCount } from '@/lib/stores/cart-store';

export function CartButton() {
  const count = useCartStore(selectCartCount);
  const hydrated = useCartStore((s) => s.hydrated);
  const display = hydrated ? count : 0;
  const ariaLabel = `Panier${display > 0 ? `, ${display} article${display > 1 ? 's' : ''}` : ', vide'}`;

  return (
    <Link
      href="/panier"
      aria-label={ariaLabel}
      className="group inline-flex h-11 w-11 items-center justify-center text-encre transition-colors hover:bg-encre/5 md:h-11 md:w-auto md:gap-2 md:px-3 md:text-sm md:uppercase md:tracking-[0.18em]"
    >
      <span className="relative md:hidden" aria-hidden="true">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
        {display > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-encre" />
        )}
      </span>
      <span className="hidden md:inline">Panier</span>
      <span
        aria-hidden="true"
        className="hidden h-6 min-w-6 items-center justify-center rounded-full bg-encre px-1.5 text-[11px] text-creme md:inline-flex"
      >
        {display}
      </span>
    </Link>
  );
}
