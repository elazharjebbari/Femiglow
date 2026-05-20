'use client';

import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Container';
import { routes } from '@/lib/routes';

interface CheckoutHeaderProps {
  onLeaveClick?: () => void;
}

export function CheckoutHeader({ onLeaveClick }: CheckoutHeaderProps) {
  return (
    <header
      role="banner"
      className="border-b border-encre/10 bg-creme"
    >
      <Container width="page">
        <div className="flex h-14 items-center justify-between gap-4 sm:h-16">
          {onLeaveClick ? (
            <button
              type="button"
              onClick={onLeaveClick}
              className="-mx-2 rounded-none px-2 py-1 transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-encre"
              aria-label="Quitter la commande"
            >
              <Logo size="sm" asLink={false} />
            </button>
          ) : (
            <Logo size="sm" />
          )}

          <div
            className="hidden items-center gap-2 text-xs uppercase tracking-[0.18em] text-encre/70 sm:flex"
            aria-label="Paiement à la livraison"
          >
            <HandCoinIcon />
            <span>Paiement à la livraison</span>
          </div>

          <Link
            href={routes.panier}
            className="text-xs uppercase tracking-[0.18em] text-encre/70 transition-colors hover:text-encre"
          >
            <span aria-hidden="true">←</span>
            <span className="ml-2 hidden sm:inline">Retour au panier</span>
            <span className="ml-2 sm:hidden">Panier</span>
          </Link>
        </div>
      </Container>
    </header>
  );
}

function HandCoinIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 17v-4a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 8 13v1" />
      <path d="M8 16v-6a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 11 10v1" />
      <path d="M11 14v-4a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 14 10v3" />
      <path d="M14 11v-1a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 17 10v6" />
      <path d="M5 17a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6" />
      <circle cx="12" cy="4" r="2" />
    </svg>
  );
}
