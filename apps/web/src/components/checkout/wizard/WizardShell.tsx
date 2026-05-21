'use client';

/**
 * CHA-230 — Shell du wizard checkout.
 *
 * Responsabilité unique : monter le state store avec le bon `formContext`,
 * afficher l'indicateur de progression, et router vers le step courant.
 *
 * Le shell est :
 *  - SSR-safe : ne touche au store qu'après hydration (`useWizardHydrated`)
 *  - **isolé** : aucune dépendance à React Router / Next pathname pour la
 *    navigation interne entre steps (le state store est la SSOT)
 *  - **réutilisable** : Mode A (embed sur /kit) et Mode B (full page sur
 *    /commander) consomment le même shell avec des props différentes
 *
 * Les steps suivants (Address, Payment, Thank-You) sont chargés en lazy
 * pour réduire le bundle initial du LeadCaptureStep — important pour la
 * perf perçue (FCP) du /kit qui doit rester sub-2s.
 */

import { Suspense, lazy, useEffect, useMemo, useRef, type ReactNode } from 'react';

import {
  selectCanProceedFromLead,
  useWizardHydrated,
  useWizardStore,
  type WizardFormContext,
} from '@/lib/checkout/state/wizard-store';
import type { CartSnapshot, StepName } from '@/lib/checkout/schemas/common';

import { WizardStepIndicator } from './WizardStepIndicator';
import { TimeEstimateBadge } from './TimeEstimateBadge';
import { WizardCartRecap } from './WizardCartRecap';
import { LeadCaptureStep } from './steps/LeadCaptureStep';
import {
  DEFAULT_WIZARD_COPY,
  DEFAULT_WIZARD_FEATURES,
} from '@/lib/checkout/copy/wizard-copy';

// Steps lazy-loaded — pas encore implémentés (phases 6-7).
// On garde la structure pour ne pas avoir à modifier le shell à chaque
// nouvelle phase. Le fallback affiche un message neutre tant que le step
// n'est pas chargé.
const AddressStep = lazy(() =>
  import('./steps/AddressStep')
    .then((m) => ({ default: m.AddressStep }))
    .catch(() => ({ default: () => <StepUnavailable name="address" /> })),
);
const ThankYouStep = lazy(() =>
  import('./steps/ThankYouStep')
    .then((m) => ({ default: m.ThankYouStep }))
    .catch(() => ({ default: () => <StepUnavailable name="thank_you" /> })),
);
const CartReviewStep = lazy(() =>
  import('./steps/CartReviewStep')
    .then((m) => ({ default: m.CartReviewStep }))
    .catch(() => ({ default: () => <StepUnavailable name="cart_review" /> })),
);

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardShellProps {
  /** Identité du form (clef stable pour tracking + form-config). */
  formContext: WizardFormContext;
  /** Steps à afficher (ordre + nombre). Source : `form_config.config.steps`. */
  steps: StepName[];
  /** Snapshot du panier injecté côté serveur (Mode B). Mode A peut omettre. */
  initialCart?: CartSnapshot;
  /** Textes (CTA, titre). Source : `form_config.config.copy`. */
  copy?: {
    title?: string;
    ctaLead?: string;
    ctaAddress?: string;
    /** @deprecated CHA-231 — plus de step paiement UI. */
    ctaPayment?: string;
    thankYouTitle?: string;
    thankYouSubtitle?: string;
  };
  /**
   * @deprecated CHA-231 — le step paiement a été supprimé du parcours UI.
   * Conservé pour rétro-compat des call-sites existants ; sera retiré en
   * itération suivante.
   */
  paymentMethods?: Array<'cod' | 'bank_transfer' | 'card'>;
  /** Slot custom au-dessus du wizard (ex. titre produit en Mode A). */
  header?: ReactNode;
  /** Slot custom en dessous (ex. recap panier en Mode A). */
  footer?: ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────────────────

function StepUnavailable({ name }: { name: StepName }) {
  return (
    <div className="rounded border border-encre/15 bg-creme p-6 text-sm text-encre/60">
      L&apos;étape «&nbsp;{name}&nbsp;» n&apos;est pas encore disponible.
    </div>
  );
}

function HydrationFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-[320px] place-items-center text-sm text-encre/50"
    >
      Un instant…
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main shell
// ─────────────────────────────────────────────────────────────────────────────

export function WizardShell({
  formContext,
  steps,
  initialCart,
  copy,
  paymentMethods,
  header,
  footer,
}: WizardShellProps) {
  const hydrated = useWizardHydrated();
  const currentStep = useWizardStore((s) => s.currentStep);
  const storedFormContext = useWizardStore((s) => s.formContext);
  const storedCart = useWizardStore((s) => s.cartSnapshot);
  const setFormContext = useWizardStore((s) => s.setFormContext);
  const setCartSnapshot = useWizardStore((s) => s.setCartSnapshot);
  const goToStep = useWizardStore((s) => s.goToStep);
  const leadId = useWizardStore((s) => s.leadId);

  // Snycro formContext une fois hydraté. Si la persisted version diffère
  // (ex. user a changé d'A/B variant), on overrides — la source de vérité
  // est ce qui est passé en props par le serveur.
  useEffect(() => {
    if (!hydrated) return;
    const needsUpdate =
      !storedFormContext ||
      storedFormContext.formId !== formContext.formId ||
      storedFormContext.formMode !== formContext.formMode ||
      storedFormContext.variantKey !== formContext.variantKey;
    if (needsUpdate) setFormContext(formContext);
  }, [hydrated, storedFormContext, formContext, setFormContext]);

  // Snapshot panier : si fourni en props et différent du persisted, écrase.
  useEffect(() => {
    if (!hydrated) return;
    if (!initialCart) return;
    const stableSign = (snap: CartSnapshot | null) =>
      snap ? `${snap.totalCents}:${snap.items.length}:${snap.items.map((i) => i.sku).join('|')}` : '';
    if (stableSign(storedCart) !== stableSign(initialCart)) {
      setCartSnapshot(initialCart);
    }
  }, [hydrated, initialCart, storedCart, setCartSnapshot]);

  // Si l'étape persistée n'est plus dans `steps` (config a changé), reset
  // vers la première.
  useEffect(() => {
    if (!hydrated) return;
    if (!steps.includes(currentStep)) goToStep(steps[0] ?? 'lead');
  }, [hydrated, currentStep, steps, goToStep]);

  // Garde initiale (one-shot) : aligne l'étape persistée avec la première
  // étape déclarée par la config Mode A/B. Cas concret : Mode B (commander)
  // dont `steps[0]='cart_review'` mais le store global a `INITIAL.currentStep='lead'`.
  // Sans cette garde, un nouvel utilisateur Mode B sauterait cart_review.
  // Elle ne fire qu'une seule fois (au premier hydrated=true) pour ne pas
  // empêcher la navigation user-initiée vers les steps suivants.
  const didInitStepRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (didInitStepRef.current) return;
    didInitStepRef.current = true;
    if (leadId) return; // Si déjà progressé, on respecte l'état persisté.
    const firstStep = steps[0];
    if (!firstStep) return;
    if (currentStep !== firstStep && steps.indexOf(currentStep) > 0) {
      goToStep(firstStep);
    }
  }, [hydrated, leadId, currentStep, steps, goToStep]);

  // Garde permanente : empêche de naviguer vers `address`/`thank_you` sans
  // lead créé. Indispensable au cas où l'utilisateur manipule le state
  // (DevTools, query param, etc.) ou si le lead a été invalidé côté serveur.
  // CHA-231 : `payment` ne fait plus partie du parcours UI mais on conserve
  // la garde par sécurité si un state legacy persisté pointait encore vers
  // cette étape.
  useEffect(() => {
    if (!hydrated) return;
    if (
      !leadId &&
      (currentStep === 'address' ||
        currentStep === 'payment' ||
        currentStep === 'thank_you')
    ) {
      goToStep('lead');
    }
  }, [hydrated, leadId, currentStep, goToStep]);

  const stepView = useMemo(() => {
    switch (currentStep) {
      case 'cart_review':
        return <CartReviewStep />;
      case 'lead':
        return <LeadCaptureStep cta={copy?.ctaLead} title={copy?.title} />;
      case 'address':
        return <AddressStep cta={copy?.ctaAddress} />;
      case 'thank_you':
        return (
          <ThankYouStep
            title={copy?.thankYouTitle}
            subtitle={copy?.thankYouSubtitle}
          />
        );
      // CHA-231 : `payment` n'est plus un step UI. Si un state persisté legacy
      // pointe encore vers 'payment', on tombe ici et on bascule en lead via
      // la garde plus haut. `StepUnavailable` reste un fallback robuste.
      case 'payment':
      default:
        return <StepUnavailable name={currentStep} />;
    }
  }, [currentStep, copy]);

  if (!hydrated) return <HydrationFallback />;

  // Debug-only — utile en dev pour vérifier que le state est synced.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    if (typeof window !== 'undefined') {
      (window as unknown as { __wizardState?: unknown }).__wizardState = {
        currentStep,
        leadId,
        canProceedFromLead: selectCanProceedFromLead(useWizardStore.getState()),
      };
    }
  }

  // Kolenda §5 W2 — réassurance temps + indicator enrichi.
  // Wizard-copy + features par défaut (W5 admin override viendra plus tard).
  const wizardCopy = DEFAULT_WIZARD_COPY;
  const features = DEFAULT_WIZARD_FEATURES;
  const stepTimes = features.timeEstimate
    ? {
        lead: wizardCopy.timeEstimateLead,
        address: wizardCopy.timeEstimateAddress,
        thank_you: wizardCopy.timeEstimateThankYou,
      }
    : undefined;

  // Cart à afficher : initial (props serveur) prioritaire, sinon
  // celui du store (hydraté). Empêche le clignotement « pas de cart »
  // pendant l'hydration.
  const cartForRecap = initialCart ?? storedCart ?? null;

  return (
    <div className="space-y-6" data-testid="wizard-shell">
      {/* Kolenda §5 W3 P1 — récap panier permanent en premier enfant.
          Sticky mobile pour rester visible pendant le scroll. */}
      {features.cartRecap && cartForRecap && (
        <WizardCartRecap cart={cartForRecap} priceCompareAt="390 MAD" />
      )}
      {header}
      {features.timeEstimate && (
        <TimeEstimateBadge label={wizardCopy.timeEstimateTotal} />
      )}
      <WizardStepIndicator
        steps={steps}
        currentStep={currentStep}
        timesPerStep={stepTimes}
      />
      <Suspense fallback={<HydrationFallback />}>{stepView}</Suspense>
      {footer}
    </div>
  );
}
