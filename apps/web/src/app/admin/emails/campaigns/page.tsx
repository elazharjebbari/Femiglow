/**
 * /admin/emails/campaigns — Liste des campagnes broadcast.
 *
 * UX-CAMP-012 — recherche + filtre statut + pagination portés par l'URL.
 * UX-CAMP-003 — duplication de campagne depuis la colonne actions.
 * UX-CAMP-009 — création via formulaire client (feedback + anti double-clic).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listCampaigns } from '@/lib/admin/emails/campaigns-queries';
import { duplicateCampaign } from '@/lib/admin/emails/wizard-actions';
import { CreateCampaignForm } from './CreateCampaignForm';
import {
  CampaignsFilterBar,
  CampaignsPagination,
  CampaignStatusBadge,
} from './CampaignsListClient';

export const dynamic = 'force-dynamic';

type SearchParams = { status?: string; q?: string; page?: string };

export default async function CampaignsListPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await requireAdmin('/admin/emails/campaigns');
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const { rows, total, pageCount } = await listCampaigns({
    status: searchParams?.status,
    q: searchParams?.q,
    page,
    pageSize: 20,
  });

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href="/admin/emails" className="text-sm text-stone-500 underline">
            ← Dashboard emails
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Campagnes
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {total} campagne{total === 1 ? '' : 's'}
          </p>
        </div>

        <CreateCampaignForm />
      </header>

      <CampaignsFilterBar />

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nom</th>
              <th className="px-3 py-2 text-left font-medium">Sujet</th>
              <th className="px-3 py-2 text-left font-medium">Statut</th>
              <th className="px-3 py-2 text-left font-medium">Audience</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-stone-500">
                  Aucune campagne ne correspond à ces filtres.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-medium text-stone-900">{c.name}</td>
                  <td className="px-3 py-2 text-stone-700 max-w-xs truncate">{c.subject || '—'}</td>
                  <td className="px-3 py-2">
                    <CampaignStatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {c.audienceId
                      ? 'Audience FemiGlow'
                      : Array.isArray(c.audienceLinkIds)
                        ? `${c.audienceLinkIds.length} liste${c.audienceLinkIds.length > 1 ? 's' : ''}`
                        : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500 whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleString('fr-FR', { dateStyle: 'short' })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {c.status === 'draft' ? (
                        <Link
                          href={`/admin/emails/campaigns/${c.id}/edit`}
                          className="text-xs text-stone-600 underline"
                        >
                          Continuer
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/emails/campaigns/${c.id}`}
                          className="text-xs text-stone-600 underline"
                        >
                          Voir
                        </Link>
                      )}
                      <form action={duplicateCampaign}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs text-stone-600 underline"
                          aria-label={`Dupliquer la campagne ${c.name}`}
                        >
                          Dupliquer
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CampaignsPagination page={page} pageCount={pageCount} />
    </AdminShell>
  );
}
