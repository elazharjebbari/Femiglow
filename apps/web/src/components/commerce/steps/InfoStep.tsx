'use client';

/**
 * CHA-233 — Step 1 Mode B (panier) aligné sur le wizard /kit.
 *
 * Champs : prénom + téléphone + consentement.
 * Plus de lastName, email, newsletter, créer-un-compte — ces champs
 * surchargeaient le step sans valeur ajoutée (email passe en opt-in step 3).
 */

import { useFormContext } from 'react-hook-form';
import Link from 'next/link';
import { TextField } from '@/components/forms/Field';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import type { CheckoutForm } from '@/lib/schemas';
import { useFormTracking } from '@/lib/tracking/use-form-tracking';
import { useCheckoutIntentTrigger } from '@/lib/tracking/use-checkout-intent';

// FORM_ID/FORM_MODE dupliqués depuis CheckoutFlow.tsx pour permettre le wiring
// tracking ici sans prop drilling. Si l'un évolue, garder les deux synchronisés.
const TRACKING_FORM_ID = 'cart-checkout-v1';
const TRACKING_FORM_MODE = 'wizard_cart' as const;

export function InfoStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();
  // form_start sur premier focus champ. La fenêtre de dedup
  // DEFAULT_REDUNDANCY['form_start']=5s côté TrackingClient neutralise
  // les double-pushes (Mode A + Mode B montés en parallèle).
  const { handleFieldFocus } = useFormTracking({
    formId: TRACKING_FORM_ID,
    formMode: TRACKING_FORM_MODE,
    trackAbandon: false,
  });

  // checkout_intent — 1ère frappe (≥1 char) ; idempotent par form_id.
  const { handleInputChange: triggerCheckoutIntent } = useCheckoutIntentTrigger({
    ctx: {
      form_id: TRACKING_FORM_ID,
      form_mode: TRACKING_FORM_MODE,
      step_name: 'lead',
      variant_key: null,
    },
  });

  const firstNameProps = register('contact.firstName');

  return (
    <fieldset className="space-y-7" data-testid="checkout-step-info">
      <legend className="sr-only">Vos coordonnées</legend>
      <Heading as="h2" id="checkout-step-info" size="md" tabIndex={-1}>
        Vos coordonnées.
      </Heading>
      <Text size="caption" tone="tertiary" as="p">
        Deux informations seulement — nous vous rappelons pour confirmer.
      </Text>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="checkout-firstName"
          label="Prénom"
          autoComplete="given-name"
          required
          error={errors.contact?.firstName?.message}
          {...firstNameProps}
          onFocus={handleFieldFocus('firstName')}
          onChange={(e) => {
            void firstNameProps.onChange(e);
            triggerCheckoutIntent('firstName', e.target.value);
          }}
        />
        <PhoneField
          onFocus={handleFieldFocus('phone')}
          onCheckoutIntentInput={(v) => triggerCheckoutIntent('phone', v)}
        />
      </div>

      <ConsentCheckbox />
    </fieldset>
  );
}

function PhoneField({
  onFocus,
  onCheckoutIntentInput,
}: {
  onFocus?: () => void;
  onCheckoutIntentInput?: (value: string) => void;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();
  const error = errors.contact?.phone?.message;
  const errorId = error ? 'checkout-phone-error' : undefined;
  const phoneProps = register('contact.phone');
  return (
    <div className="space-y-2">
      <label
        htmlFor="checkout-phone"
        className="block text-sm font-medium text-encre"
      >
        Téléphone <span aria-hidden="true" className="ms-1 text-encre/50">*</span>
      </label>
      <div
        className="flex items-center gap-2 border-b border-encre/30 transition-colors aria-[invalid=true]:border-petale-dark"
        aria-invalid={error ? 'true' : undefined}
      >
        <span
          aria-hidden="true"
          className="select-none px-2 py-3 text-sm text-encre/60"
        >
          +212
        </span>
        <input
          id="checkout-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={9}
          required
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          placeholder="612345678"
          className="w-full bg-creme py-3 text-encre placeholder:text-encre/40 focus:outline-none"
          {...phoneProps}
          onFocus={onFocus}
          onChange={(e) => {
            void phoneProps.onChange(e);
            onCheckoutIntentInput?.(e.target.value);
          }}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-petale-dark">
          {error}
        </p>
      )}
    </div>
  );
}

function ConsentCheckbox() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();
  const error = errors.consent?.message as string | undefined;
  return (
    <div className="space-y-2 border-t border-encre/10 pt-5">
      <label
        htmlFor="checkout-consent"
        className="flex items-start gap-3 text-sm text-encre"
      >
        <input
          id="checkout-consent"
          type="checkbox"
          className="mt-1 h-4 w-4 accent-encre"
          aria-invalid={error ? 'true' : undefined}
          {...register('consent')}
        />
        <span>
          J&rsquo;accepte d&rsquo;être contactée par la maison FemiGlow pour ma
          commande. Voir nos{' '}
          <Link
            href="/mentions-legales"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
          >
            mentions légales
          </Link>
          .
        </span>
      </label>
      {error && (
        <p role="alert" className="ps-7 text-xs text-petale-dark">
          {error}
        </p>
      )}
    </div>
  );
}
