'use client';

import { useFormContext } from 'react-hook-form';
import { TextField } from '@/components/forms/Field';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import type { CheckoutForm } from '@/lib/schemas';

export function InfoStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();

  return (
    <fieldset className="space-y-6">
      <legend className="sr-only">Vos coordonnées</legend>
      <Heading as="h2" id="checkout-step-info" size="md" tabIndex={-1}>
        Vos coordonnées.
      </Heading>
      <Text size="caption" tone="tertiary" as="p">
        Nous utilisons ces informations uniquement pour préparer votre
        commande.
      </Text>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="checkout-firstName"
          label="Prénom"
          autoComplete="given-name"
          required
          error={errors.contact?.firstName?.message}
          {...register('contact.firstName')}
        />
        <TextField
          id="checkout-lastName"
          label="Nom"
          autoComplete="family-name"
          required
          error={errors.contact?.lastName?.message}
          {...register('contact.lastName')}
        />
      </div>

      <TextField
        id="checkout-email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        error={errors.contact?.email?.message}
        {...register('contact.email')}
      />

      <PhoneField />

      <div className="space-y-3 border-t border-encre/10 pt-5">
        <label
          htmlFor="checkout-newsletter"
          className="flex items-start gap-3 text-sm text-encre"
        >
          <input
            id="checkout-newsletter"
            type="checkbox"
            className="mt-1 h-4 w-4 accent-encre"
            {...register('contact.acceptNewsletter')}
          />
          <span>
            Recevoir la lettre de la maison (saisonnière, sans pression).
          </span>
        </label>
        <label
          htmlFor="checkout-account"
          className="flex items-start gap-3 text-sm text-encre"
        >
          <input
            id="checkout-account"
            type="checkbox"
            className="mt-1 h-4 w-4 accent-encre"
            {...register('contact.createAccount')}
          />
          <span>
            Créer un compte pour suivre mes commandes.{' '}
            <span className="text-encre/50">(Disponible bientôt.)</span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

function PhoneField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();
  const error = errors.contact?.phone?.message;
  const errorId = error ? 'checkout-phone-error' : undefined;
  return (
    <div className="space-y-2">
      <label
        htmlFor="checkout-phone"
        className="block text-sm font-medium text-encre"
      >
        Téléphone <span aria-hidden="true" className="ml-1 text-encre/50">*</span>
      </label>
      <div className="flex items-center gap-2 border-b border-encre/30 transition-colors aria-[invalid=true]:border-petale-dark"
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
          {...register('contact.phone')}
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
