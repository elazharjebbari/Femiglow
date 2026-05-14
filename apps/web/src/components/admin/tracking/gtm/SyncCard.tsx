import type { ReactNode } from 'react';

type Props = {
  title: string;
  adminValue: string;
  runtimeValue: string;
  match: boolean;
  subtitle?: string | null;
  icon?: ReactNode;
  testId?: string;
};

export function SyncCard({ title, adminValue, runtimeValue, match, subtitle, testId }: Props) {
  return (
    <div
      data-testid={testId}
      data-match={match ? 'true' : 'false'}
      className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">{title}</h3>
      <dl className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <dt className="text-xs text-stone-600">Admin</dt>
          <dd className="font-mono text-sm font-medium text-stone-900">{adminValue}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs text-stone-600">GTM runtime</dt>
          <dd className="font-mono text-sm font-medium text-stone-900">
            {runtimeValue} {match ? '✓' : '✗'}
          </dd>
        </div>
      </dl>
      {subtitle ? (
        <p className={`mt-3 text-xs ${match ? 'text-emerald-700' : 'text-red-700'}`}>{subtitle}</p>
      ) : null}
    </div>
  );
}
