'use client';

/**
 * ScheduleShortcuts — chips de planification rapide (F05 P3.2-c3, assistance G11).
 *
 * Propose des créneaux futurs usuels (dans 1 h, demain 9 h, …) qui remplissent
 * l'input datetime-local de l'étape Planification. `now` est figé au montage
 * (un seul calcul) ; injectable pour les tests. Couleurs neutres (stone) +
 * anneau de focus unique.
 */
import { useMemo, useState } from 'react';
import { scheduleShortcuts } from '@/lib/mail/campaigns/schedule-shortcuts';
import { FOCUS, RADIUS } from '../ui/tokens';

export function ScheduleShortcuts({
  onPick,
  now,
}: {
  onPick: (value: string) => void;
  now?: Date;
}) {
  const [base] = useState(() => now ?? new Date());
  const shortcuts = useMemo(() => scheduleShortcuts(base), [base]);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="schedule-shortcuts">
      <span className="text-xs text-stone-500">Raccourcis :</span>
      {shortcuts.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.value)}
          className={`${RADIUS.pill} border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 ${FOCUS}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
