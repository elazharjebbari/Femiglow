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

const CONTACT_EMAIL = 'contact@femiglow.ma';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface ContactFormProps {
  defaultType?: ContactType;
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
export function ContactForm({ defaultType = 'question' }: ContactFormProps) {
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
    return <SuccessState />;
  }

  const showOrderField = type === 'order';
  const showProfessionalFields = type === 'professional';
  const networkError = status === 'error' && Object.keys(errors).length === 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      <FormTypeSelector
        value={type}
        onChange={(next) => setValue('type', next, { shouldValidate: true })}
      />

      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="contact-website">Site web (ne pas remplir)</label>
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
          label="Votre prénom"
          autoComplete="given-name"
          required
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          id="contact-email"
          label="Votre email"
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
          label="Numéro de commande"
          hint="Le numéro figure dans votre email de confirmation."
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
            label="Téléphone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required={showProfessionalFields}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <TextField
            id="contact-company"
            label="Raison sociale"
            autoComplete="organization"
            required={showProfessionalFields}
            error={errors.companyName?.message}
            {...register('companyName')}
          />
        </div>
        <TextField
          id="contact-role"
          label="Votre fonction"
          autoComplete="organization-title"
          required={showProfessionalFields}
          error={errors.role?.message}
          {...register('role')}
        />
      </div>

      <TextAreaField
        id="contact-message"
        label="Votre message"
        hint="Au moins 20 caractères, pour que nous puissions répondre justement."
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
            J{'\u2019'}accepte que mon message soit lu par la maison FemiGlow afin
            d{'\u2019'}y répondre. Voir nos{' '}
            <Link
              href="/mentions-legales"
              className="underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
            >
              mentions légales
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
          <span>
            Je souhaite recevoir la lettre saisonnière. Une lettre par saison.
            Aucun envoi commercial.
          </span>
        </label>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={status === 'submitting'}
        >
          Envoyer mon message
        </Button>
        {networkError && <ErrorState email={CONTACT_EMAIL} />}
      </div>
    </form>
  );
}
