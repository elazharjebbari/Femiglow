'use client';

/**
 * <SeoLinterPanel> — panneau audit SEO (score + issues).
 * cf. docs/seo-cms/frontend/02-seo-linter-audit.md
 */
import type { AuditReport, AuditSeverity } from '@/lib/seo/rules/types';

interface SeoLinterPanelProps {
  report: AuditReport | null;
  loading?: boolean;
  onIssueClick?: (field: string | undefined) => void;
}

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  error: '✕',
  warning: '⚠',
  info: 'ⓘ',
};

const SEVERITY_BG: Record<AuditSeverity, string> = {
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-stone-50 text-stone-700 border-stone-200',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-600 text-white';
  if (score >= 50) return 'bg-amber-500 text-white';
  return 'bg-red-600 text-white';
}

export function SeoLinterPanel({ report, loading, onIssueClick }: SeoLinterPanelProps) {
  return (
    <aside className="rounded-md border border-stone-200 bg-white p-3">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Audit
        </h2>
        {report ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(report.score)}`}
            aria-label={`Score audit ${report.score}`}
          >
            {report.score}
          </span>
        ) : (
          <span className="text-xs text-stone-400">{loading ? '…' : '—'}</span>
        )}
      </header>

      {report ? (
        <>
          {report.issues.length === 0 ? (
            <p className="text-xs text-stone-500">Aucune issue détectée.</p>
          ) : (
            <ul className="space-y-1.5">
              {report.issues.map((iss, idx) => (
                <li key={`${iss.code}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => onIssueClick?.(iss.field)}
                    className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${SEVERITY_BG[iss.severity]} hover:opacity-80`}
                  >
                    <span aria-hidden className="font-bold">
                      {SEVERITY_LABEL[iss.severity]}
                    </span>
                    <span className="flex-1">
                      <span className="block font-mono text-[10px] uppercase tracking-wide opacity-70">
                        {iss.code}
                      </span>
                      <span className="block">{iss.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <footer className="mt-3 flex justify-between border-t border-stone-100 pt-2 text-[11px] text-stone-500">
            <span>Errors {report.errors}</span>
            <span>Warnings {report.warnings}</span>
            <span>Info {report.info}</span>
          </footer>
        </>
      ) : (
        <p className="text-xs text-stone-500">
          {loading ? 'Audit en cours…' : 'Aucun audit disponible.'}
        </p>
      )}
    </aside>
  );
}
