'use client';

import { useId, useState } from 'react';
import { formatPrice } from '@/lib/utils/format-price';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';
import type { CartItem as CartItemData } from '@/lib/schemas';
import { cn } from '@/lib/utils/cn';

interface OrderSummaryAccordionProps {
  items: CartItemData[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  catalogShippingCents?: number;
  freeShipping?: boolean;
}

export function OrderSummaryAccordion({
  items,
  subtotalCents,
  shippingCents,
  totalCents,
  catalogShippingCents,
  freeShipping = false,
}: OrderSummaryAccordionProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section
      aria-labelledby="order-summary-accordion-heading"
      className="border-y border-encre/15 bg-creme"
    >
      <h2 id="order-summary-accordion-heading" className="sr-only">
        Récapitulatif de la commande
      </h2>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-encre"
      >
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-encre/70">
          <ChevronIcon open={open} />
          Voir le récapitulatif
        </span>
        <span className="font-display text-xl text-encre">
          {formatPrice(totalCents)}
        </span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          'border-t border-encre/10 px-5 py-5 motion-safe:transition-all motion-safe:duration-base motion-safe:ease-out-soft',
        )}
      >
        <ul className="space-y-3 pb-4">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="text-encre/80">
                {item.productName}
                <span className="text-encre/50">
                  {' '}× {item.quantity}
                </span>
              </span>
              <span className="text-encre">
                {formatPrice(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-encre/10 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-encre/70">Sous-total</dt>
            <dd className="text-sm text-encre">{formatPrice(subtotalCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-encre/70">Livraison</dt>
            <dd className="text-sm text-encre">
              {freeShipping && catalogShippingCents && catalogShippingCents > 0 ? (
                <ShippingPriceDisplay
                  displayPrice={formatPrice(catalogShippingCents)}
                  freeShipping
                  size="sm"
                  align="right"
                />
              ) : (
                formatPrice(shippingCents)
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('transition-transform duration-base', open && 'rotate-180')}
    >
      <path d="m2 4 3 3 3-3" />
    </svg>
  );
}
