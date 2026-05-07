'use client';

import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { useCartStore, selectCartCount } from '@/lib/stores/cart-store';

export function CartHero() {
  const count = useCartStore(selectCartCount);
  const hydrated = useCartStore((s) => s.hydrated);

  let subtitle: string;
  if (!hydrated) {
    subtitle = 'Lecture du r\u00E9capitulatif\u2026';
  } else if (count === 0) {
    subtitle = 'Aucun article pour le moment.';
  } else if (count === 1) {
    subtitle = 'Un article, rang\u00E9 \u00E0 l\u2019abri.';
  } else {
    subtitle = `${count} articles, rang\u00E9s \u00E0 l\u2019abri.`;
  }

  return (
    <section className="border-b border-encre/10 bg-creme py-16 sm:py-20">
      <Container width="page">
        <div className="max-w-prose space-y-4">
          <Kicker>Le panier</Kicker>
          <Heading as="h1" size="display-md" className="font-display">
            Votre panier.
          </Heading>
          <p
            aria-live="polite"
            className="font-display text-lead italic text-encre/70"
          >
            {subtitle}
          </p>
        </div>
      </Container>
    </section>
  );
}
