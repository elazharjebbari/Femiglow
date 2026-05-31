'use client';

import { useState } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';
import type { CartItem as CartItemData } from '@/lib/schemas';
import { formatPrice } from '@/lib/utils/format-price';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { Image } from '@/components/ui/Image';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { QuantitySelector } from './QuantitySelector';
import { cn } from '@/lib/utils/cn';

export interface CartItemProps {
  item: CartItemData;
}

export function CartItem({ item }: CartItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  function handleConfirmRemove() {
    setRemoving(true);
    window.setTimeout(() => removeItem(item.productId), 220);
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-4 border-b border-encre/10 py-6 first:pt-0 last:border-b-0',
        'transition-all duration-base ease-out-soft',
        'motion-reduce:transition-none',
        'sm:grid sm:grid-cols-[120px_1fr_auto] sm:items-start sm:gap-6',
        removing && 'pointer-events-none opacity-0 -translate-y-1',
      )}
      data-testid={`cart-item-${item.productId}`}
    >
      <div className="w-24 sm:w-[120px]">
        {item.imageSrc ? (
          <Image
            ratio="1:1"
            src={item.imageSrc}
            alt={item.imageAlt ?? item.productName}
            sizes="(min-width: 640px) 120px, 96px"
          />
        ) : (
          <div
            aria-hidden="true"
            className="aspect-square w-full bg-champagne/40"
          />
        )}
      </div>

      <div className="space-y-2">
        <Heading as="h3" size="sm">
          {item.productName}
        </Heading>
        <Text size="caption" tone="tertiary">
          {formatPrice(item.unitPriceCents)}
          {'\u202F\u00B7\u202F'}
          l{'\u2019'}unit{'\u00E9'}
        </Text>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <QuantitySelector
            value={item.quantity}
            onChange={(next) => updateQuantity(item.productId, next)}
            productName={item.productName}
            productId={item.productId}
          />
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={cn(
              'text-xs uppercase tracking-[0.18em] text-encre/60',
              'underline-offset-4 transition-colors duration-fast',
              'hover:text-encre hover:underline',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]',
              'focus-visible:outline-encre',
              'motion-reduce:transition-none',
            )}
            aria-label={`Retirer ${item.productName} du panier`}
          >
            Retirer
          </button>
        </div>
      </div>

      <div className="text-end">
        <Text size="body" tone="default" className="font-display text-xl">
          {formatPrice(item.unitPriceCents * item.quantity)}
        </Text>
      </div>

      <ConfirmationModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={'Retirer cet article\u202F?'}
        description={'Vous pourrez l\u2019ajouter \u00E0 nouveau depuis la fiche du kit.'}
        confirmLabel="Retirer"
        cancelLabel="Annuler"
        onConfirm={handleConfirmRemove}
      />
    </li>
  );
}
