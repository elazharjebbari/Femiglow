'use client';

import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { formatPrice } from '@/lib/utils/format-price';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';
import type { CartItem as CartItemData } from '@/lib/schemas';

interface OrderSummaryStickyProps {
  items: CartItemData[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  /** Prix catalogue (avant offre) — sert au strikethrough quand freeShipping=true. */
  catalogShippingCents?: number;
  freeShipping?: boolean;
}

export function OrderSummarySticky({
  items,
  subtotalCents,
  shippingCents,
  totalCents,
  catalogShippingCents,
  freeShipping = false,
}: OrderSummaryStickyProps) {
  return (
    <aside
      aria-labelledby="order-summary-sticky-heading"
      className="space-y-6 lg:sticky lg:top-24 lg:self-start"
    >
      <div className="space-y-4 border-t border-encre/15 pt-6">
        <Kicker>Récapitulatif</Kicker>
        <Heading
          as="h2"
          size="sm"
          id="order-summary-sticky-heading"
          className="font-display"
        >
          Votre commande.
        </Heading>

        <ul className="space-y-3 border-y border-encre/10 py-4">
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

        <dl className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-base text-encre/70">Sous-total</dt>
            <dd className="text-base text-encre">
              {formatPrice(subtotalCents)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-base text-encre/70">Livraison</dt>
            <dd className="text-base text-encre">
              {freeShipping && catalogShippingCents && catalogShippingCents > 0 ? (
                <ShippingPriceDisplay
                  displayPrice={formatPrice(catalogShippingCents)}
                  freeShipping
                  size="md"
                  align="right"
                />
              ) : (
                formatPrice(shippingCents)
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-encre/15 pt-4">
            <dt className="font-body text-sm uppercase tracking-[0.18em] text-encre/70">
              Total
            </dt>
            <dd className="font-display text-2xl text-encre">
              {formatPrice(totalCents)}
            </dd>
          </div>
        </dl>

        <Text size="caption" tone="tertiary" as="p">
          Modifiable jusqu&rsquo;au paiement.
        </Text>
      </div>
    </aside>
  );
}
