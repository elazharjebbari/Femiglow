'use client';

import { useEffect, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface Item {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  category?: string;
}

interface ViewItemTrackerProps {
  itemId: string;
  itemName: string;
  priceCents: number;
  currency?: string;
  category?: string;
}

/**
 * @tracking-category section_hero
 * @tracking-events view_item
 * @tracking-description Émet view_item au mount d'une page produit (taxonomie GA4 e-commerce).
 *   Idempotence : tracké par itemId pour empêcher un double tir (StrictMode dev, remount).
 *   cf. docs/analytics/03-events-funnel-audit.md §6.4.
 */
export function ViewItemTracker({
  itemId,
  itemName,
  priceCents,
  currency = 'MAD',
  category,
}: ViewItemTrackerProps) {
  const { emit } = useTracking();
  const lastFiredItemRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastFiredItemRef.current === itemId) return;
    lastFiredItemRef.current = itemId;
    const items: Item[] = [
      {
        item_id: itemId,
        item_name: itemName,
        price: priceCents / 100,
        quantity: 1,
        ...(category ? { category } : {}),
      },
    ];
    emit('view_item', {
      currency,
      value: priceCents / 100,
      items,
    });
  }, [emit, itemId, itemName, priceCents, currency, category]);

  return null;
}
