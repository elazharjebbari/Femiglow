/**
 * /admin/emails/listmonk[/...path]
 *
 * Wrapper page that hosts the Listmonk UI in an iframe (M3.3, Niveau 2
 * integration). The user stays in admin.femiglow-maroc.com — no second
 * domain, no second login.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
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
  const publicOrigin = env.LISTMONK_PUBLIC_URL;
  const externalHref = publicOrigin
    ? `${publicOrigin.replace(/\/$/, '')}${path}`
    : `/api/listmonk${path}`;

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
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-stone-500 underline"
        >
          Ouvrir dans un nouvel onglet ↗
        </a>
      </header>

      {publicOrigin ? (
        <ListmonkFrame path={path} publicOrigin={publicOrigin} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Listmonk n'est pas encore exposé publiquement.</p>
          <p className="mt-2">
            Configure <code className="font-mono">LISTMONK_PUBLIC_URL</code> dans{' '}
            <code>apps/web/.env</code> (ex. <code>https://listmonk.femiglow-maroc.com</code>) +
            le vhost LiteSpeed correspondant, puis recharge cette page.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
