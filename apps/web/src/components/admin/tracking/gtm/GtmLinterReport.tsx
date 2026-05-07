'use client';

import type { LintReport } from '@/lib/tracking/gtm/linter';
import { IconAlert, IconCheck } from './GtmIcons';

interface Props {
  report: LintReport;
  /** Si true, le panneau est ouvert par défaut (typiquement quand errors > 0). */
  defaultOpen?: boolean;
}

const SEVERITY_STYLES = {
  error: {
    icon: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-900',
    label: 'Erreur',
  },
  warning: {
    icon: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-900',
    label: 'Avertissement',
  },
  info: {
    icon: 'text-stone-500',
    bg: 'bg-stone-50',
    border: 'border-stone-200',
    text: 'text-stone-700',
    label: 'Info',
  },
};

export function GtmLinterReport({ report, defaultOpen }: Props) {
  const total = report.errors.length + report.warnings.length + report.infos.length;
  const open = defaultOpen ?? report.errors.length > 0;

  if (total === 0) {
    return (
      <section
        aria-label="Validation du container"
        className="rounded-md border border-[#A8C4A6]/40 bg-[#A8C4A6]/10 px-4 py-2.5"
      >
        <div className="flex items-center gap-2 text-sm text-[#3F5B41]">
          <IconCheck className="h-4 w-4" />
          <span>Validation du container : aucun problème détecté.</span>
        </div>
      </section>
    );
  }

  const allIssues = [
    ...report.errors,
    ...report.warnings,
    ...report.infos,
  ];

  return (
    <details
      open={open}
      className="rounded-md border border-stone-200 bg-white"
      aria-label="Validation du container"
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-stone-900">
        Validation du container —{' '}
        {report.errors.length > 0 ? (
          <span className="text-red-700">
            {report.errors.length} erreur(s)
          </span>
        ) : (
          <span className="text-[#3F5B41]">aucune erreur</span>
        )}
        {', '}
        <span className="text-amber-700">
          {report.warnings.length} avertissement(s)
        </span>
        {', '}
        <span className="text-stone-500">
          {report.infos.length} info(s)
        </span>
      </summary>
      <ul className="divide-y divide-stone-100">
        {allIssues.map((issue, i) => {
          const styles = SEVERITY_STYLES[issue.severity];
          return (
            <li key={i} className={`flex items-start gap-3 px-4 py-2.5 text-xs ${styles.bg}`}>
              <IconAlert className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${styles.icon}`} />
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${styles.text}`}>
                  <span className="rounded bg-white/60 px-1 py-0.5 font-mono text-[10px]">
                    {issue.code}
                  </span>{' '}
                  · {issue.message}
                </p>
                {issue.hint ? (
                  <p className="mt-0.5 text-[11px] text-stone-600">{issue.hint}</p>
                ) : null}
                <p className="mt-0.5 text-[10px] text-stone-500">
                  {issue.refType} : <span className="font-mono">{issue.refName}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
