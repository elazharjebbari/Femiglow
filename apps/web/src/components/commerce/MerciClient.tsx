'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Fleuron } from '@/components/ui/Fleuron';
import { OrderHero } from '@/components/sections/OrderHero';
import { OrderRecap } from '@/components/sections/OrderRecap';
import { TimelineSteps } from '@/components/sections/TimelineSteps';
import { EditorialLetter } from '@/components/sections/EditorialLetter';
import { PreparationGesture } from '@/components/sections/PreparationGesture';
import { MerciOrchestrator } from './MerciOrchestrator';
import {
  readLastOrder,
  type LastOrderPayload,
} from '@/lib/stores/checkout-draft';
import { routes } from '@/lib/routes';
import { useTracking } from '@/lib/tracking/use-tracking';

interface MerciClientProps {
  orderId: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-MA', {
    day: 'numeric',
    month: 'long',
  });
}

/**
 * @tracking-category commerce_checkout
 * @tracking-events purchase
 * @tracking-description Page merci — émet purchase une fois la commande chargée (transaction_id, value, items GA4).
 *   Idempotence renforcée : la fired-flag est persistée en sessionStorage par orderId pour empêcher
 *   un double-tracking au "back/forward" navigateur. cf. docs/analytics/03-events-funnel-audit.md §6.4.
 */
const PURCHASE_FIRED_PREFIX = 'fg_purchase_fired_';

function hasPurchaseBeenFired(orderId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(PURCHASE_FIRED_PREFIX + orderId) === '1';
  } catch {
    return false;
  }
}

function markPurchaseFired(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PURCHASE_FIRED_PREFIX + orderId, '1');
  } catch {
    // sessionStorage indisponible (Safari ITP) — on tombe sur l'idempotence in-memory.
  }
}

export function MerciClient({ orderId }: MerciClientProps) {
  const [order, setOrder] = useState<LastOrderPayload | null | 'loading'>(
    'loading',
  );
  const { emit } = useTracking();
  const purchaseFired = useRef(false);

  useEffect(() => {
    const found = readLastOrder(orderId);
    setOrder(found);
  }, [orderId]);

  useEffect(() => {
    if (purchaseFired.current) return;
    if (!order || order === 'loading') return;
    if (hasPurchaseBeenFired(order.orderId)) {
      purchaseFired.current = true;
      return;
    }
    purchaseFired.current = true;
    markPurchaseFired(order.orderId);
    emit('purchase', {
      transaction_id: order.orderId,
      currency: 'MAD',
      value: order.total / 100,
      shipping: order.shipping / 100,
      items: order.items.map((it) => ({
        item_id: it.productId,
        item_name: it.productName,
        price: it.unitPriceCents / 100,
        quantity: it.quantity,
      })),
    });
  }, [order, emit]);

  if (order === 'loading') {
    return (
      <section
        aria-busy="true"
        className="py-20 text-center"
      >
        <Container width="prose">
          <Text size="body" tone="tertiary">
            Lecture de votre commande…
          </Text>
        </Container>
      </section>
    );
  }

  if (!order) {
    return <MerciFallback orderId={orderId} />;
  }

  const created = new Date(order.createdAt);
  const min = new Date(created);
  min.setDate(min.getDate() + 3);
  const max = new Date(created);
  max.setDate(max.getDate() + 5);

  return (
    <>
      <MerciOrchestrator orderId={orderId} totalCents={order.total} />
      <OrderHero
        firstName={order.firstName}
        orderId={order.orderId}
        estimateMin={formatDate(min)}
        estimateMax={formatDate(max)}
      />
      <OrderRecap order={order} />
      <TimelineSteps />
      <EditorialLetter firstName={order.firstName} />
      <PreparationGesture />
    </>
  );
}

export function MerciFallback({ orderId }: { orderId?: string }) {
  return (
    <section className="py-20">
      <Container width="prose">
        <div className="space-y-6 text-center">
          <Fleuron tone="champagne" size="md" />
          <Heading as="h1" size="display-md">
            Confirmation envoyée par email.
          </Heading>
          <Text size="lead" tone="secondary" prose as="p">
            Votre commande a bien été enregistrée. La confirmation détaillée
            arrive dans votre boîte mail.
          </Text>
          {orderId && (
            <p className="text-xs uppercase tracking-[0.18em] text-encre/60">
              Référence : {orderId}
            </p>
          )}
          <div className="pt-6">
            <Link href={routes.home}>
              <Button variant="secondary" size="lg">
                Revenir à la maison
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
