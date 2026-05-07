import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listWebhookEndpoints } from '@/lib/db/queries/webhook-endpoints';

export const dynamic = 'force-dynamic';

export default async function AdminWebhooksPage() {
  const session = await requireAdmin('/admin/webhooks');
  const endpoints = await listWebhookEndpoints();

  return (
    <AdminShell adminEmail={session.email} active="webhooks">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Webhooks</h1>
          <p className="mt-1 text-sm text-stone-600">
            {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Link
          href="/admin/webhooks/new"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Nouvel endpoint
        </Link>
      </header>
      {endpoints.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Aucun endpoint configuré.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {endpoints.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">{e.url}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {e.events.join(', ')} · {e.active ? 'actif' : 'inactif'}
                  </p>
                </div>
                <Link
                  href={`/admin/webhooks/${e.id}/deliveries`}
                  className="text-sm text-stone-700 underline-offset-2 hover:underline"
                >
                  Livraisons
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
