'use client';

import { useCartStore } from '@/lib/stores/cart-store';
import { Container } from '@/components/ui/Container';
import { CartItem } from './CartItem';
import { CartSummary } from './CartSummary';
import { CartSkeleton } from './CartSkeleton';
import { EmptyCartState } from './EmptyCartState';
import { MobileCheckoutBar } from './MobileCheckoutBar';

export function CartLayout() {
  const items = useCartStore((s) => s.items);
  const hydrated = useCartStore((s) => s.hydrated);

  if (!hydrated) return <CartSkeleton />;
  if (items.length === 0) return <EmptyCartState />;

  return (
    <>
      <section
        aria-labelledby="cart-list-heading"
        className="py-12 pb-32 sm:py-16 lg:pb-16"
      >
        <Container width="page">
          <h2 id="cart-list-heading" className="sr-only">
            Articles dans votre panier
          </h2>
          <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-16">
            <ul className="space-y-0">
              {items.map((item) => (
                <CartItem key={item.productId} item={item} />
              ))}
            </ul>
            <CartSummary />
          </div>
        </Container>
      </section>
      <MobileCheckoutBar />
    </>
  );
}
