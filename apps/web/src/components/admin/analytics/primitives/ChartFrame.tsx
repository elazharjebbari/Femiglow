/**
 * ChartFrame — wrapper standard pour tous les graphiques.
 * cf. docs/analytics/04-ui-design.md §3.4
 *
 * Gère les états (loading / empty / error) et un header (titre + description
 * + actions). Le contenu (le chart Recharts lui-même) est passé en children.
 */
import type { ReactNode } from 'react';

import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Skeleton } from './Skeleton';

interface ChartFrameProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Hauteur en px (default 320) */
  height?: number;
  className?: string;
}

export function ChartFrame({
  title,
  description,
  actions,
  children,
  loading = false,
  error = null,
  isEmpty = false,
  emptyMessage,
  height = 320,
  className = '',
}: ChartFrameProps) {
  return (
    <section
      data-testid="chart-frame"
      className={`flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-5 ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-medium text-stone-900">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-stone-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>

      <div style={{ height }} className="relative">
        {loading ? (
          <div data-testid="chart-skeleton" className="flex h-full flex-col gap-2 py-4">
            <Skeleton className="h-full w-full" />
          </div>
        ) : error ? (
          <ErrorState message={error} className="h-full" />
        ) : isEmpty ? (
          <EmptyState
            message={emptyMessage ?? 'Aucune donnée à afficher pour cette période.'}
            className="h-full"
          />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
