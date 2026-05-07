'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCartStore, selectSubtotalCents } from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/utils/format-price';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { Kicker } from '@/components/ui/Kicker';
import { routes } from '@/lib/routes';
import { useTracking } from '@/lib/tracking/use-tracking';

/**
 * @tracking-category commerce_cart
 * @tracking-events view_cart, begin_checkout
 * @tracking-description Page panier — view_cart au mount + begin_checkout au clic « Passer commande ».
 */
export function CartContents() {
  const items = useCartStore((s) => s.items);
  const hydrated = useCartStore((s) => s.hydrated);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore(selectSubtotalCents);
  const { emit } = useTracking();
  const viewCartFired = useRef(false);

  useEffect(() => {
    if (!hydrated || viewCartFired.current || items.length === 0) return;
    viewCartFired.current = true;
    emit('view_cart', {
      currency: 'MAD',
      value: subtotal / 100,
      items: items.map((it) => ({
        item_id: it.productId,
        item_name: it.productName,
        price: it.unitPriceCents / 100,
        quantity: it.quantity,
      })),
    });
  }, [hydrated, items, subtotal, emit]);

  function onBeginCheckout(): void {
    emit('begin_checkout', {
      currency: 'MAD',
      value: subtotal / 100,
      items: items.map((it) => ({
        item_id: it.productId,
        item_name: it.productName,
        price: it.unitPriceCents / 100,
        quantity: it.quantity,
      })),
    });
  }

  if (!hydrated) {
    return (
      <div aria-busy="true" className="py-20 text-center">
        <Text size="body" tone="tertiary">
          Lecture du panier…
        </Text>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center space-y-6">
        <Kicker>Panier</Kicker>
        <Heading as="h2" size="lg">
          Le panier est vide.
        </Heading>
        <Text size="body" tone="secondary">
          Le rituel commence par un kit. Trois gestes, cinq minutes.
        </Text>
        <div className="pt-2">
          <Link href={routes.kit}>
            <Button variant="primary" size="lg">
              Voir le kit
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
      <ul className="space-y-6 divide-y divide-encre/10">
        {items.map((item) => (
          <li key={item.productId} className="flex gap-4 pt-6 first:pt-0">
            <div className="flex-1 space-y-2">
              <Heading as="h3" size="sm">
                {item.productName}
              </Heading>
              <Text size="caption" tone="tertiary">
                {formatPrice(item.unitPriceCents)} l’unité
              </Text>
              <div className="flex items-center gap-3 pt-2">
                <label
                  htmlFor={`qty-${item.productId}`}
                  className="text-xs uppercase tracking-[0.18em] text-encre/60"
                >
                  Quantité
                </label>
                <input
                  id={`qty-${item.productId}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                  className="w-16 border-b border-encre/30 bg-transparent py-1 text-center text-encre focus:border-encre focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="text-xs uppercase tracking-[0.18em] text-encre/60 underline-offset-4 hover:text-encre hover:underline"
                >
                  Retirer
                </button>
              </div>
            </div>
            <div className="text-right">
              <Text size="body" tone="default">
                {formatPrice(item.unitPriceCents * item.quantity)}
              </Text>
            </div>
          </li>
        ))}
      </ul>
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="border-t border-encre/10 pt-6 space-y-3">
          <div className="flex justify-between">
            <Text size="body" tone="secondary">
              Sous-total
            </Text>
            <Text size="body" tone="default">
              {formatPrice(subtotal)}
            </Text>
          </div>
          <Text size="caption" tone="tertiary">
            Livraison estimée à l’étape suivante.
          </Text>
        </div>
        <Link href={routes.commander} className="block" onClick={onBeginCheckout}>
          <Button variant="primary" size="lg" fullWidth>
            Passer commande
          </Button>
        </Link>
        <Link href={routes.kit} className="block text-center">
          <Text size="caption" tone="tertiary" className="underline underline-offset-4">
            Continuer à découvrir
          </Text>
        </Link>
      </aside>
    </div>
  );
}
