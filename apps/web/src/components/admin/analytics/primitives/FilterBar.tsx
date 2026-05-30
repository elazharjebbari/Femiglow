/**
 * FilterBar — barre sticky de filtres globaux (period / device / traffic).
 * cf. docs/analytics/04-ui-design.md §3.1 et §6.2
 *
 * Met à jour l'URL via useRouter().replace pour conserver le scroll. Persiste
 * dans localStorage via le hook useAnalyticsFilters.
 */
'use client';

import { usePathname } from 'next/navigation';
import { useTransition } from 'react';

import {
  ANALYTICS_DEVICES,
  ANALYTICS_PERIODS,
  type AnalyticsDevice,
  type AnalyticsFilters,
  type AnalyticsPeriod,
  type AnalyticsTraffic,
  DEFAULT_FILTERS,
} from '@/lib/analytics/filters';
import { TRAFFIC_BUCKETS } from '@/lib/analytics/attribution';

import { useAnalyticsFilters } from '../hooks/useAnalyticsFilters';

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: 'Aujourd’hui',
  yesterday: 'Hier',
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
  all: 'Tout',
  custom: 'Personnalisé',
};

const DEVICE_LABELS: Record<AnalyticsDevice, string> = {
  mobile: 'Mobile',
  tablet: 'Tablette',
  desktop: 'Desktop',
  all: 'Tous',
};

const TRAFFIC_LABELS: Partial<Record<AnalyticsTraffic, string>> = {
  all: 'Toutes sources',
  direct: 'Direct',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  meta: 'Meta',
  tiktok: 'TikTok',
  snap: 'Snap',
  pinterest: 'Pinterest',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  email: 'Email',
  affiliate: 'Affiliate',
  other: 'Autres',
};

interface FilterBarProps {
  className?: string;
}

export function FilterBar({ className = '' }: FilterBarProps) {
  const pathname = usePathname();
  const { filters, setFilters, reset } = useAnalyticsFilters();
  const [isPending, startTransition] = useTransition();

  // L'onglet Insights a son propre jeu de filtres (window/env/locale/…) et rend
  // sa propre barre. On masque donc la FilterBar globale sur cette route pour
  // éviter deux barres aux modèles divergents. cf. finding AF-05.
  if (pathname?.endsWith('/analytics/insights')) return null;

  const update = (patch: Partial<AnalyticsFilters>) => {
    startTransition(() => setFilters({ ...filters, ...patch }));
  };

  return (
    <div
      data-testid="filter-bar"
      data-pending={isPending ? 'true' : undefined}
      className={`sticky top-0 z-20 -mx-6 flex flex-wrap items-center gap-3 border-b border-stone-200 bg-stone-50/95 px-6 py-3 backdrop-blur lg:-mx-10 lg:px-10 ${className}`}
    >
      <FilterSelect
        label="Période"
        value={filters.period}
        onChange={(v) => update({ period: v as AnalyticsPeriod })}
        options={ANALYTICS_PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
        testId="filter-period"
      />
      <FilterSelect
        label="Device"
        value={filters.device}
        onChange={(v) => update({ device: v as AnalyticsDevice })}
        options={ANALYTICS_DEVICES.map((d) => ({ value: d, label: DEVICE_LABELS[d] }))}
        testId="filter-device"
      />
      <FilterSelect
        label="Source"
        value={filters.traffic}
        onChange={(v) => update({ traffic: v as AnalyticsTraffic })}
        options={[
          { value: 'all', label: TRAFFIC_LABELS.all ?? 'Toutes' },
          ...TRAFFIC_BUCKETS.map((b) => ({
            value: b,
            label: TRAFFIC_LABELS[b] ?? b,
          })),
        ]}
        testId="filter-traffic"
      />
      {!isDefault(filters) && (
        <button
          type="button"
          onClick={() => startTransition(reset)}
          className="ml-auto rounded-md border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white"
          data-testid="filter-reset"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  testId?: string;
}

function FilterSelect({ label, value, onChange, options, testId }: FilterSelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
      <span className="uppercase tracking-wide">{label}</span>
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 transition-colors focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function isDefault(filters: AnalyticsFilters): boolean {
  return (
    filters.period === DEFAULT_FILTERS.period &&
    filters.device === DEFAULT_FILTERS.device &&
    filters.traffic === DEFAULT_FILTERS.traffic
  );
}
