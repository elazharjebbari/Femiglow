/**
 * KpiCard — atome principal de la vue d'ensemble.
 * cf. docs/analytics/04-ui-design.md §3.3
 *
 * Anatomy : label uppercase tracking-wide / valeur tabular-nums /
 * delta avec direction (up/down/flat) + comparison label.
 *
 * Délègue le formatage à `lib/analytics/format` selon la prop `format`.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  formatCurrency,
  formatDelta,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/analytics/format';

import { Skeleton } from './Skeleton';

export type KpiFormat = 'number' | 'percent' | 'duration' | 'currency';

export interface KpiDelta {
  value: number;
  direction?: 'up' | 'down' | 'flat';
}

interface KpiCardProps {
  label: string;
  value?: number | null;
  format?: KpiFormat;
  currency?: string;
  delta?: KpiDelta | null;
  comparisonLabel?: string;
  icon?: ReactNode;
  loading?: boolean;
  href?: string;
  /** Sens (positif=bon, négatif=bon) pour décider de la couleur du delta. */
  positiveDirection?: 'up' | 'down';
  className?: string;
}

function formatValue(
  value: number | null | undefined,
  format: KpiFormat,
  currency: string,
): string {
  switch (format) {
    case 'number':
      return formatNumber(value);
    case 'percent':
      return formatPercent(value);
    case 'duration':
      return formatDuration(value);
    case 'currency':
      return formatCurrency(value, currency);
  }
}

function deltaColor(
  direction: 'up' | 'down' | 'flat',
  positiveDirection: 'up' | 'down',
): string {
  if (direction === 'flat') return 'text-stone-500';
  const isPositive = direction === positiveDirection;
  return isPositive ? 'text-emerald-600' : 'text-rose-600';
}

export function KpiCard({
  label,
  value,
  format = 'number',
  currency = 'EUR',
  delta,
  comparisonLabel,
  icon,
  loading = false,
  href,
  positiveDirection = 'up',
  className = '',
}: KpiCardProps) {
  const formatted = formatValue(value, format, currency);
  const deltaInfo = delta ? formatDelta(delta.value) : null;
  const direction = delta?.direction ?? deltaInfo?.direction ?? 'flat';

  const inner = (
    <article
      role="group"
      aria-label={label}
      data-testid="kpi-card"
      className={`flex flex-col gap-1.5 rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-stone-300 ${className}`}
    >
      <header className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
        {icon ? <span className="text-stone-400">{icon}</span> : null}
      </header>

      {loading ? (
        <div data-testid="kpi-skeleton" className="flex flex-col gap-2 py-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <>
          <p className="font-display text-3xl font-medium text-stone-900 tabular-nums">
            {formatted}
          </p>
          {deltaInfo && deltaInfo.label !== '—' ? (
            <p
              className={`flex items-baseline gap-2 text-xs tabular-nums ${deltaColor(direction, positiveDirection)}`}
            >
              <span className="font-medium">{deltaInfo.label}</span>
              {comparisonLabel ? (
                <span className="text-stone-500">{comparisonLabel}</span>
              ) : null}
            </p>
          ) : comparisonLabel ? (
            <p className="text-xs text-stone-400">{comparisonLabel}</p>
          ) : null}
        </>
      )}
    </article>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 rounded-lg"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
