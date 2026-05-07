/**
 * LiveKpiBig — 3 cards XL : En ligne · Conversions · CTA achat.
 * cf. docs/analytics/05-onglets-specs.md §2.3
 *
 * Animation discrète : pulse vert quand la valeur change à la hausse.
 * Window selector (1h/2h/3h) géré par le parent — ici on affiche
 * le label "sur 1 h" depuis la prop.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import type { LiveKpiBig as LiveKpiBigData, LiveWindow } from '@/lib/analytics/queries/live';

interface LiveKpiBigProps {
  data: LiveKpiBigData | null;
  window: LiveWindow;
  onWindowChange?: (w: LiveWindow) => void;
  className?: string;
}

const WINDOW_OPTIONS: Array<{ value: LiveWindow; label: string }> = [
  { value: '1h', label: '1\u202fh' },
  { value: '2h', label: '2\u202fh' },
  { value: '3h', label: '3\u202fh' },
];

export function LiveKpiBig({
  data,
  window,
  onWindowChange,
  className = '',
}: LiveKpiBigProps) {
  return (
    <section
      aria-label="Indicateurs temps réel"
      className={`flex flex-col gap-4 ${className}`}
    >
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium text-stone-900">
          En direct
        </h2>
        {onWindowChange ? (
          <fieldset className="inline-flex rounded-md border border-stone-300 bg-white p-0.5">
            <legend className="sr-only">Fenêtre temporelle</legend>
            {WINDOW_OPTIONS.map((opt) => {
              const active = opt.value === window;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onWindowChange(opt.value)}
                  aria-pressed={active}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </fieldset>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <BigCard
          label="En ligne"
          sublabel="dernières 5 min"
          value={data?.online ?? null}
          accent="emerald"
        />
        <BigCard
          label="Conversions"
          sublabel={`sur ${data?.windowMinutes ? `${Math.round(data.windowMinutes / 60)}\u202fh` : '—'}`}
          value={data?.conversions ?? null}
          accent="amber"
        />
        <BigCard
          label="CTA achat"
          sublabel={`sur ${data?.windowMinutes ? `${Math.round(data.windowMinutes / 60)}\u202fh` : '—'}`}
          value={data?.ctaPurchase ?? null}
          accent="sky"
        />
      </div>
    </section>
  );
}

interface BigCardProps {
  label: string;
  sublabel: string;
  value: number | null;
  accent: 'emerald' | 'amber' | 'sky';
}

const ACCENT_BORDER: Record<BigCardProps['accent'], string> = {
  emerald: 'border-emerald-500/40',
  amber: 'border-amber-500/40',
  sky: 'border-sky-500/40',
};
const ACCENT_DOT: Record<BigCardProps['accent'], string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
};

function BigCard({ label, sublabel, value, accent }: BigCardProps) {
  const previousRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (value === null) return;
    if (previousRef.current !== null && value > previousRef.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 800);
      return () => window.clearTimeout(t);
    }
    previousRef.current = value;
  }, [value]);

  return (
    <article
      role="group"
      aria-label={label}
      data-testid="live-kpi-big"
      className={`flex flex-col gap-2 rounded-xl border-2 bg-white p-6 transition-shadow ${ACCENT_BORDER[accent]} ${
        pulse ? 'shadow-lg ring-2 ring-emerald-200' : ''
      }`}
    >
      <header className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 rounded-full ${ACCENT_DOT[accent]}`}
        />
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
          {label}
        </p>
      </header>
      <p className="font-display text-5xl font-medium tabular-nums text-stone-900">
        {value === null ? '—' : value}
      </p>
      <p className="text-xs text-stone-500">{sublabel}</p>
    </article>
  );
}
