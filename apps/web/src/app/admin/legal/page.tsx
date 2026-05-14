import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { LegalEmptyState } from '@/components/admin/legal/EmptyState';
import { LegalListFilters } from '@/components/admin/legal/LegalListFilters';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  legalListStats,
  listAllTemplateVars,
  listLegalPages,
} from '@/lib/legal/repository';
import { legalPageStatusSchema } from '@/lib/legal/types';
import { detectMissingVars } from '@/lib/legal/vars';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { q?: string; status?: string };
}

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

export default async function AdminLegalPage({ searchParams }: PageProps) {
  const session = await requireAdmin('/admin/legal');
  const statusParam = searchParams?.status
    ? legalPageStatusSchema.safeParse(searchParams.status)
    : null;
  const filter = {
    status: statusParam?.success ? statusParam.data : undefined,
    search: searchParams?.q || undefined,
  };
  const [pages, stats, vars] = await Promise.all([
    listLegalPages(filter),
    legalListStats(),
    listAllTemplateVars(),
  ]);

  const isFiltered = Boolean(filter.status || filter.search);

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
            href="/admin/legal/new"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            + Nouvelle page
          </Link>
          <Link
            href="/admin/legal/template-vars"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Variables
          </Link>
          <Link
            href="/admin/legal/placements"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Placements
          </Link>
          <Link
            href="/admin/legal/redirects"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Redirects
          </Link>
          <Link
            href="/admin/legal/health"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Santé liens
          </Link>
        </div>
      </header>

      <LegalListFilters />

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
                  <span className="text-xs text-emerald-700">OK</span>
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
                  className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  Éditer
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 ? (
        <div className="mt-8">
          {isFiltered ? (
            <LegalEmptyState
              title="Aucun résultat"
              description={`Aucune page ne correspond à tes filtres${
                filter.search ? ` (recherche: "${filter.search}")` : ''
              }${filter.status ? ` (statut: ${filter.status})` : ''}.`}
              ctaHref="/admin/legal"
              ctaLabel="Effacer les filtres"
            />
          ) : (
            <LegalEmptyState
              title="Aucune page légale"
              description="Crée ta première page depuis le wizard, ou lance le seed pour générer les 9 templates par défaut (mentions légales, CGV, etc.)."
              ctaHref="/admin/legal/new"
              ctaLabel="+ Créer une page"
            />
          )}
        </div>
      ) : null}
    </AdminShell>
  );
}
