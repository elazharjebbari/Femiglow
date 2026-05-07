/**
 * AnalyticsTooltip — tooltip custom pour Recharts (sobre, brand-aligned).
 * cf. docs/analytics/04-ui-design.md §3.4
 *
 * Recharts injecte des props (active/payload/label) à un composant tooltip
 * via `<Tooltip content={<AnalyticsTooltip />} />`. On reste agnostique sur
 * le type exact de `payload` pour ne pas dépendre du module recharts ici.
 */
import type { ReactNode } from 'react';

interface TooltipPayloadItem {
  name?: string | number;
  dataKey?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface AnalyticsTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  /** Formatte la valeur (delta, %, durée…). */
  formatter?: (value: number | string, name: string) => ReactNode;
  /** Formatte le label (ex: bucket → "06 mai 14h"). */
  labelFormatter?: (label: string | number) => ReactNode;
}

export function AnalyticsTooltip({
  active,
  label,
  payload,
  formatter,
  labelFormatter,
}: AnalyticsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      role="tooltip"
      data-testid="analytics-tooltip"
      className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs shadow-md"
    >
      {label !== undefined && label !== '' ? (
        <p className="mb-1 font-medium text-stone-700">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry, idx) => {
          const value =
            entry.value === undefined || entry.value === null ? '—' : entry.value;
          const name =
            typeof entry.name === 'string'
              ? entry.name
              : entry.name !== undefined
                ? String(entry.name)
                : (entry.dataKey ?? '');
          return (
            <li
              key={`${name}-${idx}`}
              className="flex items-center justify-between gap-3 tabular-nums"
            >
              <span className="flex items-center gap-1.5 text-stone-600">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color ?? '#737373' }}
                />
                {name}
              </span>
              <span className="font-medium text-stone-900">
                {formatter ? formatter(value, name) : value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
