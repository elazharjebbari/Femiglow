/**
 * EmptyState — affiche un état "aucune donnée" sobre.
 * cf. docs/analytics/04-ui-design.md §3.8 et §7.3
 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Aucune donnée',
  message = 'Aucun événement ne correspond aux filtres pour cette période.',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 px-6 py-10 text-center ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="h-10 w-10 text-stone-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="24" cy="24" r="20" />
        <path d="M14 30c2-3 6-5 10-5s8 2 10 5" />
        <circle cx="18" cy="20" r="1.5" fill="currentColor" />
        <circle cx="30" cy="20" r="1.5" fill="currentColor" />
      </svg>
      <p className="text-sm font-medium text-stone-700">{title}</p>
      <p className="max-w-sm text-xs text-stone-500">{message}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
