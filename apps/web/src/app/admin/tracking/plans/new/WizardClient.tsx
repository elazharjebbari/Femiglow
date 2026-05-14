'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  trackingPlanApi,
  useWizardStore,
  ApiError,
  WIZARD_STEPS,
  type WizardStep,
} from '@/lib/tracking/plan/client';
import type { TrackingPlanInput } from '@/lib/tracking/plan/types';
import { WizardStepper } from '@/components/admin/tracking/plans/WizardStepper';
import { StepProviders } from '@/components/admin/tracking/plans/wizard/StepProviders';
import { StepEnvProfiles } from '@/components/admin/tracking/plans/wizard/StepEnvProfiles';
import { StepEvents } from '@/components/admin/tracking/plans/wizard/StepEvents';
import { StepSettings } from '@/components/admin/tracking/plans/wizard/StepSettings';
import { StepReview } from '@/components/admin/tracking/plans/wizard/StepReview';

export type WizardMode = 'create' | 'edit';

interface WizardClientProps {
  mode?: WizardMode;
  initialPlan?: TrackingPlanInput;
  planId?: string;
  expectedVersion?: number;
}

export function WizardClient({
  mode = 'create',
  initialPlan,
  planId,
  expectedVersion,
}: WizardClientProps = {}): JSX.Element {
  const router = useRouter();
  const {
    step,
    draft,
    dirty,
    setStep,
    nextStep,
    previousStep,
    setProviders,
    setEnvProfiles,
    setEvents,
    setSettings,
    patchDraft,
    markSaved,
    resetDraft,
    hydrateFromPlan,
  } = useWizardStore();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && initialPlan && planId) {
      hydrateFromPlan(initialPlan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, planId]);

  async function save(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'edit' && planId && typeof expectedVersion === 'number') {
        const plan = await trackingPlanApi.update(planId, draft, expectedVersion);
        markSaved();
        resetDraft();
        router.push(`/admin/tracking/plans/${plan.id}`);
      } else {
        const plan = await trackingPlanApi.create(draft);
        markSaved();
        resetDraft();
        router.push(`/admin/tracking/plans/${plan.id}`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`${e.code} — ${e.message}`);
      } else {
        setError('Erreur inattendue lors de l\'enregistrement.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isLast = WIZARD_STEPS.indexOf(step) === WIZARD_STEPS.length - 1;
  const saveLabel = mode === 'edit' ? 'Enregistrer les modifications' : 'Enregistrer le brouillon';

  return (
    <div>
      <WizardStepper current={step} onSelect={(s: WizardStep) => setStep(s)} />

      <div className="rounded-md border border-stone-200 bg-white p-6 shadow-sm">
        {step === 'providers' && (
          <StepProviders providers={draft.providers} onChange={setProviders} />
        )}
        {step === 'envProfiles' && (
          <StepEnvProfiles
            providers={draft.providers}
            profiles={draft.envProfiles}
            onChange={setEnvProfiles}
          />
        )}
        {step === 'events' && (
          <StepEvents
            providers={draft.providers}
            events={draft.events}
            onChange={setEvents}
          />
        )}
        {step === 'settings' && (
          <StepSettings settings={draft.settings ?? {}} onChange={setSettings} />
        )}
        {step === 'review' && (
          <StepReview
            draft={draft}
            name={draft.name}
            onChangeName={(name) => patchDraft({ name })}
          />
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={previousStep}
          disabled={step === WIZARD_STEPS[0]}
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹ Précédent
        </button>

        {dirty && (
          <span className="text-xs text-stone-500" aria-live="polite">
            Brouillon non sauvegardé
          </span>
        )}

        {isLast ? (
          <button
            type="button"
            onClick={save}
            disabled={submitting || !draft.name}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : saveLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={nextStep}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Suivant ›
          </button>
        )}
      </div>
    </div>
  );
}
