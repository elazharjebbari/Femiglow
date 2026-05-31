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
  /**
   * `event_id` seed déterministe fourni par le Server Component pour aligner
   * le Pixel client avec le fire CAPI server-side. Doit être 32 hex chars
   * (cf. `deriveEventId`). Si absent ou invalide, on retombe sur `uuidv7`.
   *
   * cf. docs/meta-quality-audit-2026-05/01-design-conception.md §3.1
   */
  eventIdSeed?: string;
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
  eventIdSeed,
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
    emit(
      'view_item',
      { currency, value: priceCents / 100, items },
      eventIdSeed ? { eventIdOverride: eventIdSeed } : undefined,
    );
  }, [emit, itemId, itemName, priceCents, currency, category, eventIdSeed]);

  return null;
}
