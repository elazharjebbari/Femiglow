'use client';

import Link from 'next/link';
import {
  useCartStore,
  selectTotalCents,
} from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/utils/format-price';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

export function MobileCheckoutBar() {
  const total = useCartStore(selectTotalCents);
  const itemCount = useCartStore((s) => s.items.length);

  if (itemCount === 0) return null;

  return (
    <div
      role="region"
      aria-label={'R\u00E9capitulatif et passage en commande'}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-encre/15 bg-creme shadow-[0_-12px_32px_-20px_rgba(31,29,26,0.4)] lg:hidden"
      style={{
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6">
        <div className="space-y-0.5">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-encre/60">
            Total
          </span>
          <span className="block font-display text-xl text-encre">
            {formatPrice(total)}
          </span>
        </div>
        <Link href={routes.commander} className="shrink-0">
          <Button variant="primary" size="md" iconTrailing={'\u2192'}>
            Commander
          </Button>
        </Link>
      </div>
    </div>
  );
}
