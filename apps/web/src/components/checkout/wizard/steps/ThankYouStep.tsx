'use client';

/**
 * CHA-230 / CHA-231 — Step final du wizard : confirmation + opt-in email transactionnel.
 *
 * Évolution CHA-231
 * ─────────────────
 * Le bloc « Rester en contact (newsletter) » est remplacé par « Recevoir la
 * confirmation de commande par email ». La nature du consentement change :
 *   - avant : opt-in marketing (newsletter saisonnière)
 *   - après : opt-in transactionnel (confirmation + suivi)
 *
 * Côté serveur, l'endpoint reste `/api/checkout/order/[id]/email`. La sémantique
 * UX change ; le tracking distingue l'event (`order_confirmation_optin`) plutôt
 * que `newsletter_signup`. La newsletter reste accessible via le footer du site.
 *
 * Design
 * ──────
 * - Message principal court, posé, conforme à la voix FemiGlow.
 * - Référence d'order affichée pour permettre au client de la mentionner.
 * - Bloc opt-in en card creme, isolé visuellement.
 *
 * Comportement
 * ────────────
 * - Submit → PATCH `/order/[id]/email` avec `emailConsent=true`.
 *   Succès → message de confirmation discret avec l'adresse envoyée.
 *   Échec  → bandeau d'erreur, retry possible.
 * - L'email n'est PAS persisté dans le wizardStore (vit le temps du formulaire).
 *
 * A11y
 * ────
 * - `role="status"` sur la confirmation principale (annoncé après navigation).
 * - Form opt-in entièrement labellisé via FieldShell.
 * - Bouton désactivé tant que email + consent ne sont pas valides.
 */

import { useCallback, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/forms/Field';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { emailSchema } from '@/lib/checkout/schemas/common';
import { useOrderEmailConfirmationMutation } from '@/lib/checkout/state/use-wizard-mutations';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ThankYouStepProps {
  /** Override optionnel du titre (sinon dictionnaire i18n). */
  title?: string;
  /** Override optionnel du sous-titre (sinon dictionnaire i18n). */
  subtitle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ThankYouStep({ title, subtitle }: ThankYouStepProps) {
  const emailId = useId();
  const consentId = useId();
  const { t } = useWizardTranslation();

  const orderId = useWizardStore((s) => s.orderId);

  const optIn = useOrderEmailConfirmationMutation();

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  const canSubmit = useMemo(() => {
    if (optIn.status === 'loading' || optIn.status === 'success') return false;
    if (!consent) return false;
    return emailSchema.safeParse(email).success;
  }, [email, consent, optIn.status]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      try {
        await optIn.execute({ email, emailConsent: true });
      } catch {
        // déjà capturé dans optIn.error
      }
    },
    [canSubmit, email, optIn],
  );

  const errorBanner = useMemo(() => {
    if (!optIn.error) return null;
    const e = optIn.error;
    if (e.code === 'rate_limited') return t.errors.rateLimited;
    if (e.httpStatus === 0) return t.errors.networkOffline;
    return e.message || t.errors.emailGeneric;
  }, [optIn.error, t.errors]);

  const resolvedTitle = title ?? t.thankYou.title;
  const resolvedSubtitle = subtitle ?? t.thankYou.subtitle;

  return (
    <section
      aria-labelledby="wizard-thankyou-heading"
      className="space-y-8"
      data-testid="wizard-step-thankyou"
    >
      <header className="space-y-3" role="status" aria-live="polite">
        <Heading
          as="h2"
          size="lg"
          italic="always"
          id="wizard-thankyou-heading"
        >
          {resolvedTitle}
        </Heading>
        <Text tone="secondary">{resolvedSubtitle}</Text>
      </header>

      {orderId && (
        <div
          className="rounded border border-encre/15 bg-white p-4 space-y-1"
          data-testid="wizard-thankyou-orderref"
        >
          <Text size="small" tone="secondary">
            {t.thankYou.orderRefLabel}
          </Text>
          <Text size="small" className="font-mono text-encre">
            {orderId}
          </Text>
        </div>
      )}

      <div className="rounded border border-encre/15 bg-creme p-5 space-y-4">
        <div className="space-y-1">
          <Heading as="h3" size="sm" italic="always">
            {t.thankYou.emailConfirmationTitle}
          </Heading>
          <Text size="small" tone="secondary">
            {t.thankYou.emailConfirmationSubtitle}
          </Text>
        </div>

        {optIn.status === 'success' ? (
          <p
            role="status"
            className="text-sm leading-[1.6] text-encre"
            data-testid="wizard-email-confirmation-success"
          >
            {t.thankYou.success(email)}
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="space-y-4"
            aria-label={t.thankYou.emailConfirmationTitle}
          >
            <TextField
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              label={t.thankYou.emailLabel}
              required
              placeholder={t.thankYou.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="wizard-email-confirmation-email"
            />

            <label className="flex items-start gap-3 text-xs text-encre/80">
              <input
                id={consentId}
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-encre"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                data-testid="wizard-email-confirmation-consent"
              />
              <span>{t.thankYou.consentLabel}</span>
            </label>

            {errorBanner && (
              <p
                role="alert"
                className="text-xs text-petale-dark"
                data-testid="wizard-email-confirmation-error"
              >
                {errorBanner}
              </p>
            )}

            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={optIn.status === 'loading'}
              disabled={!canSubmit}
              data-testid="wizard-email-confirmation-submit"
            >
              {t.thankYou.ctaSubmit}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
