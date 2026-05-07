'use client';

import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Heading } from '@/components/ui/Heading';
import { PaymentMethodSelector } from '@/components/commerce/PaymentMethodSelector';
import { PromoCodeInput } from '@/components/commerce/PromoCodeInput';
import { TermsCheckbox } from '@/components/commerce/TermsCheckbox';
import type { CheckoutForm } from '@/lib/schemas';

export function PaymentStep() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();
  const method = useWatch({ control, name: 'paymentMethod' });

  return (
    <fieldset className="space-y-6">
      <legend className="sr-only">Paiement</legend>
      <Heading as="h2" id="checkout-step-payment" size="md" tabIndex={-1}>
        Paiement.
      </Heading>

      <Controller
        control={control}
        name="paymentMethod"
        render={({ field }) => (
          <PaymentMethodSelector
            name={field.name}
            value={field.value ?? 'cod'}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      {errors.paymentMethod?.message && (
        <p role="alert" className="text-xs text-petale-dark">
          {errors.paymentMethod.message}
        </p>
      )}

      <PaymentMethodHint method={method ?? 'cod'} />

      <PromoCodeInput />

      <TermsCheckbox
        error={errors.consent?.message as string | undefined}
        {...register('consent')}
      />
    </fieldset>
  );
}

function PaymentMethodHint({
  method,
}: {
  method: CheckoutForm['paymentMethod'];
}) {
  if (method === 'cod') {
    return (
      <p className="border-l-2 border-encre/15 pl-4 text-sm text-encre/70">
        Vous réglerez en main propre au coursier au moment de la livraison.
        Aucune information bancaire à fournir.
      </p>
    );
  }
  if (method === 'card') {
    return (
      <p className="border-l-2 border-encre/15 pl-4 text-sm text-encre/70">
        Paiement carte international (Stripe). Le formulaire bancaire
        s&rsquo;ouvrira après confirmation. Branchement Phase 2.
      </p>
    );
  }
  return (
    <p className="border-l-2 border-encre/15 pl-4 text-sm text-encre/70">
      Paiement CMI Maroc. Vous serez redirigée vers la plateforme bancaire
      sécurisée. Branchement Phase 2.
    </p>
  );
}
