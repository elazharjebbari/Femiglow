'use client';

/**
 * CHA-230 — Step 0 du wizard mode B : revue du panier (placeholder Phase 9).
 */

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';

export function CartReviewStep() {
  const { t } = useWizardTranslation();
  const cart = useWizardStore((s) => s.cartSnapshot);
  const goToStep = useWizardStore((s) => s.goToStep);

  return (
    <section
      aria-labelledby="wizard-cart-heading"
      className="space-y-6"
      data-testid="wizard-step-cart"
    >
      <header className="space-y-2">
        <Heading as="h2" size="md" italic="always" id="wizard-cart-heading">
          {t.cartReview.heading}
        </Heading>
        <Text size="small" tone="secondary">
          {t.cartReview.subtitle}
        </Text>
      </header>
      {cart && (
        <ul className="space-y-2 text-sm">
          {cart.items.map((it) => (
            <li key={it.sku} className="flex justify-between">
              <span>
                {it.name} × {it.quantity}
              </span>
              <span>
                {((it.unitPriceCents * it.quantity) / 100).toFixed(2)} {cart.currency}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="primary" onClick={() => goToStep('lead')}>
        {t.cartReview.ctaContinue}
      </Button>
    </section>
  );
}
