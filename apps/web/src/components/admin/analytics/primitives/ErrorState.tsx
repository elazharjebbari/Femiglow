/**
 * ErrorState — affichage local d'une erreur de chargement de données.
 * cf. docs/analytics/04-ui-design.md §3.8 et §7.2
 */
import type { ReactNode } from 'react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Erreur',
  message = 'Une erreur est survenue lors du chargement des données.',
  action,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-6 py-6 text-center ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-8 w-8 text-rose-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 8v5" strokeLinecap="round" />
        <path d="M12 16h.01" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <p className="text-sm font-medium text-rose-900">{title}</p>
      <p className="max-w-sm text-xs text-rose-700">{message}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
