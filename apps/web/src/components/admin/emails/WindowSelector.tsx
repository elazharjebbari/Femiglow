'use client';

/**
 * WindowSelector — sélecteur de fenêtre du dashboard (F03, DASH-01).
 *
 * Radiogroup accessible (roving tabindex + flèches) qui pousse `?window=` via
 * `router.replace` (pas d'entrée d'historique par clic de fenêtre — un back
 * doit quitter le dashboard, pas rejouer 24h→7j→30j).
 */
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DASHBOARD_WINDOWS,
  windowLabel,
  type DashboardWindow,
} from '@/app/admin/emails/kpi-format';

export function WindowSelector({ value }: { value: DashboardWindow }) {
  const router = useRouter();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (w: DashboardWindow) => {
    if (w !== value) router.replace(`/admin/emails?window=${w}`, { scroll: false });
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let target: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (index + 1) % DASHBOARD_WINDOWS.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      target = (index - 1 + DASHBOARD_WINDOWS.length) % DASHBOARD_WINDOWS.length;
    if (target === null) return;
    e.preventDefault();
    refs.current[target]?.focus();
    select(DASHBOARD_WINDOWS[target]!);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Fenêtre des indicateurs"
      data-testid="window-selector"
      className="inline-flex rounded-md border border-stone-300 bg-white p-0.5"
    >
      {DASHBOARD_WINDOWS.map((w, i) => {
        const checked = w === value;
        return (
          <button
            key={w}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => select(w)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              checked ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {windowLabel(w)}
          </button>
        );
      })}
    </div>
  );
}
