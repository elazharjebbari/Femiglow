/**
 * /admin/emails/transactional — Liste outbox avec filtre par statut.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listRecentOutbox } from '@/lib/admin/emails/queries';

export const dynamic = 'force-dynamic';

const STATUSES = [
  '',
  'pending',
  'sending',
  'sent',
  'delivered',
  'failed',
  'bounced_soft',
  'bounced_permanent',
  'dlq',
] as const;

export default async function TransactionalListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/emails/transactional');
  const status =
    typeof searchParams.status === 'string' && (STATUSES as readonly string[]).includes(searchParams.status)
      ? searchParams.status
      : undefined;
  const rows = await listRecentOutbox({ limit: 200, status });

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Transactionnel
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {rows.length} envoi{rows.length === 1 ? '' : 's'} récent{rows.length === 1 ? '' : 's'}
            {status ? ` · statut ${status}` : ''}
          </p>
        </div>
        <Link href="/admin/emails" className="text-sm text-stone-500 underline">
          ← Dashboard
        </Link>
      </header>

      <form className="mb-6" role="search">
        <label className="block">
          <span className="block text-xs font-medium text-stone-600">Statut</span>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="mt-1 w-48 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            onChange={undefined}
          >
            <option value="">— Tous —</option>
            <option value="pending">pending</option>
            <option value="sending">sending</option>
            <option value="sent">sent</option>
            <option value="delivered">delivered</option>
            <option value="failed">failed</option>
            <option value="bounced_soft">bounced_soft</option>
            <option value="bounced_permanent">bounced_permanent</option>
            <option value="dlq">dlq</option>
          </select>
        </label>
        <button
          type="submit"
          className="mt-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          Filtrer
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Template</th>
              <th className="px-3 py-2 text-left font-medium">Destinataire</th>
              <th className="px-3 py-2 text-left font-medium">Sujet</th>
              <th className="px-3 py-2 text-left font-medium">Statut</th>
              <th className="px-3 py-2 text-left font-medium">Att.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-stone-500">
                  Aucun envoi pour ce filtre.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/60">
                  <td className="px-3 py-2 text-xs text-stone-600 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.template}</td>
                  <td className="px-3 py-2 text-stone-700">{r.toEmail}</td>
                  <td className="px-3 py-2 text-stone-600 max-w-xs truncate">{r.subject}</td>
                  <td className="px-3 py-2">
                    <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">{r.attempts}/{r.maxAttempts}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/emails/transactional/${r.id}`} className="text-xs text-stone-600 underline">
                      Voir
                    </Link>
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
