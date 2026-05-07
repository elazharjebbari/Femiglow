import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SeedRunnerForm } from '@/components/admin/components/SeedRunnerForm';
import { SITE_COMPONENT_REGISTRY } from '@/lib/components/registry';
import { listSeedSourcePaths } from '@/lib/components/seed-mapping';

export const dynamic = 'force-dynamic';

export default async function AdminComponentsSeedPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/components/seed');
  const componentsCount = SITE_COMPONENT_REGISTRY.length;
  const sourcePaths = listSeedSourcePaths();
  const groupCounts = sourcePaths.reduce<Record<string, number>>((acc, p) => {
    const group = p.split('/')[0] ?? 'other';
    acc[group] = (acc[group] ?? 0) + 1;
    return acc;
  }, {});
  const groups = Object.entries(groupCounts).sort(([a], [b]) => a.localeCompare(b));

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6">
        <nav aria-label="Fil d'Ariane" className="mb-2 text-xs text-stone-500">
          <Link href="/admin/components" className="hover:text-stone-900">
            ← Composants
          </Link>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Seed depuis docs/
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Importe les images de <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">docs/images/values/</code>
          {' '}vers la médiathèque, crée les variants optimisés, et lie chaque image
          à son slot via le mapping <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">seed-mapping.ts</code>.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <SeedRunnerForm />

        <aside aria-label="État du registre" className="space-y-4">
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Registre statique
            </h2>
            <dl className="mt-3 space-y-1 text-xs text-stone-700">
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Composants déclarés</dt>
                <dd className="font-mono">{componentsCount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Images mappées</dt>
                <dd className="font-mono">{sourcePaths.length}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Par groupe
            </h2>
            <ul className="mt-3 space-y-1 text-xs text-stone-700">
              {groups.map(([group, count]) => (
                <li key={group} className="flex justify-between gap-2">
                  <span className="font-mono text-stone-500">{group}</span>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
