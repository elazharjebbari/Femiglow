/**
 * Page admin `/admin/seo/audit-log` — vue chronologique des actions SEO.
 *
 * Server Component qui charge la 1re page en SSR puis hydrate le composant
 * client `SeoAuditLogPanel` (filtres + pagination).
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/auth/require-admin';
import { listSeoAuditEvents } from '@/lib/db/queries/seo';

import { SeoAuditLogPanel } from '@/components/admin/seo/SeoAuditLogPanel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SeoAuditLogPage(): Promise<JSX.Element> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login?next=/admin/seo/audit-log');

  const page = await listSeoAuditEvents({ limit: 20 });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <p className="text-xs text-stone-500">
          <Link href="/admin/seo" className="underline hover:text-stone-900">
            ← Retour aux overrides SEO
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          Journal d'audit SEO
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Historique chronologique des actions SEO (overrides, settings, bulk).
          Données issues de la table <code className="font-mono text-xs">audit_events</code>{' '}
          filtrées sur le préfixe <code className="font-mono text-xs">seo.</code> et les
          ressources SEO (<code className="font-mono text-xs">seo_overrides</code>,{' '}
          <code className="font-mono text-xs">seo_settings</code>,{' '}
          <code className="font-mono text-xs">seo_audit_snapshot</code>).
        </p>
      </header>

      <SeoAuditLogPanel
        initialEvents={page.events}
        initialNextCursor={page.nextCursor}
      />
    </main>
  );
}
