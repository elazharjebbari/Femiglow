'use client';

import Link from 'next/link';
import {
  useCartStore,
  selectSubtotalCents,
  selectEstimatedShippingCents,
  selectTotalCents,
} from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/utils/format-price';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { routes } from '@/lib/routes';

export function CartSummary() {
  const subtotal = useCartStore(selectSubtotalCents);
  const shipping = useCartStore(selectEstimatedShippingCents);
  const total = useCartStore(selectTotalCents);
  const itemCount = useCartStore((s) => s.items.length);

  if (itemCount === 0) return null;

  return (
    <div
      role="region"
      aria-labelledby="cart-summary-heading"
      className="space-y-6 lg:sticky lg:top-24 lg:self-start"
    >
      <div className="space-y-4 border-t border-encre/15 pt-6">
        <Heading
          as="h2"
          size="sm"
          id="cart-summary-heading"
          className="font-display"
        >
          Votre commande.
        </Heading>

        <dl className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-base text-encre/70">Sous-total</dt>
            <dd className="text-base text-encre">{formatPrice(subtotal)}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-base text-encre/70">
              {'Livraison estim\u00E9e'}
            </dt>
            <dd className="text-base text-encre">{formatPrice(shipping)}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-4 border-t border-encre/15 pt-4">
            <dt className="font-body text-sm uppercase tracking-[0.18em] text-encre/70">
              Total
            </dt>
            <dd className="font-display text-2xl text-encre">
              {formatPrice(total)}
            </dd>
          </div>
        </dl>

        <p className="text-xs uppercase tracking-[0.1em] text-encre/50">
          {'Estimation, ajust\u00E9e \u00E0 l\u2019\u00E9tape suivante.'}
        </p>
      </div>

      <Link href={routes.commander} className="block">
        <Button variant="primary" size="lg" fullWidth iconTrailing={'\u2192'}>
          Commander
        </Button>
      </Link>

      <Text size="caption" tone="tertiary" as="p" className="text-center">
        {'Vous pourrez modifier votre commande jusqu\u2019\u00E0 l\u2019\u00E9tape paiement.'}
      </Text>
    </div>
  );
}
