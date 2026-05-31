'use client';

/**
 * CHA-230 — StockIndicator
 *
 * Affiche le statut de stock d'un variant à proximité du formulaire
 * d'adresse, avec un message sobre. Trois états :
 *
 *   - `in_stock`     : pastille discrète « En stock » (réassurance).
 *   - `low_stock`    : message ambré « Il en reste X » (urgence légère
 *                       sans pression aggressive — voix FemiGlow).
 *   - `out_of_stock` : bannière + formulaire d'opt-in back-in-stock
 *                       (email ou téléphone, consent obligatoire).
 *
 * Comportement :
 *   - Fetch unique au mount via `wizardClient.getStock(variantId)`.
 *   - Cache HTTP géré par le serveur (s-maxage=10, SWR=30).
 *   - Pas de polling : l'utilisateur peut refresh manuellement (UX
 *     volontairement discrète, on ne crée pas de pression artificielle).
 *   - Si l'API échoue : on rend `null` silencieusement — le StockIndicator
 *     est une aide UX, pas un bloquant fonctionnel.
 *
 * A11y :
 *   - Statut annoncé via `role="status"` + `aria-live="polite"` pour les
 *     états non-bloquants.
 *   - Formulaire opt-in entièrement label-associé (cf. FieldShell).
 *
 * Tests :
 *   - Le composant est consommable avec un `fetchImpl` mock via
 *     `wizardClient` (cf. `state/use-wizard-mutations.test.ts`).
 */

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/forms/Field';
import { ApiError } from '@/lib/checkout/client/api-errors';
import { wizardClient } from '@/lib/checkout/client/wizard-client';
import { ensureVisitorId } from '@/lib/checkout/client/visitor-id';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { emailSchema } from '@/lib/checkout/schemas/common';
import type { GetStockResponse, StockStatus } from '@/lib/checkout/schemas/stock';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface StockIndicatorProps {
  /** Identifiant du variant (ex. `pvar_0c01jxc1yn4kjp3b`). */
  variantId: string;
  /** Classes additionnelles (positionnement parent). */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal hook : fetch stock une fois au mount, cancellable.
// ─────────────────────────────────────────────────────────────────────────────

type FetchState =
  | { status: 'loading' }
  | { status: 'success'; data: GetStockResponse }
  | { status: 'error'; error: ApiError };

function useStockSnapshot(variantId: string): FetchState {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {
      try {
        const data = await wizardClient.getStock(variantId, {
          signal: controller.signal,
        });
        if (cancelled) return;
        setState({ status: 'success', data });
      } catch (err) {
        if (cancelled) return;
        if (controller.signal.aborted) return;
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError('internal_error', 'Stock indisponible.', 500);
        setState({ status: 'error', error: apiErr });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [variantId]);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component : opt-in back-in-stock
// ─────────────────────────────────────────────────────────────────────────────

interface StockNotifyFormProps {
  variantId: string;
}

function StockNotifyForm({ variantId }: StockNotifyFormProps) {
  const { t } = useWizardTranslation();
  const emailId = useId();
  const consentId = useId();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitState, setSubmitState] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (submitState === 'loading') return false;
    if (!consent) return false;
    return emailSchema.safeParse(email).success;
  }, [email, consent, submitState]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitState('loading');
      setErrorMsg(null);
      try {
        const visitorId = ensureVisitorId() ?? 'v_unknown_visitor';
        const res = await fetch('/api/checkout/stock-notify', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variantId,
            email,
            visitorId,
            consent: true,
          }),
        });
        if (!res.ok) {
          let msg = t.stock.notifyErrorDefault;
          try {
            const body = (await res.json()) as { message?: string };
            if (body.message) msg = body.message;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }
        setSubmitState('success');
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : t.stock.notifyErrorUnexpected,
        );
        setSubmitState('error');
      }
    },
    [canSubmit, email, variantId, t.stock],
  );

  if (submitState === 'success') {
    return (
      <Text size="small" tone="secondary" className="text-encre">
        {t.stock.notifySuccess}
      </Text>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4"
      aria-label={t.stock.notifyFormAriaLabel}
    >
      <TextField
        id={emailId}
        type="email"
        inputMode="email"
        autoComplete="email"
        label={t.stock.notifyEmailLabel}
        required
        placeholder={t.stock.notifyEmailPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label className="flex items-start gap-3 text-xs text-encre/80">
        <input
          id={consentId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-encre"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>{t.stock.notifyConsentLabel}</span>
      </label>

      {errorMsg && (
        <p role="alert" className="text-xs text-petale-dark">
          {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={submitState === 'loading'}
        disabled={!canSubmit}
        data-testid="stock-notify-submit"
      >
        {t.stock.notifySubmit}
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual building blocks (par statut)
// ─────────────────────────────────────────────────────────────────────────────

function InStockPill() {
  const { t } = useWizardTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full bg-sauge-soft/30 px-3 py-1 text-xs text-encre/80"
      data-testid="stock-indicator-in-stock"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sauge-soft" />
      {t.stock.inStock}
    </div>
  );
}

function LowStockBanner({ count }: { count: number }) {
  const { t } = useWizardTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded border border-petale-dark/25 bg-petale-soft/30 px-3 py-2 text-xs text-encre"
      data-testid="stock-indicator-low-stock"
    >
      <span className="font-medium">{t.stock.lowStock(count)}</span>
      {t.stock.lowStockSuffix}
    </div>
  );
}

function OutOfStockBlock({ variantId }: { variantId: string }) {
  const { t } = useWizardTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-4 rounded border border-petale-dark/30 bg-petale-soft/30 p-4"
      data-testid="stock-indicator-out-of-stock"
    >
      <div className="space-y-1">
        <Text size="small" className="text-encre font-medium">
          {t.stock.outOfStockTitle}
        </Text>
        <Text size="small" tone="secondary">
          {t.stock.outOfStockBody}
        </Text>
      </div>
      <StockNotifyForm variantId={variantId} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function StockIndicator({ variantId, className }: StockIndicatorProps) {
  const state = useStockSnapshot(variantId);

  // Loading & error : volontairement silencieux (placeholder mince pour
  // éviter le CLS).
  if (state.status === 'loading') {
    return (
      <div
        className={className}
        aria-hidden="true"
        data-testid="stock-indicator-loading"
      >
        <div className="h-6 w-32 animate-pulse rounded bg-encre/5" />
      </div>
    );
  }
  if (state.status === 'error') return null;

  const status: StockStatus = state.data.status;
  return (
    <div className={className}>
      {status === 'in_stock' && <InStockPill />}
      {status === 'low_stock' && (
        <LowStockBanner count={Math.max(1, state.data.effectiveDisplay)} />
      )}
      {status === 'out_of_stock' && <OutOfStockBlock variantId={variantId} />}
    </div>
  );
}

