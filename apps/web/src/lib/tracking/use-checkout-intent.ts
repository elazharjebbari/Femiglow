'use client';

import { useCallback, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';
import {
  buildCheckoutIntentEvent,
  type CheckoutIntentInput,
  type WizardContext,
} from '@/lib/tracking/checkout-events';

/**
 * Hook : émet `checkout_intent` à la 1ère frappe (≥1 char) dans
 * n'importe quel champ du formulaire lead. Idempotent par instance de
 * formulaire grâce à un `useRef<boolean>` + dedupKey côté client.
 *
 * Usage :
 *   const { handleInputChange } = useCheckoutIntentTrigger({ ctx, value, items });
 *   …
 *   <input onChange={(e) => { handleInputChange('firstName', e.target.value); ... }} />
 *
 * Idempotence : la dedupKey est `checkout_intent:<form_id>`. Si
 * l'utilisateur efface tout et retape, l'event n'est PAS réémis
 * (intent déjà signalé).
 */
export function useCheckoutIntentTrigger(input: {
  ctx: WizardContext;
  value?: number;
  items?: CheckoutIntentInput['items'];
}): {
  /** Appelé sur `onChange` d'un champ — fire l'event si valeur ≥ 1 char ET pas déjà fired. */
  handleInputChange: (fieldName: string, fieldValue: string) => void;
  /** Réinitialise le flag (utile pour les tests). */
  reset: () => void;
} {
  const { emit } = useTracking();
  const firedRef = useRef(false);

  const handleInputChange = useCallback(
    (fieldName: string, fieldValue: string): void => {
      if (firedRef.current) return;
      if (!fieldValue || fieldValue.length < 1) return;
      firedRef.current = true;

      const payload = buildCheckoutIntentEvent({
        ctx: input.ctx,
        first_field: fieldName,
        value: input.value,
        items: input.items,
      });

      emit('checkout_intent', payload as unknown as Record<string, unknown>, {
        dedupKey: input.ctx.form_id,
        componentName: 'CheckoutIntentTrigger',
      });
    },
    [emit, input.ctx, input.value, input.items],
  );

  const reset = useCallback((): void => {
    firedRef.current = false;
  }, []);

  return { handleInputChange, reset };
}
