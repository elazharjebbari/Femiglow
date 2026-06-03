import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  listSiteComponents,
  listSiteComponentsByGroup,
} from '@/lib/db/queries/site-components';
import { listBindingsByComponent } from '@/lib/db/queries/component-bindings';
import { listBindingsByComponent as listFieldBindingsByComponent } from '@/lib/db/queries/component-fields';
import { ComponentsBulkPanel } from '@/components/admin/components/ComponentsBulkPanel';
import { PageGroupEditors } from '@/components/admin/components/PageGroupEditors';
import type { ComponentListCounts } from '@/components/admin/components/ComponentList';

export const dynamic = 'force-dynamic';

export default async function AdminComponentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/components');
  const pageGroup =
    typeof searchParams.group === 'string' ? searchParams.group : undefined;

  const all = await listSiteComponents({ pageGroup });
  const grouped = pageGroup ? { [pageGroup]: all } : await listSiteComponentsByGroup();

  // Pré-calcul des compteurs (bindings actifs + drafts) en parallèle.
  const countsEntries = await Promise.all(
    all.map(async (c): Promise<[string, ComponentListCounts]> => {
      const [media, fields] = await Promise.all([
        listBindingsByComponent(c.id),
        listFieldBindingsByComponent(c.id),
      ]);
      return [
        c.id,
        {
          active: media.filter((b) => b.isActive).length,
          total: media.length,
          drafts: fields.filter((b) => b.status === 'draft').length,
        },
      ];
    }),
  );
  const countsMap = new Map(countsEntries);
  const countsRecord = Object.fromEntries(countsEntries);

  const totalActive = Array.from(countsMap.values()).reduce((s, c) => s + c.active, 0);
  const totalDrafts = Array.from(countsMap.values()).reduce(
    (s, c) => s + (c.drafts ?? 0),
    0,
  );

  const groupKeys = Object.keys(grouped).sort();
  const groups = groupKeys.map((k) => ({ key: k, components: grouped[k] ?? [] }));

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Composants
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {all.length} composant{all.length === 1 ? '' : 's'} référencé
            {all.length === 1 ? '' : 's'} — {totalActive} média
            {totalActive === 1 ? '' : 's'} actif{totalActive === 1 ? '' : 's'}
            {totalDrafts > 0
              ? ` · ${totalDrafts} draft${totalDrafts > 1 ? 's' : ''} en attente`
              : ''}
            .
          </p>
        </div>
        <nav aria-label="Actions composants" className="flex flex-wrap gap-2">
          <Link
            href="/admin/components/seed"
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Seed depuis docs/
          </Link>
          <Link
            href="/admin/components/animations"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Animations
          </Link>
          <Link
            href="/admin/components/scheduled"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Programmées
          </Link>
          <Link
            href="/admin/audit?resource=componentField"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Audit
          </Link>
        </nav>
      </header>

      <nav
        aria-label="Filtre par page"
        className="mb-6 flex flex-wrap gap-2 text-sm"
      >
        <FilterChip href="/admin/components" active={!pageGroup} label="Tous" />
        {(['home', 'rituel', 'kit', 'maison', 'journal'] as const).map((g) => (
          <FilterChip
            key={g}
            href={`/admin/components?group=${g}`}
            active={pageGroup === g}
            label={g}
          />
        ))}
      </nav>

      {/* Éditeurs de sections dédiés au groupe courant (ex. /kit : Vidéo,
          Composition, Pack). Rendu en contexte au-dessus de la liste plutôt
          que dans la nav globale. */}
      <PageGroupEditors group={pageGroup} />

      {groups.length === 0 ? (
        <p className="rounded-md border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Aucun composant. Cliquez sur « Seed depuis docs/ » pour initialiser le registre.
        </p>
      ) : (
        <ComponentsBulkPanel groups={groups} counts={countsRecord} />
      )}
    </AdminShell>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        active ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 hover:bg-stone-100'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}
