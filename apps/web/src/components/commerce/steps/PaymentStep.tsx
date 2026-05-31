'use client';

/**
 * CHA-233 — Step 3 Mode B (panier) : confirmation + opt-in récap email.
 *
 * Avant : selecteur de méthode de paiement (card / cmi / cod) + checkbox CGV.
 * Après : paiement à la livraison forcé en silence (cf. CHA-231) + opt-in
 *         email pour récap de commande (équivalent du `ThankYouStep` wizard).
 *
 * Le consentement CGV est désormais demandé au step 1 (mirror du wizard
 * `LeadCaptureStep`). Cette étape se concentre sur le récap final + la
 * proposition discrète de recevoir le détail par email.
 */

import { useFormContext, useWatch } from 'react-hook-form';
import { TextField } from '@/components/forms/Field';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import type { CheckoutForm } from '@/lib/schemas';

export function PaymentStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CheckoutForm>();

  const wantsRecap = useWatch({ control, name: 'recapEmail' });
  const hasRecapValue = typeof wantsRecap === 'string' && wantsRecap.length > 0;

  return (
    <fieldset className="space-y-7" data-testid="checkout-step-payment">
      <legend className="sr-only">Paiement et récap</legend>
      <Heading as="h2" id="checkout-step-payment" size="md" tabIndex={-1}>
        Confirmation.
      </Heading>

      <section
        aria-label="Méthode de paiement"
        className="rounded border border-encre/15 bg-creme p-4 space-y-2"
      >
        <Text size="small" className="font-medium text-encre">
          Paiement à la livraison.
        </Text>
        <Text size="small" tone="secondary">
          Vous réglez en main propre au coursier au moment de la livraison.
          Aucune information bancaire à fournir maintenant.
        </Text>
      </section>

      <section
        aria-labelledby="checkout-recap-heading"
        className="space-y-3 border-t border-encre/10 pt-5"
      >
        <p
          id="checkout-recap-heading"
          className="text-sm font-medium leading-[1.6] text-encre"
        >
          Souhaitez-vous recevoir un récap de votre commande par email ?
        </p>
        <details
          className="group rounded border border-encre/10 bg-white p-4"
          open={hasRecapValue}
          data-testid="checkout-recap-toggle"
        >
          <summary className="cursor-pointer text-sm text-encre">
            <span className="group-open:hidden">Oui, ajouter mon email.</span>
            <span className="hidden group-open:inline">
              Email pour récap (optionnel).
            </span>
          </summary>
          <div className="pt-4">
            <TextField
              id="checkout-recap-email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="vous@exemple.ma"
              hint="Optionnel — nous ne vous enverrons que le détail de cette commande."
              error={errors.recapEmail?.message as string | undefined}
              {...register('recapEmail')}
            />
          </div>
        </details>
      </section>
    </fieldset>
  );
}
