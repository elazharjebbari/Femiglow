'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { emailSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTracking } from '@/lib/tracking/use-tracking';
import { TextField } from './Field';

const newsletterFormSchema = z.object({
  email: emailSchema,
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement est requis pour s\u2019inscrire.' }),
  }),
  website: z.string().max(0).optional(),
});

type NewsletterFormValues = z.infer<typeof newsletterFormSchema>;

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * @tracking-category newsletter
 * @tracking-events newsletter_submit, generate_lead
 * @tracking-description Formulaire newsletter — newsletter_submit (intent) + generate_lead (succès).
 */
interface NewsletterFormProps {
  variant?: 'inline' | 'block';
  source?: string;
}

export function NewsletterForm({ variant = 'block', source = 'unknown' }: NewsletterFormProps) {
  const { emit } = useTracking();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterFormSchema),
    defaultValues: { email: '', consent: false as unknown as true, website: '' },
    mode: 'onBlur',
  });
  const emailId = useId();
  const consentId = useId();
  const honeypotId = useId();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting');
    setErrorMessage(null);
    emit('newsletter_submit', { source, method: 'newsletter_form' });
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, consent: true, source }),
      });
      if (!response.ok) {
        throw new Error('Réponse serveur invalide.');
      }
      setStatus('success');
      emit('generate_lead', {
        source,
        method: 'newsletter',
        identity: { email: values.email },
      });
      reset();
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Un instant — l\u2019inscription n\u2019a pas pu aboutir. Réessayez plus tard.',
      );
    }
  });

  if (status === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-sauge-dark/30 bg-sauge-soft/40 p-6 text-encre"
      >
        <Text size="lead" italic family="display">
          Bienvenue.
        </Text>
        <Text size="small" tone="secondary" className="mt-2">
          Vous recevrez une lettre par saison. Aucun envoi commercial.
        </Text>
      </div>
    );
  }

  const consentError = errors.consent?.message;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={
        variant === 'inline'
          ? 'flex flex-col gap-4 sm:flex-row sm:items-end'
          : 'flex flex-col gap-5'
      }
    >
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        id={honeypotId}
        {...register('website')}
        className="absolute left-[-9999px] h-px w-px opacity-0"
      />

      <div className={variant === 'inline' ? 'flex-1' : ''}>
        <TextField
          id={emailId}
          label="Votre adresse email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="prenom@maison.ma"
          required
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size={variant === 'inline' ? 'md' : 'lg'}
        loading={status === 'submitting'}
        fullWidth={variant === 'block'}
      >
        {variant === 'inline' ? 'M\u2019inscrire' : 'Recevoir la lettre'}
      </Button>

      <div className="flex items-start gap-3 text-sm text-encre/70">
        <input
          id={consentId}
          type="checkbox"
          {...register('consent')}
          className="mt-1 h-4 w-4 accent-encre"
          aria-describedby={consentError ? `${consentId}-error` : undefined}
          aria-invalid={consentError ? 'true' : undefined}
        />
        <label htmlFor={consentId} className="cursor-pointer leading-snug">
          J’accepte de recevoir la lettre de la maison FemiGlow. Une lettre par
          saison, jamais d’envoi commercial. Désinscription en un clic.
        </label>
      </div>
      {consentError && (
        <p id={`${consentId}-error`} role="alert" className="text-sm text-red-700">
          {consentError}
        </p>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
