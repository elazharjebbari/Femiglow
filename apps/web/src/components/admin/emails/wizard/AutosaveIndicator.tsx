'use client';

/**
 * AutosaveIndicator — état observable de l'autosave du wizard (F05 P3.2-c, G14).
 *
 * Affiche, en zone vive NON intrusive (aria-live), l'état courant de
 * l'enregistrement automatique : « Enregistrement… », « ✓ Enregistré il y a Ns »
 * (âge qui court honnêtement), échec, conflit.
 *
 * Pourquoi PAS `role="status"`/`role="alert"` : l'écran porte déjà des zones live
 * métier (estimation, feedback test-send, blocage envoi) interrogées par
 * `getByRole('status'|'alert')` — un role dupliqué casserait ces requêtes.
 * `aria-live="polite"` annonce les changements sans conférer de role concurrent.
 *
 * Couleurs via tokens (INK, verrou G10) ; tick 1 s à l'état "saved" (cf.
 * Freshness) pour faire courir l'âge sans jamais le réinitialiser sans vrai save.
 */
import { useEffect, useState } from 'react';
import { INK } from '../ui/tokens';
import { formatAge } from '../ui/format-datetime';
import type { AutosaveStatus } from './use-campaign-autosave';

type View = { label: string; tone: keyof typeof INK };

export function AutosaveIndicator({
  status,
  savedAt,
}: {
  status: AutosaveStatus;
  savedAt: string | null;
}) {
  // Tick 1 s pour faire courir « il y a Ns » uniquement à l'état saved.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'saved' || !savedAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(t);
  }, [status, savedAt]);

  const view: View | null = (() => {
    switch (status) {
      case 'saving':
        return { label: 'Enregistrement…', tone: 'neutral' };
      case 'saved':
        return {
          label: savedAt ? `✓ Enregistré ${formatAge(savedAt)}` : '✓ Enregistré',
          tone: 'success',
        };
      case 'error':
        return {
          label: '⚠ Échec de l’enregistrement — il reprendra à la prochaine modification',
          tone: 'danger',
        };
      case 'conflict':
        return { label: '⚠ Conflit — recharge la page', tone: 'danger' };
      default:
        return null;
    }
  })();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-testid="autosave-status"
      data-status={status}
      className={`truncate text-xs ${view ? INK[view.tone] : 'text-stone-500'}`}
    >
      {view?.label ?? ''}
    </div>
  );
}
