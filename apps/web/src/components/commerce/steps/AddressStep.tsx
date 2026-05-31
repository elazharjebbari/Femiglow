'use client';

/**
 * CHA-233 — Step 2 Mode B (panier) aligné sur le wizard /kit.
 *
 * Champs : ville (autocomplete) + adresse libre (optionnelle) + note livreur.
 * Plus de line2, quartier, code postal, sélecteur de mode de livraison.
 * Un seul mode de livraison — bandeau « gratuite 24-48 h partout au Maroc ».
 *
 * Le combobox `<CityAutocomplete>` reste partagé avec le wizard (CHA-230).
 * Le bandeau réutilise `<ShippingPriceDisplay>` (CHA-232) pour signaler
 * la livraison offerte avec strikethrough + accent doré.
 */

import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { TextField, TextAreaField } from '@/components/forms/Field';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { CityAutocomplete } from '@/components/checkout/wizard/components/CityAutocomplete';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';
import type { CheckoutForm } from '@/lib/schemas';
import { computeShippingCents } from '@/lib/utils/shipping';
import { formatPrice } from '@/lib/utils/format-price';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';

export function AddressStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CheckoutForm>();

  const city = useWatch({ control, name: 'address.city' });
  const { freeShipping } = useShippingConfig();

  // Prix catalogue pour signaler "offerte" — uniquement quand une ville
  // reconnue est sélectionnée. Évite d'afficher un strikethrough générique.
  const catalogShipping = city
    ? computeShippingCents({ city, mode: 'standard' })
    : 0;

  return (
    <fieldset className="space-y-7" data-testid="checkout-step-address">
      <legend className="sr-only">Adresse de livraison</legend>
      <Heading as="h2" id="checkout-step-address" size="md" tabIndex={-1}>
        Livraison.
      </Heading>
      <Text size="caption" tone="tertiary" as="p">
        Indiquez votre ville — nous vous livrons partout au Maroc.
      </Text>

      <Controller
        control={control}
        name="address.city"
        render={({ field }) => (
          <CityAutocomplete
            id="checkout-city"
            label="Ville"
            placeholder="Rabat, Casablanca, Marrakech…"
            required
            error={errors.address?.city?.message}
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            testId="checkout-city-autocomplete"
          />
        )}
      />

      <TextField
        id="checkout-line1"
        label="Adresse (optionnel)"
        autoComplete="address-line1"
        hint="Numéro, rue, repère — utile pour le coursier."
        error={errors.address?.line1?.message}
        {...register('address.line1')}
      />

      <ShippingNotice
        freeShipping={freeShipping}
        catalogShippingCents={catalogShipping}
      />

      <TextAreaField
        id="checkout-notes"
        label="Note pour le livreur (optionnel)"
        rows={3}
        maxLength={500}
        showCounter
        placeholder="Étage, code d'entrée, créneau préféré…"
        error={errors.address?.notes?.message}
        {...register('address.notes')}
      />
    </fieldset>
  );
}

interface ShippingNoticeProps {
  freeShipping: boolean;
  catalogShippingCents: number;
}

function ShippingNotice({
  freeShipping,
  catalogShippingCents,
}: ShippingNoticeProps) {
  return (
    <section
      role="note"
      aria-label="Information de livraison"
      className="rounded border border-encre/15 bg-creme p-4 flex items-start gap-3"
      data-testid="checkout-shipping-notice"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-encre/30 bg-white text-encre"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M2 5.5L8 2L14 5.5M2 5.5V11.5L8 14L14 11.5V5.5M2 5.5L8 9M14 5.5L8 9M8 9V14"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="flex-1 space-y-1">
        <Text size="small" className="font-medium text-encre">
          {freeShipping
            ? 'Livraison gratuite partout au Maroc.'
            : 'Livraison sous 24-48 h.'}
        </Text>
        <Text size="small" tone="secondary">
          Reçu en main propre, paiement à la livraison — sans frais cachés.
        </Text>
        {freeShipping && catalogShippingCents > 0 && (
          <div className="pt-1" data-testid="checkout-shipping-free-badge">
            <ShippingPriceDisplay
              displayPrice={formatPrice(catalogShippingCents)}
              freeShipping
              size="sm"
              align="left"
              srNote={`Livraison normalement à ${formatPrice(catalogShippingCents)}, actuellement offerte`}
            />
          </div>
        )}
      </div>
    </section>
  );
}
