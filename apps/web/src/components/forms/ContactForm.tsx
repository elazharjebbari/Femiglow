'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  contactFormSchema,
  type ContactFormValues,
  type ContactType,
} from '@/lib/schemas';
import { TextField, TextAreaField } from './Field';
import { FormTypeSelector } from './FormTypeSelector';
import { SuccessState } from './SuccessState';
import { ErrorState } from './ErrorState';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { useTracking } from '@/lib/tracking/use-tracking';

const CONTACT_EMAIL = 'info@femiglow-maroc.com';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Phase 7 wiring — libellés localisés du formulaire de contact
 * (`marketing.contact.form.*`). Tous optionnels via `DEFAULT_CONTACT_FORM_STRINGS`
 * (FR) — préserve les usages legacy + les tests qui rendent sans strings.
 */
export interface ContactFormStrings {
  fieldName: string;
  fieldEmail: string;
  fieldPhone: string;
  fieldCompany: string;
  fieldRole: string;
  fieldOrderNumber: string;
  fieldOrderNumberHint: string;
  fieldMessage: string;
  fieldMessageHint: string;
  honeypotLabel: string;
  typeLegend: string;
  typeQuestion: string;
  typeOrder: string;
  typeProfessional: string;
  gdprConsentText: string;
  gdprConsentLink: string;
  newsletterConsent: string;
  submit: string;
  successTitle: string;
  successBody: string;
  errorBody: string;
}

export const DEFAULT_CONTACT_FORM_STRINGS: ContactFormStrings = {
  fieldName: 'Votre prénom',
  fieldEmail: 'Votre email',
  fieldPhone: 'Téléphone',
  fieldCompany: 'Raison sociale',
  fieldRole: 'Votre fonction',
  fieldOrderNumber: 'Numéro de commande',
  fieldOrderNumberHint: 'Le numéro figure dans votre email de confirmation.',
  fieldMessage: 'Votre message',
  fieldMessageHint:
    'Au moins 20 caractères, pour que nous puissions répondre justement.',
  honeypotLabel: 'Site web (ne pas remplir)',
  typeLegend: 'Quel type de message ?',
  typeQuestion: 'Une question',
  typeOrder: 'Une commande',
  typeProfessional: 'Un échange professionnel',
  gdprConsentText:
    'J’accepte que mon message soit lu par la maison FemiGlow afin d’y répondre. Voir nos',
  gdprConsentLink: 'mentions légales',
  newsletterConsent:
    'Je souhaite recevoir la lettre saisonnière. Une lettre par saison. Aucun envoi commercial.',
  submit: 'Envoyer mon message',
  successTitle: 'Bien reçu. La maison vous répond.',
  successBody:
    'Nous lisons chaque message avec attention. Réponse sous 24 heures ouvrées.',
  errorBody: 'L’envoi n’a pas abouti. Réessayez ou écrivez-nous à',
};

interface ContactFormProps {
  defaultType?: ContactType;
  /** Phase 7 wiring — libellés localisés. Défaut FR si absent. */
  strings?: ContactFormStrings;
}

const conditionalFieldClasses = cn(
  'grid gap-6 transition-opacity duration-base ease-out-soft',
  'motion-reduce:transition-none',
  'aria-hidden:hidden',
);

/**
 * @tracking-category form_input
 * @tracking-events contact_submit, generate_lead
 * @tracking-description Formulaire de contact — émet contact_submit (intent) + generate_lead (succès).
 */
export function ContactForm({
  defaultType = 'question',
  strings = DEFAULT_CONTACT_FORM_STRINGS,
}: ContactFormProps) {
  const [status, setStatus] = useState<Status>('idle');
  const { emit } = useTracking();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    setFocus,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    mode: 'onBlur',
    defaultValues: {
      type: defaultType,
      name: '',
      email: '',
      phone: '',
      orderNumber: '',
      companyName: '',
      role: '',
      message: '',
      gdprConsent: false as unknown as true,
      newsletterOptIn: false,
      website: '',
    },
  });

  const type = watch('type');

  useEffect(() => {
    if (status !== 'success') return;
    const timer = window.setTimeout(() => {
      setStatus('idle');
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function onSubmit(values: ContactFormValues) {
    setStatus('submitting');
    emit('contact_submit', { contact_type: values.type });
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.status === 422) {
        const body = (await response.json().catch(() => null)) as
          | { issues?: { fieldErrors?: Record<string, string[]> } }
          | null;
        const fieldErrors = body?.issues?.fieldErrors ?? {};
        let firstField: keyof ContactFormValues | null = null;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          const message = messages?.[0];
          if (!message) continue;
          setError(field as keyof ContactFormValues, { message });
          if (!firstField) firstField = field as keyof ContactFormValues;
        }
        if (firstField) setFocus(firstField);
        setStatus('error');
        return;
      }

      if (!response.ok) {
        setStatus('error');
        return;
      }

      emit('generate_lead', {
        method: 'contact',
        contact_type: values.type,
        identity: { email: values.email, firstName: values.name },
      });
      reset({
        type: getValues('type'),
        name: '',
        email: '',
        phone: '',
        orderNumber: '',
        companyName: '',
        role: '',
        message: '',
        gdprConsent: false as unknown as true,
        newsletterOptIn: false,
        website: '',
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return <SuccessState title={strings.successTitle} body={strings.successBody} />;
  }

  const showOrderField = type === 'order';
  const showProfessionalFields = type === 'professional';
  const networkError = status === 'error' && Object.keys(errors).length === 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      <FormTypeSelector
        value={type}
        onChange={(next) => setValue('type', next, { shouldValidate: true })}
        legend={strings.typeLegend}
        options={[
          { value: 'question', label: strings.typeQuestion },
          { value: 'order', label: strings.typeOrder },
          { value: 'professional', label: strings.typeProfessional },
        ]}
      />

      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="contact-website">{strings.honeypotLabel}</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('website')}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="contact-name"
          label={strings.fieldName}
          autoComplete="given-name"
          required
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          id="contact-email"
          label={strings.fieldEmail}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <div
        className={conditionalFieldClasses}
        aria-hidden={!showOrderField}
      >
        <TextField
          id="contact-order-number"
          label={strings.fieldOrderNumber}
          hint={strings.fieldOrderNumberHint}
          autoComplete="off"
          required={showOrderField}
          error={errors.orderNumber?.message}
          {...register('orderNumber')}
        />
      </div>

      <div
        className={conditionalFieldClasses}
        aria-hidden={!showProfessionalFields}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            id="contact-phone"
            label={strings.fieldPhone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required={showProfessionalFields}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <TextField
            id="contact-company"
            label={strings.fieldCompany}
            autoComplete="organization"
            required={showProfessionalFields}
            error={errors.companyName?.message}
            {...register('companyName')}
          />
        </div>
        <TextField
          id="contact-role"
          label={strings.fieldRole}
          autoComplete="organization-title"
          required={showProfessionalFields}
          error={errors.role?.message}
          {...register('role')}
        />
      </div>

      <TextAreaField
        id="contact-message"
        label={strings.fieldMessage}
        hint={strings.fieldMessageHint}
        rows={6}
        required
        showCounter
        maxLength={2000}
        error={errors.message?.message}
        {...register('message')}
      />

      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm text-encre">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-encre"
            aria-invalid={errors.gdprConsent ? 'true' : undefined}
            {...register('gdprConsent')}
          />
          <span>
            {strings.gdprConsentText}{' '}
            <Link
              href="/mentions-legales"
              className="underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
            >
              {strings.gdprConsentLink}
            </Link>
            .
          </span>
        </label>
        {errors.gdprConsent?.message && (
          <p role="alert" className="text-xs text-encre">
            {errors.gdprConsent.message}
          </p>
        )}

        <label className="flex items-start gap-3 text-sm text-encre">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-encre"
            {...register('newsletterOptIn')}
          />
          <span>{strings.newsletterConsent}</span>
        </label>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={status === 'submitting'}
        >
          {strings.submit}
        </Button>
        {networkError && (
          <ErrorState email={CONTACT_EMAIL} body={strings.errorBody} />
        )}
      </div>
    </form>
  );
}
