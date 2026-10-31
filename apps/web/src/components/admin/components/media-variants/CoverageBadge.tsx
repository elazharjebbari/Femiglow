/**
 * CoverageBadge — compteur de couverture des « médias par audience ».
 *
 * Répartit les combinaisons (ligne × langue de visiteuse × slot) servies
 * par un ensemble PUBLIÉ de leur propre ligne (exactes), par un autre
 * ensemble (héritées) ou par le repli du composant (déléguées : liaisons
 * existantes ou image produit). Chiffres calculés côté serveur avec
 * `selectMediaSet` (`coverage.summary`).
 */
'use client';

import type { MediaSetCoverage } from './types';

interface Props {
  summary: MediaSetCoverage['summary'];
  /** Libellé de la portée quand un filtre de slot est actif. */
  scopeLabel?: string;
}

export function CoverageBadge({ summary, scopeLabel }: Props): JSX.Element {
  const { total, exact, inherited, delegated } = summary;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div
      role="group"
      aria-label="Couverture des combinaisons"
      className="flex min-w-0 flex-col gap-1.5"
    >
      <p className="text-xs text-stone-600">
        <span className="font-semibold tabular-nums text-stone-900">{total}</span> combinaisons
        {scopeLabel ? ` (${scopeLabel})` : ''} :{' '}
        <span className="font-medium text-emerald-700">
          <span className="tabular-nums">{exact}</span> exactes
        </span>
        {' · '}
        <span className="font-medium text-sky-700">
          <span className="tabular-nums">{inherited}</span> héritées
        </span>
        {' · '}
        <span className="font-medium text-amber-700">
          <span className="tabular-nums">{delegated}</span> sur le repli
        </span>
      </p>
      <div
        aria-hidden="true"
        className="flex h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-stone-100"
      >
        <span className="bg-emerald-500" style={{ width: `${pct(exact)}%` }} />
        <span className="bg-sky-400" style={{ width: `${pct(inherited)}%` }} />
        <span className="bg-amber-400" style={{ width: `${pct(delegated)}%` }} />
      </div>
    </div>
  );
}

/** Recalcule le résumé pour un sous-ensemble de cellules (filtre de slot). */
export function summarizeCells(cells: MediaSetCoverage['cells']): MediaSetCoverage['summary'] {
  const exact = cells.filter((c) => c.exact).length;
  const delegated = cells.filter((c) => c.level >= 7).length;
  return { total: cells.length, exact, inherited: cells.length - exact - delegated, delegated };
}
