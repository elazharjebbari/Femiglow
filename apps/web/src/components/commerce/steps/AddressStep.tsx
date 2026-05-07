'use client';

import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { TextField } from '@/components/forms/Field';
import { Heading } from '@/components/ui/Heading';
import { ShippingModeSelector } from '@/components/commerce/ShippingModeSelector';
import type { CheckoutForm, VilleMaroc, ShippingMode } from '@/lib/schemas';
import { isExpressAvailable } from '@/lib/utils/shipping';

const cities: ReadonlyArray<{ value: VilleMaroc; label: string }> = [
  { value: 'casablanca', label: 'Casablanca' },
  { value: 'rabat', label: 'Rabat' },
  { value: 'marrakech', label: 'Marrakech' },
  { value: 'fes', label: 'Fès' },
  { value: 'tanger', label: 'Tanger' },
  { value: 'agadir', label: 'Agadir' },
  { value: 'meknes', label: 'Meknès' },
  { value: 'oujda', label: 'Oujda' },
  { value: 'tetouan', label: 'Tétouan' },
  { value: 'sale', label: 'Salé' },
  { value: 'autre', label: 'Autre — précisez' },
];

const shippingOptions: ReadonlyArray<{
  value: ShippingMode;
  title: string;
  hint: string;
  price: string;
}> = [
  {
    value: 'standard',
    title: 'Standard',
    hint: '3 à 5 jours ouvrés.',
    price: '40–60 MAD',
  },
  {
    value: 'express',
    title: 'Express',
    hint: '24-48 h, Casablanca uniquement.',
    price: '80 MAD',
  },
];

export function AddressStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CheckoutForm>();

  const city = useWatch({ control, name: 'address.city' });

  return (
    <fieldset className="space-y-6">
      <legend className="sr-only">Adresse de livraison</legend>
      <Heading as="h2" id="checkout-step-address" size="md" tabIndex={-1}>
        Livraison.
      </Heading>

      <TextField
        id="checkout-line1"
        label="Adresse"
        autoComplete="address-line1"
        required
        error={errors.address?.line1?.message}
        {...register('address.line1')}
      />
      <TextField
        id="checkout-line2"
        label="Complément (optionnel)"
        autoComplete="address-line2"
        error={errors.address?.line2?.message}
        {...register('address.line2')}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="checkout-quartier"
          label="Quartier"
          autoComplete="address-level3"
          required
          error={errors.address?.quartier?.message}
          {...register('address.quartier')}
        />
        <CitySelect />
      </div>

      {city === 'autre' && (
        <TextField
          id="checkout-city-other"
          label="Ville (à préciser)"
          required
          error={errors.address?.cityOther?.message}
          {...register('address.cityOther')}
        />
      )}

      <TextField
        id="checkout-postal"
        label="Code postal (optionnel)"
        autoComplete="postal-code"
        inputMode="numeric"
        maxLength={5}
        hint="Si vous ne le connaissez pas, laissez vide."
        error={errors.address?.postalCode?.message}
        {...register('address.postalCode')}
      />

      <div className="space-y-3 border-t border-encre/10 pt-5">
        <p className="text-sm font-medium text-encre">Mode de livraison</p>
        <Controller
          control={control}
          name="address.shippingMode"
          render={({ field }) => (
            <ShippingModeSelector
              options={shippingOptions}
              name={field.name}
              value={field.value ?? 'standard'}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabledExpress={!isExpressAvailable(city)}
            />
          )}
        />
      </div>
    </fieldset>
  );
}

function CitySelect() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();
  const error = errors.address?.city?.message;
  const errorId = error ? 'checkout-city-error' : undefined;
  return (
    <div className="space-y-2">
      <label
        htmlFor="checkout-city"
        className="block text-sm font-medium text-encre"
      >
        Ville <span aria-hidden="true" className="ml-1 text-encre/50">*</span>
      </label>
      <select
        id="checkout-city"
        required
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        className="w-full bg-creme border-b border-encre/30 px-0 py-3 text-encre transition-colors focus:outline-none focus:border-encre aria-[invalid=true]:border-petale-dark"
        {...register('address.city')}
      >
        <option value="">— Sélectionner —</option>
        {cities.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-petale-dark">
          {error}
        </p>
      )}
    </div>
  );
}
