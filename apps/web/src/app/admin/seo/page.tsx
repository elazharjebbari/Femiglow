import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listOverrides } from '@/lib/db/queries/seo';
import { getSeoSettings } from '@/lib/db/queries/seo';
import { SEO_SCOPES, type SeoScope } from '@/lib/seo/types';
import { SeoBulkPanel } from '@/components/admin/seo/SeoBulkPanel';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{ scope?: string; search?: string }> | { scope?: string; search?: string };
}

export default async function AdminSeoListPage({ searchParams }: PageProps) {
  const session = await requireAdmin('/admin/seo');
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const scope =
    sp.scope && SEO_SCOPES.includes(sp.scope as SeoScope) ? (sp.scope as SeoScope) : undefined;
  const search = sp.search || undefined;

  const [{ items, total }, settings] = await Promise.all([
    listOverrides({ scope, search, limit: 100 }),
    getSeoSettings(),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="seo">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">SEO</h1>
          <p className="mt-1 text-sm text-stone-600">
            Overrides par cible (page, composant, produit, article). Cascade : defaults →
            settings → overrides publiés.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/seo/settings"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Settings
          </Link>
          <Link
            href="/admin/seo/new"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            + Nouvel override
          </Link>
        </div>
      </header>

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-stone-200 bg-white p-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Scope</span>
          <select
            name="scope"
            defaultValue={scope ?? ''}
            className="rounded border border-stone-200 bg-white px-2 py-1"
          >
            <option value="">Tous</option>
            {SEO_SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Recherche</span>
          <input
            type="search"
            name="search"
            defaultValue={search ?? ''}
            placeholder="target_key, title…"
            className="w-64 rounded border border-stone-200 bg-white px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          Filtrer
        </button>
      </form>

      <p className="mb-2 text-xs text-stone-500">
        {total} override{total === 1 ? '' : 's'}
        {settings.knownPages.length > 0
          ? ` · ${settings.knownPages.length} pages connues`
          : ''}
      </p>

      <SeoBulkPanel items={items} />
    </AdminShell>
  );
}
