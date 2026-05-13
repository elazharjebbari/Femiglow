/**
 * /admin/emails/campaigns — Liste des campagnes broadcast.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listCampaigns } from '@/lib/admin/emails/campaigns-queries';
import { createCampaignDraft } from '@/lib/admin/emails/wizard-actions';

export const dynamic = 'force-dynamic';

export default async function CampaignsListPage() {
  const session = await requireAdmin('/admin/emails/campaigns');
  const rows = await listCampaigns({ limit: 100 });

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
            {rows.length} campagne{rows.length === 1 ? '' : 's'}
          </p>
        </div>

        <form action={createCampaignDraft}>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Nouvelle campagne</span>
            <div className="mt-1 flex gap-2">
              <input
                name="name"
                type="text"
                required
                minLength={3}
                maxLength={120}
                placeholder="Nom interne"
                className="rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              >
                + Créer
              </button>
            </div>
          </label>
        </form>
      </header>

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
                  Aucune campagne. Crée la première via le bouton ci-dessus.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-medium text-stone-900">{c.name}</td>
                  <td className="px-3 py-2 text-stone-700 max-w-xs truncate">{c.subject || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {Array.isArray(c.audienceLinkIds) ? `${c.audienceLinkIds.length} listes` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500 whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleString('fr-FR', { dateStyle: 'short' })}
                  </td>
                  <td className="px-3 py-2 text-right">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
