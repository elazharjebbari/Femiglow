/**
 * /admin/settings/form-config — liste des wizards (kit, commander).
 *
 * Affiche une `FormConfigCard` par wizard. Si un wizard n'est pas seedé,
 * affiche un avertissement "Non initialisé".
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §3.2
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { FormConfigCard } from '@/components/admin/settings/FormConfigCard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';

export const dynamic = 'force-dynamic';

const WIZARDS: Array<{ key: 'wizard_kit' | 'wizard_commander'; label: string; description: string }> = [
  {
    key: 'wizard_kit',
    label: 'Wizard Kit',
    description: 'Wizard intégré sur la page /kit (Mode A — embed).',
  },
  {
    key: 'wizard_commander',
    label: 'Wizard Commander',
    description: 'Wizard panier sur la page /commander (Mode B — cart review).',
  },
];

export default async function AdminFormConfigListPage() {
  const session = await requireAdmin('/admin/settings/form-config');

  const rows = await Promise.all(
    WIZARDS.map(async (w) => ({ ...w, row: await formConfigRepo.getByKey(w.key) })),
  );

  return (
    <AdminShell adminEmail={session.email} active="settings">
      <nav aria-label="Fil d'ariane" className="mb-4 text-xs text-stone-500">
        <Link href="/admin/settings" className="underline-offset-2 hover:underline">
          Réglages
        </Link>{' '}
        / <span className="text-stone-700">Form Config</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Configuration des formulaires
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Édite les wizards de commande (steps, copy, validation). Chaque sauvegarde
          est versionnée et auditée. Les routes publiques sont invalidées
          automatiquement après chaque modification.
        </p>
      </header>
      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Wizards form-config"
        data-testid="form-config-list"
      >
        {rows.map((w) =>
          w.row ? (
            <FormConfigCard
              key={w.key}
              href={`/admin/settings/form-config/${w.key}`}
              label={w.label}
              description={w.description}
              version={w.row.version}
              active={w.row.active}
              updatedAt={w.row.updatedAt.toISOString()}
              updatedBy={w.row.updatedBy}
            />
          ) : (
            <div
              key={w.key}
              className="flex flex-col rounded-md border border-dashed border-amber-300 bg-amber-50 p-5"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-base font-semibold tracking-tight text-stone-900">
                  {w.label}
                </h2>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
                  Non initialisé
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-600">{w.description}</p>
              <p className="mt-4 text-xs text-stone-500">
                Aucune ligne en DB pour <code className="font-mono">{w.key}</code>.
                Exécute la migration de seed{' '}
                <code className="font-mono">0024_seed_form_config_defaults.sql</code>.
              </p>
            </div>
          ),
        )}
      </section>
      <footer className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong className="font-semibold">Note :</strong> chaque modification crée
        une nouvelle version dans <code className="font-mono">form_config_history</code>.
        Le rollback est disponible depuis l'onglet « Historique » de chaque wizard.
      </footer>
    </AdminShell>
  );
}
