'use client';

/**
 * OWBS (F05) — Indicateur de synchronisation dégradée.
 *
 * Consomme `wizard-store.syncDegraded` (posé par `lead-sync-singleton.onDrop`
 * quand une envelope est abandonnée). Affiche un message **discret et non
 * bloquant** (`role="status"`, `aria-live="polite"`) avec une action « réessayer »
 * qui relance le flush de la file. La navigation reste totalement libre.
 *
 * Invariants testés (cf. docs/owbs-ui-test-battery-2026-06-02/F05) :
 *   - rien d'affiché si `syncDegraded=false` (zéro faux positif) ;
 *   - jamais une modale bloquante ;
 *   - « réessayer » efface le signal puis re-flushe (si ça redrop, onDrop le ré-arme).
 */
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { getLeadSyncQueue } from '@/lib/checkout/state/lead-sync-singleton';

const MESSAGES = {
  fr: {
    text: "Une information n'a pas pu être enregistrée. Vous pouvez continuer.",
    retry: 'Réessayer',
  },
  ar: {
    text: 'تعذّر حفظ بعض المعلومات. يمكنكِ المتابعة.',
    retry: 'إعادة المحاولة',
  },
  en: {
    text: 'Some information could not be saved. You can continue.',
    retry: 'Retry',
  },
} as const;

export function WizardSyncIndicator(): JSX.Element | null {
  const syncDegraded = useWizardStore((s) => s.syncDegraded);
  const clearSyncDegraded = useWizardStore((s) => s.clearSyncDegraded);
  const language = useWizardStore((s) => s.formContext?.language);

  if (!syncDegraded) return null;

  const m = MESSAGES[(language as keyof typeof MESSAGES) ?? 'fr'] ?? MESSAGES.fr;

  const onRetry = (): void => {
    // On efface tout de suite (l'indicateur disparaît) puis on retente la sync.
    // Si une envelope redrop, `onDrop` ré-arme `syncDegraded` → l'indicateur revient.
    clearSyncDegraded();
    void getLeadSyncQueue().flush();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="wizard-sync-indicator"
      className="flex items-center justify-between gap-3 rounded-xl border border-champagne/40 bg-champagne/15 px-3 py-2 text-xs text-encre/80"
    >
      <span>{m.text}</span>
      <button
        type="button"
        onClick={onRetry}
        data-testid="wizard-sync-retry"
        className="shrink-0 font-medium text-encre underline underline-offset-2 hover:text-encre/70"
      >
        {m.retry}
      </button>
    </div>
  );
}
