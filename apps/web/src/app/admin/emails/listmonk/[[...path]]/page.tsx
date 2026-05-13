/**
 * /admin/emails/listmonk[/...path]
 *
 * Wrapper page that hosts the Listmonk UI in an iframe (M3.3, Niveau 2
 * integration). The user stays in admin.femiglow-maroc.com — no second
 * domain, no second login.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { ListmonkFrame } from '@/components/admin/emails/ListmonkFrame';

export const dynamic = 'force-dynamic';

export default async function ListmonkWrapperPage({
  params,
}: {
  params: { path?: string[] };
}) {
  const session = await requireAdmin('/admin/emails/listmonk');
  const path = '/' + (params.path?.join('/') ?? 'admin');

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <Link href="/admin/emails" className="text-sm text-stone-500 underline">
            ← Dashboard emails
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Listmonk
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Path : <code className="font-mono">{path}</code>
          </p>
        </div>
        <a
          href={`/api/listmonk${path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-stone-500 underline"
        >
          Ouvrir dans un nouvel onglet ↗
        </a>
      </header>

      <ListmonkFrame path={path} />
    </AdminShell>
  );
}
