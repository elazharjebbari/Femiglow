import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { HealthRecheckButton } from '@/components/admin/legal/HealthRecheckButton';
import { requireAdmin } from '@/lib/auth/require-admin';
import { summarizeLinkHealth } from '@/lib/legal/link-verifier';
import { pagesWithMissingPlacements } from '@/lib/legal/repository';

export const dynamic = 'force-dynamic';

const STATUS_PILL: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-800',
  page_missing: 'bg-red-50 text-red-800',
  page_draft: 'bg-amber-50 text-amber-800',
  http_4xx: 'bg-red-50 text-red-800',
  http_5xx: 'bg-red-50 text-red-800',
  timeout: 'bg-amber-50 text-amber-800',
};

export default async function HealthPage() {
  const session = await requireAdmin('/admin/legal/health');
  const [summary, orphanPages] = await Promise.all([
    summarizeLinkHealth(),
    pagesWithMissingPlacements(),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="legal">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/legal" className="text-xs text-stone-500 hover:underline">
            ← Pages légales
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Santé des liens légaux
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Dernière vérification :{' '}
            {summary.lastCheckedAt
              ? new Date(summary.lastCheckedAt).toLocaleString('fr-FR')
              : 'jamais — lance une vérification ↓'}
          </p>
        </div>
        <HealthRecheckButton />
      </header>

      <div className="mb-4 flex items-center gap-3 text-sm">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 ${
            summary.globalStatus === 'ok'
              ? 'bg-emerald-50 text-emerald-800'
              : summary.globalStatus === 'warning'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-800'
          }`}
        >
          Statut global : {summary.globalStatus}
        </span>
        {orphanPages.length > 0 ? (
          <span className="text-amber-700">
            ⚠ {orphanPages.length} page(s) publiée(s) sans placement : {orphanPages.join(', ')}
          </span>
        ) : null}
      </div>

      {summary.byZone.map((zone) => (
        <section key={zone.zoneKey} className="mb-6 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-900">
            <code className="font-mono text-xs text-stone-500">{zone.zoneKey}</code> — {zone.ok}{' '}
            ok · {zone.broken} cassé(s)
          </h2>
          <ul className="mt-2 space-y-1 text-xs">
            {zone.links.map((link) => (
              <li
                key={`${zone.zoneKey}-${link.pageSlug}`}
                className="flex items-center justify-between border-b border-stone-100 py-1"
              >
                <span className="font-mono">{link.pageSlug}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] ${STATUS_PILL[link.status] ?? ''}`}
                  >
                    {link.status}
                  </span>
                  {link.httpCode ? <span>HTTP {link.httpCode}</span> : null}
                  <span className="text-stone-500">
                    {new Date(link.checkedAt).toLocaleString('fr-FR')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {summary.byZone.length === 0 ? (
        <div className="rounded border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">
          Aucun snapshot. Lance la vérification pour produire les premières mesures.
        </div>
      ) : null}
    </AdminShell>
  );
}
