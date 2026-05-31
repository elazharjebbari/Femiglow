/**
 * /admin/settings/seeders — Seeders Runner UI.
 *
 * Liste les 16 seeders disponibles regroupés par groupe (core/commerce/
 * content/chat/tracking), permet à l'admin d'en sélectionner un sous-ensemble
 * et de lancer un job. Le composant client `SeedersRunner` gère la sélection,
 * l'appel `POST /api/admin/seeders/run`, et le flux SSE de progression.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SeedersRunner } from '@/components/admin/settings/SeedersRunner';
import { SEEDERS_REGISTRY } from '@/lib/seeders/registry';

export const dynamic = 'force-dynamic';

export default async function AdminSeedersPage() {
  const session = await requireAdmin('/admin/settings/seeders');

  const seeders = SEEDERS_REGISTRY.map((s) => ({
    id: s.id,
    group: s.group,
    label: s.label,
    description: s.description,
    estimatedDurationMs: s.estimatedDurationMs,
    idempotent: s.idempotent,
  }));

  const totalEtaMs = seeders.reduce((sum, s) => sum + s.estimatedDurationMs, 0);

  return (
    <AdminShell adminEmail={session.email} active="settings">
      <nav className="mb-2 text-xs text-stone-500" aria-label="Fil d'Ariane">
        <Link href="/admin/settings" className="hover:text-stone-700">
          Réglages
        </Link>{' '}
        <span className="px-1">/</span>
        <span className="text-stone-700">Seeders</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Seeders — configuration par défaut
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Relance les feeds de seed pour rétablir la configuration de référence
          du serveur. Chaque seeder est{' '}
          <strong className="font-semibold">idempotent</strong> : l'admin peut
          relancer sans risque, les modifications manuelles sont préservées (le
          seeder ne ré-écrit que les valeurs absentes ou versionnées).
        </p>
        <p className="mt-1 text-xs text-stone-500">
          {seeders.length} feeds disponibles · ETA total si tout coché ≈{' '}
          {(totalEtaMs / 1000).toFixed(0)}s.
        </p>
      </header>

      <SeedersRunner seeders={seeders} />

      <footer className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong className="font-semibold">À savoir :</strong>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>
            Toutes les exécutions sont auditées (action{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">seeders.run</code>{' '}
            avec stats par seeder).
          </li>
          <li>
            Les seeders <em>app_config</em> (nav/flags/rbac/branding) créent une
            nouvelle version : l'historique précédent reste consultable.
          </li>
          <li>
            <em>delivery-cities</em> préserve les éditions admin (les villes
            modifiées ne sont pas écrasées).
          </li>
          <li>
            Le job est conservé en mémoire 1h ; un redémarrage serveur l'efface
            (les seeders sont idempotents, on relance sans danger).
          </li>
        </ul>
      </footer>
    </AdminShell>
  );
}
