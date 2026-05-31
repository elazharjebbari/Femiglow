'use client';

import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { routes } from '@/lib/routes';
import {
  selectCartCount,
  selectSubtotalCents,
  useCartStore,
} from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/utils/format-price';
import { cn } from '@/lib/utils/cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MiniCartSlideOver() {
  const isOpen = useCartStore((s) => s.isMiniCartOpen);
  const closeMiniCart = useCartStore((s) => s.closeMiniCart);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotalCents);
  const count = useCartStore(selectCartCount);
  const removeItem = useCartStore((s) => s.removeItem);

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMiniCart();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, closeMiniCart]);

  useEffect(() => {
    if (isOpen) return;
    previousFocusRef.current?.focus?.();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        'fixed inset-0 transition-opacity duration-base ease-out-soft motion-reduce:transition-none',
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{ zIndex: 'var(--z-overlay)' }}
    >
      <button
        type="button"
        aria-label="Fermer le panier"
        tabIndex={isOpen ? 0 : -1}
        onClick={closeMiniCart}
        className="absolute inset-0 h-full w-full cursor-default bg-encre/40"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'absolute end-0 top-0 flex h-full w-full max-w-md flex-col bg-creme shadow-xl transition-transform duration-base ease-out-soft motion-reduce:transition-none',
          isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-encre/10 px-6 py-5">
          <Heading as="h2" size="sm" id={titleId}>
            Votre rituel
          </Heading>
          <button
            type="button"
            onClick={closeMiniCart}
            className="text-xs uppercase tracking-[0.18em] text-encre/60 underline-offset-4 hover:text-encre hover:underline"
          >
            Fermer
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {count === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Text size="body" tone="secondary">
                Votre rituel est encore à composer.
              </Text>
            </div>
          ) : (
            <ul className="space-y-5 divide-y divide-encre/10">
              {items.map((item) => (
                <li key={item.productId} className="flex items-start gap-4 pt-5 first:pt-0">
                  <div className="flex-1">
                    <p className="font-display text-lg text-encre">{item.productName}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-encre/60">
                      Quantité {item.quantity}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="mt-2 text-xs uppercase tracking-[0.18em] text-encre/60 underline-offset-4 hover:text-encre hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                  <p className="font-body text-sm text-encre [font-feature-settings:'tnum','lnum']">
                    {formatPrice(item.unitPriceCents * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="space-y-4 border-t border-encre/10 px-6 py-5">
          {count > 0 ? (
            <div className="flex items-baseline justify-between">
              <Text size="body" tone="secondary">
                Sous-total
              </Text>
              <p className="font-display text-xl text-encre [font-feature-settings:'tnum','lnum']">
                {formatPrice(subtotal)}
              </p>
            </div>
          ) : null}
          <Link href={routes.panier} onClick={closeMiniCart} className="block">
            <Button variant="primary" size="lg" fullWidth disabled={count === 0}>
              Revoir le panier
            </Button>
          </Link>
          <button
            type="button"
            onClick={closeMiniCart}
            className="block w-full text-center text-xs uppercase tracking-[0.18em] text-encre/60 underline-offset-4 hover:text-encre hover:underline"
          >
            Continuer le rituel
          </button>
        </footer>
      </div>
    </div>
  );
}
