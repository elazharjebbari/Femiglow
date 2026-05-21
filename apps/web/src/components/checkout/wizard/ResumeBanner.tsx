/**
 * `ResumeBanner` — bandeau « Bon retour, {firstName} » affiché en haut
 * du LeadCaptureStep si la cliente revient avec un `leadDraft` persisté
 * (Kolenda §5 W4 P6, Trust #5 — memory & personalization).
 *
 * Comportement :
 *  - Émet `wizard_resume_shown` au mount (1 fois par session via
 *    guard `resumeBannerShown` Set côté store).
 *  - Auto-hide après `autoHideMs` (default 5000 ms).
 *  - Click ✕ → émet `wizard_resume_dismissed` + flag persistant
 *    `resumeBannerDismissed=true` (ne s'affichera plus dans les sessions
 *    suivantes, sauf reset complet du wizard).
 *
 * Client Component (state local visible + Zustand actions).
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { formatResumeBanner } from '@/lib/checkout/helpers/resume-banner-template';

export interface ResumeBannerProps {
  firstName: string;
  /** Template `{firstName}` placeholder. Default copy module. */
  template?: string;
  /** Auto-hide après ms (0 = pas d'auto-hide). Default 5000. */
  autoHideMs?: number;
}

export function ResumeBanner({
  firstName,
  template = 'Bon retour, {firstName} — on reprend où vous en étiez.',
  autoHideMs = 5000,
}: ResumeBannerProps): JSX.Element | null {
  const { emit } = useTracking();
  const [visible, setVisible] = useState(true);
  const fired = useRef(false);
  const currentStep = useWizardStore((s) => s.currentStep);
  const markShown = useWizardStore((s) => s.markResumeBannerShown);
  const dismissPersist = useWizardStore((s) => s.dismissResumeBanner);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    emit('wizard_resume_shown', {
      step_name: currentStep === 'address' ? 'address' : 'lead',
      time_since_last_visit_ms: 0,
    });
    markShown();
    if (autoHideMs > 0) {
      const t = setTimeout(() => setVisible(false), autoHideMs);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [emit, currentStep, markShown, autoHideMs]);

  const handleDismiss = useCallback(() => {
    emit('wizard_resume_dismissed', {
      step_name: currentStep === 'address' ? 'address' : 'lead',
    });
    dismissPersist();
    setVisible(false);
  }, [emit, currentStep, dismissPersist]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="wizard-resume-banner"
      className="flex items-center justify-between gap-3 rounded border border-champagne-dark/25 bg-champagne-soft/40 px-3 py-2 text-sm text-encre"
    >
      <span>{formatResumeBanner(template, firstName)}</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fermer la bannière de bienvenue"
        data-testid="wizard-resume-dismiss"
        className="-mr-1 ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-encre/50 hover:text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-encre/40"
      >
        ✕
      </button>
    </div>
  );
}
