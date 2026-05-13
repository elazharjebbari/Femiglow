import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  legalListStats,
  listAllTemplateVars,
  listLegalPages,
} from '@/lib/legal/repository';
import { detectMissingVars } from '@/lib/legal/vars';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  review: 'En revue',
  published: 'Publié',
  archived: 'Archivé',
};

const STATUS_PILL: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-700',
  review: 'bg-amber-50 text-amber-800',
  published: 'bg-emerald-50 text-emerald-800',
  archived: 'bg-stone-200 text-stone-600',
};

export default async function AdminLegalPage() {
  const session = await requireAdmin('/admin/legal');
  const [pages, stats, vars] = await Promise.all([
    listLegalPages(),
    legalListStats(),
    listAllTemplateVars(),
  ]);

  const rows = pages.map((p) => ({
    ...p,
    missingVars: detectMissingVars(p.bodyMd, vars),
  }));

  return (
    <AdminShell adminEmail={session.email} active="legal">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Pages légales
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {stats.total} pages · {stats.published} publiées · {stats.draft} en brouillon ·{' '}
            {stats.review} en revue
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/legal/template-vars"
            className="border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
          >
            Variables
          </Link>
          <Link
            href="/admin/legal/placements"
            className="border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
          >
            Placements
          </Link>
          <Link
            href="/admin/legal/health"
            className="border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
          >
            Santé liens
          </Link>
        </div>
      </header>

      <table className="w-full border-collapse border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-100 text-left text-xs uppercase tracking-wider text-stone-600">
          <tr>
            <th className="border-b border-stone-200 px-3 py-2">Page</th>
            <th className="border-b border-stone-200 px-3 py-2">Statut</th>
            <th className="border-b border-stone-200 px-3 py-2">Version</th>
            <th className="border-b border-stone-200 px-3 py-2">MAJ</th>
            <th className="border-b border-stone-200 px-3 py-2">Vars manquantes</th>
            <th className="border-b border-stone-200 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50">
              <td className="px-3 py-2">
                <div className="font-medium text-stone-900">{p.title}</div>
                <div className="font-mono text-xs text-stone-500">/legal/{p.slug}</div>
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                    STATUS_PILL[p.status] ?? STATUS_PILL.draft
                  }`}
                >
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-stone-600">v{p.version}</td>
              <td className="px-3 py-2 text-xs text-stone-500">
                {new Date(p.updatedAt).toLocaleDateString('fr-FR')}
              </td>
              <td className="px-3 py-2">
                {p.missingVars.length === 0 ? (
                  <span className="text-xs text-emerald-600">OK</span>
                ) : (
                  <span className="text-xs text-amber-700">
                    {p.missingVars.length} : {p.missingVars.slice(0, 3).join(', ')}
                    {p.missingVars.length > 3 ? '…' : ''}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/admin/legal/${p.slug}/edit`}
                  className="text-sm font-medium text-stone-800 hover:underline"
                >
                  Éditer →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 ? (
        <div className="mt-8 rounded border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">
          Aucune page légale. Lance{' '}
          <code className="bg-stone-100 px-1 py-0.5">pnpm tsx scripts/seed-legal.ts</code> pour
          peupler les 9 templates par défaut.
        </div>
      ) : null}
    </AdminShell>
  );
}
