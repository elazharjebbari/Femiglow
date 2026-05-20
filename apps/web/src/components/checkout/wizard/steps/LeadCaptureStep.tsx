'use client';

/**
 * CHA-230 — Step 1 du wizard : capture lead (prénom + téléphone + consent).
 *
 * Design :
 *   - Voix FemiGlow : sobre, mesurée, jamais oppressante.
 *   - Champs minimaux — on demande UNIQUEMENT ce qui est nécessaire à la
 *     finalisation (l'email vient au step 4 en opt-in).
 *   - Validation client (React Hook Form + Zod) miroir du serveur, avec
 *     traduction française des erreurs.
 *   - États : idle / submitting / error. Le success est implicite (le shell
 *     route vers Step 2).
 *
 * Tracking :
 *   - À l'affichage : émet `begin_checkout` (signal de tunnel ouvert).
 *   - Au submit : `useLeadCaptureMutation` émet `lead_capture` (conversion).
 *
 * A11y :
 *   - Le bouton est désactivé tant que les champs ne sont pas valides
 *     (pas de "soumettre puis voir des erreurs partout").
 *   - Les erreurs sont annoncées via `role="alert"` et liées via
 *     `aria-describedby`.
 *   - L'autocomplete navigateur est activé (`given-name`, `tel`).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/forms/Field';
import { phoneMaroc9DigitsSchema } from '@/lib/checkout/schemas/common';
import {
  DEFAULT_CONSENT_VERSION,
  useWizardStore,
} from '@/lib/checkout/state/wizard-store';
import { useLeadCaptureMutation } from '@/lib/checkout/state/use-wizard-mutations';
import type { WizardContext } from '@/lib/tracking/checkout-events';
import { useCheckoutIntentTrigger } from '@/lib/tracking/use-checkout-intent';
import { useFormTracking } from '@/lib/tracking/use-form-tracking';

// ─────────────────────────────────────────────────────────────────────────────
// Schema validation client
// ─────────────────────────────────────────────────────────────────────────────

const leadCaptureFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'Votre prénom (au moins 2 caractères).')
    .max(60, 'Prénom trop long.'),
  /**
   * Phone — on accepte tous les formats raw côté UI (avec espaces, tiret,
   * préfixe +212 ou 0). Le `.transform` normalise en 9 chiffres avant
   * envoi serveur (validation finale par phoneMaroc9DigitsSchema).
   */
  phone: z
    .string()
    .trim()
    .min(9, 'Numéro de téléphone requis.')
    .transform((raw) => {
      const cleaned = raw.replace(/[\s\-().]/gu, '');
      if (/^\+212[5-7]\d{8}$/u.test(cleaned)) return cleaned.slice(4);
      if (/^00212[5-7]\d{8}$/u.test(cleaned)) return cleaned.slice(5);
      if (/^0[5-7]\d{8}$/u.test(cleaned)) return cleaned.slice(1);
      return cleaned;
    })
    .pipe(phoneMaroc9DigitsSchema),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Acceptation requise pour continuer.' }),
  }),
  /** Honeypot — doit rester vide. */
  website: z.string().max(0).optional(),
});

type LeadCaptureFormValues = z.input<typeof leadCaptureFormSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface LeadCaptureStepProps {
  cta?: string;
  title?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LeadCaptureStep({ cta, title }: LeadCaptureStepProps) {
  const firstNameId = useId();
  const phoneId = useId();
  const consentId = useId();
  const honeypotId = useId();

  const formContext = useWizardStore((s) => s.formContext);
  const cartSnapshot = useWizardStore((s) => s.cartSnapshot);
  const leadDraft = useWizardStore((s) => s.leadDraft);
  const mergeLeadDraft = useWizardStore((s) => s.mergeLeadDraft);

  // checkout_intent — fire à la 1ère frappe (≥1 char) dans le premier
  // champ remplie. Idempotent par form_id. Cf. event-mapping.ts pour le
  // routing GA4 begin_checkout / Meta InitiateCheckout / Ads conv.
  const intentCtx: WizardContext | null = formContext
    ? {
        form_id: formContext.formId,
        form_mode: formContext.formMode,
        step_name: 'lead',
        variant_key: formContext.variantKey,
      }
    : null;
  const { handleInputChange: triggerCheckoutIntent } = useCheckoutIntentTrigger({
    ctx: intentCtx ?? {
      form_id: 'wizard',
      form_mode: 'wizard_embed',
      step_name: 'lead',
      variant_key: null,
    },
    value: cartSnapshot ? cartSnapshot.totalCents / 100 : undefined,
    items: (cartSnapshot?.items ?? []).map((it) => ({
      item_id: it.sku,
      item_name: it.name,
      price: it.unitPriceCents / 100,
      quantity: it.quantity,
    })),
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isValid },
  } = useForm<LeadCaptureFormValues>({
    resolver: zodResolver(leadCaptureFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: leadDraft.firstName ?? '',
      phone: leadDraft.phone ?? '',
      // RHF refuse `false as true` strict — on bypass volontairement.
      consent: (leadDraft.consent === true ? true : (false as unknown as true)) as true,
      website: '',
    },
  });

  const mutation = useLeadCaptureMutation();

  // `form_start` continue à être émis au 1er focus (engagement signal),
  // mais le client de tracking dedupe désormais sur une fenêtre courte
  // (cf. DEFAULT_REDUNDANCY['form_start']) pour neutraliser les doubles
  // mounts Mode A + Mode B. `checkout_intent` couvre l'intent fort.
  const { handleFieldFocus } = useFormTracking({
    formId: formContext?.formId ?? 'wizard',
    formMode: formContext?.formMode,
    trackAbandon: false,
  });

  // Persiste le draft à chaque change (resume après refresh).
  const watchedFirstName = watch('firstName');
  const watchedPhone = watch('phone');
  const watchedConsent = watch('consent');
  useEffect(() => {
    mergeLeadDraft({
      firstName: typeof watchedFirstName === 'string' ? watchedFirstName : '',
      phone: typeof watchedPhone === 'string' ? watchedPhone : '',
      consent: watchedConsent === true,
      consentVersion: DEFAULT_CONSENT_VERSION,
    });
  }, [watchedFirstName, watchedPhone, watchedConsent, mergeLeadDraft]);

  const onSubmit = handleSubmit(async (values) => {
    // Honeypot — bot ? on accepte silencieusement et on s'arrête.
    if (values.website && values.website.length > 0) return;

    // NB : `begin_checkout` n'est plus émis ici. Le signal d'intent est
    // désormais porté par `checkout_intent` (1ère frappe — cf. plus haut).

    try {
      await mutation.execute({
        firstName: values.firstName,
        // Après transform du schema, `phone` est en 9 chiffres.
        phone: values.phone,
        consent: true,
        consentVersion: DEFAULT_CONSENT_VERSION,
      });
    } catch (err) {
      // L'erreur est déjà dans `mutation.error` — on essaie de mapper
      // sur un champ si possible.
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code: string }).code
          : null;
      if (code === 'invalid_input') {
        setError('phone', {
          type: 'server',
          message: 'Un champ n\u2019a pas été accepté. Vérifiez vos informations.',
        });
      }
      // Sinon : déjà affiché via mutation.error bandeau plus bas.
    }
  });

  const ctaLabel = cta ?? 'Continuer';
  const heading = title ?? 'Vos coordonnées';
  const submitting = mutation.status === 'loading';

  // Erreur réseau ou serveur non-mappée.
  const networkBanner = useMemo(() => {
    if (!mutation.error) return null;
    const e = mutation.error;
    if (e.code === 'invalid_input') return null; // déjà mappé sur les champs
    if (e.code === 'rate_limited')
      return 'Trop d\u2019envois. Réessayez dans quelques instants.';
    if (e.httpStatus === 0)
      return 'Connexion réseau impossible. Vérifiez votre réseau, puis réessayez.';
    return e.message || 'Un instant — la commande n\u2019a pas pu démarrer. Réessayez.';
  }, [mutation.error]);

  return (
    <section
      aria-labelledby={`${firstNameId}-heading`}
      className="space-y-7"
      data-testid="wizard-step-lead"
    >
      <header className="space-y-2">
        <Heading
          as="h2"
          size="md"
          id={`${firstNameId}-heading`}
          italic="always"
        >
          {heading}
        </Heading>
        <Text size="small" tone="secondary">
          Deux informations seulement — nous vous rappelons pour confirmer.
        </Text>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-7">
        {/* Honeypot */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        >
          <label htmlFor={honeypotId}>Site web (ne pas remplir)</label>
          <input
            id={honeypotId}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register('website')}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {(() => {
            const firstNameProps = register('firstName');
            const phoneProps = register('phone');
            return (
              <>
                <TextField
                  id={firstNameId}
                  label="Votre prénom"
                  autoComplete="given-name"
                  inputMode="text"
                  required
                  error={errors.firstName?.message}
                  placeholder="Yasmine"
                  {...firstNameProps}
                  onFocus={handleFieldFocus('firstName')}
                  onChange={(e) => {
                    void firstNameProps.onChange(e);
                    triggerCheckoutIntent('firstName', e.target.value);
                  }}
                />
                <TextField
                  id={phoneId}
                  label="Téléphone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="06 12 34 56 78"
                  hint="Numéro mobile Maroc. Format +212 6 XX XX XX XX."
                  error={errors.phone?.message}
                  {...phoneProps}
                  onFocus={handleFieldFocus('phone')}
                  onChange={(e) => {
                    void phoneProps.onChange(e);
                    triggerCheckoutIntent('phone', e.target.value);
                  }}
                />
              </>
            );
          })()}
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm text-encre">
            <input
              id={consentId}
              type="checkbox"
              className="mt-1 h-4 w-4 accent-encre"
              aria-invalid={errors.consent ? 'true' : undefined}
              {...register('consent')}
            />
            <span>
              J&rsquo;accepte d&rsquo;être contactée par la maison FemiGlow pour
              ma commande. Voir nos{' '}
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
          {errors.consent?.message && (
            <p role="alert" className="text-xs text-petale-dark">
              {errors.consent.message}
            </p>
          )}
        </div>

        {networkBanner && (
          <div
            role="alert"
            className="rounded border border-petale-dark/30 bg-petale-soft/30 p-4 text-sm text-encre"
          >
            {networkBanner}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!isValid || submitting}
            data-testid="wizard-lead-submit"
            fullWidth
          >
            {ctaLabel}
          </Button>
        </div>
      </form>
    </section>
  );
}
