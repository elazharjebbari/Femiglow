'use client';

import { useEffect, useState } from 'react';
import type { GtmStats } from '@/lib/tracking/gtm/exporter';

interface Props {
  stats: GtmStats;
  /** Si true, affiche un skeleton à la place des chiffres. */
  loading?: boolean;
}

/**
 * Animation count-up légère : tween linéaire 600 ms vers la valeur cible.
 * Désactivée en `prefers-reduced-motion`.
 */
function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setValue(target);
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target < 8) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    function step(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

interface CardConfig {
  label: string;
  value: number;
  sub?: string;
  /** Sub-label « chat » mis en évidence avec accent sauge. */
  chatHint?: string;
}

interface StatCardProps extends CardConfig {
  loading: boolean;
  delayMs: number;
}

function StatCard({ label, value, sub, chatHint, loading, delayMs }: StatCardProps) {
  const animated = useCountUp(value);
  return (
    <div
      className="motion-safe:animate-[fg-fade-in_220ms_ease-out_both] rounded-md border border-stone-200 bg-white px-4 py-3 transition-colors duration-150 hover:border-stone-300"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      {loading ? (
        <div
          aria-hidden="true"
          className="mt-1.5 h-7 w-12 motion-safe:animate-[fg-skeleton-pulse_1.4s_ease-in-out_infinite] rounded bg-stone-200"
        />
      ) : (
        <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
          {animated.toLocaleString('fr-FR')}
        </dd>
      )}
      {sub || chatHint ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs">
          {sub ? <span className="text-stone-500">{sub}</span> : null}
          {chatHint ? (
            <span className="inline-flex items-center rounded-full border border-[#A8C4A6]/40 bg-[#A8C4A6]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#3F5B41]">
              {chatHint}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function GtmStatsGrid({ stats, loading = false }: Props) {
  const cards: CardConfig[] = [
    {
      label: 'Tags',
      value: stats.tags,
      sub: `${stats.conversions} conversions`,
    },
    {
      label: 'Triggers',
      value: stats.triggers,
      chatHint: stats.chatTriggers > 0 ? `${stats.chatTriggers} chat` : undefined,
    },
    {
      label: 'Variables',
      value: stats.variables,
      chatHint: stats.chatDims > 0 ? `${stats.chatDims} chat dims` : undefined,
    },
    {
      label: 'Folders',
      value: stats.folders,
      sub: `${stats.folders} catégories`,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c, i) => (
        <StatCard key={c.label} {...c} loading={loading} delayMs={i * 40} />
      ))}
    </dl>
  );
}
