'use client';

import { useEffect, useRef } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';

interface MerciOrchestratorProps {
  orderId: string;
  totalCents: number;
}

export function MerciOrchestrator({ orderId, totalCents }: MerciOrchestratorProps) {
  const clearCart = useCartStore((s) => s.clear);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    clearCart();
    if (typeof window !== 'undefined') {
      // GA4 stub Phase 1 — remplacer par window.gtag('event', 'purchase', ...) en Phase 2
      // eslint-disable-next-line no-console
      console.info('[GA4 stub] purchase', {
        orderId,
        value: totalCents / 100,
        currency: 'MAD',
      });
    }
  }, [orderId, totalCents, clearCart]);

  return null;
}
