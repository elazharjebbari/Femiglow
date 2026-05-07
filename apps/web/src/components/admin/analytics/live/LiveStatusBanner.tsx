/**
 * LiveStatusBanner — affiche l'état de la connexion temps réel.
 * cf. docs/analytics/05-onglets-specs.md §2.6
 *
 * États visuels :
 *  - connecting : pastille jaune « Connexion… »
 *  - open : pastille verte « Temps réel · MAJ il y a Xs »
 *  - polling : pastille orange « Mode dégradé · polling 5s »
 *  - paused : pastille grise « En pause »
 *  - error : pastille rouge « Connexion perdue · reconnexion… »
 */
'use client';

import type { AnalyticsSSEStatus } from '@/components/admin/analytics/hooks/useAnalyticsSSE';

interface LiveStatusBannerProps {
  status: AnalyticsSSEStatus;
  lastUpdateIso?: string | null;
  onPause?: () => void;
  onResume?: () => void;
  paused?: boolean;
  className?: string;
}

const STATUS_DOT: Record<AnalyticsSSEStatus, string> = {
  idle: 'bg-stone-300',
  connecting: 'bg-amber-400 animate-pulse',
  open: 'bg-emerald-500',
  polling: 'bg-amber-500',
  paused: 'bg-stone-400',
  error: 'bg-rose-500 animate-pulse',
};

const STATUS_LABEL: Record<AnalyticsSSEStatus, string> = {
  idle: 'Initialisation…',
  connecting: 'Connexion…',
  open: 'Temps réel',
  polling: 'Mode dégradé · polling 5 s',
  paused: 'En pause',
  error: 'Connexion perdue · reconnexion…',
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return 'à l’instant';
  if (seconds < 60) return `il y a ${seconds}\u202fs`;
  const minutes = Math.round(seconds / 60);
  return `il y a ${minutes}\u202fmin`;
}

export function LiveStatusBanner({
  status,
  lastUpdateIso,
  onPause,
  onResume,
  paused = false,
  className = '',
}: LiveStatusBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="live-status-banner"
      className={`flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm ${className}`}
    >
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`}
      />
      <span className="font-medium text-stone-900">{STATUS_LABEL[status]}</span>
      {status === 'open' || status === 'polling' ? (
        <span className="text-xs text-stone-500">
          MAJ {formatRelative(lastUpdateIso)}
        </span>
      ) : null}
      <span className="ml-auto">
        {paused ? (
          <button
            type="button"
            onClick={onResume}
            className="rounded-md border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-stone-400"
          >
            Reprendre
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="rounded-md border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-stone-400"
          >
            Pause
          </button>
        )}
      </span>
    </div>
  );
}
