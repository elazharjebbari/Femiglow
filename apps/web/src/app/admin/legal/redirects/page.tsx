import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { SlugRedirectsManager } from '@/components/admin/legal/SlugRedirectsManager';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listSlugRedirects } from '@/lib/legal/redirects';

export const dynamic = 'force-dynamic';

export default async function SlugRedirectsPage() {
  const session = await requireAdmin('/admin/legal/redirects');
  const rows = await listSlugRedirects();

  return (
    <AdminShell adminEmail={session.email} active="legal">
      <header className="mb-6">
        <Link href="/admin/legal" className="text-xs text-stone-500 hover:underline">
          ← Pages légales
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Slug redirects
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Préserve le SEO et les liens externes après renommage d&apos;une page.
          Toute requête sur l&apos;ancien slug renvoie un 301 vers le nouveau.
        </p>
      </header>

      <SlugRedirectsManager
        initial={rows.map((r) => ({
          old_slug: r.oldSlug,
          new_slug: r.newSlug,
          created_at: r.createdAt.toISOString(),
          created_by: r.createdBy,
        }))}
      />
    </AdminShell>
  );
}
