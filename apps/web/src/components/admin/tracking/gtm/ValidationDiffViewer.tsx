import type { PairValidationResult, ValidationIssue, Recommendation } from '@/lib/tracking/gtm/sentinel-schemas';

type Props = { result: PairValidationResult };

export function ValidationDiffViewer({ result }: Props) {
  const verdict = result.ok
    ? result.warnings.length > 0
      ? { icon: '🟠', bg: 'border-amber-200 bg-amber-50', text: 'text-amber-900', label: `OK avec ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}` }
      : { icon: '🟢', bg: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-900', label: 'Cohérent — prêt à importer' }
    : { icon: '🔴', bg: 'border-red-200 bg-red-50', text: 'text-red-900', label: `Import bloqué — ${result.errors.length} erreur${result.errors.length > 1 ? 's' : ''}` };

  return (
    <div className="space-y-4">
      <div
        data-testid="verdict"
        data-ok={result.ok ? 'true' : 'false'}
        className={`rounded-lg border ${verdict.bg} p-4 ${verdict.text}`}
      >
        <h3 className="text-lg font-semibold">{verdict.icon} VERDICT : {verdict.label}</h3>
        {result.bundleId.config && result.bundleId.mapping ? (
          <p className="mt-1 text-sm font-mono">
            Bundle ID : config={result.bundleId.config} {result.bundleId.match ? '=' : '≠'} mapping={result.bundleId.mapping}
          </p>
        ) : null}
      </div>

      {result.errors.length > 0 ? (
        <IssueSection title="❌ Erreurs (bloquantes)" issues={result.errors} testId="errors" />
      ) : null}

      {result.warnings.length > 0 ? (
        <IssueSection title="⚠ Warnings (à vérifier)" issues={result.warnings} testId="warnings" />
      ) : null}

      {result.recommendations.length > 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-stone-500">Procédure recommandée</h4>
          <ol className="mt-2 space-y-1 text-sm text-stone-800">
            {result.recommendations.map((r) => (
              <li key={r.order}>
                <strong className="font-mono">{r.order}.</strong> {r.action}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function IssueSection({ title, issues, testId }: { title: string; issues: ValidationIssue[]; testId: string }) {
  return (
    <div data-testid={`issues-${testId}`} className="rounded-lg border border-stone-200 bg-white p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 space-y-3">
        {issues.map((issue, idx) => (
          <li key={idx} className="space-y-1 text-sm">
            <p className="font-medium text-stone-900">{issue.message}</p>
            <p className="text-stone-600">→ {issue.fix}</p>
            <code className="text-[10px] text-stone-400">code: {issue.code}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
