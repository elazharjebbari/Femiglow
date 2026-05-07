import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SectionCard } from '@/components/admin/settings/SectionCard';
import { getAppConfig } from '@/lib/admin-config/resolve';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const session = await requireAdmin('/admin/settings');
  const config = await getAppConfig();

  const flagCount = Object.keys(config.flags.flags).length;
  const modifiedFlagCount = Object.entries(config.flags.flags).filter(
    ([, v]) => v === true,
  ).length;
  const roleCount = Object.keys(config.rbac.matrix).length;
  const navCount = config.nav.items.length;
  const brandingChangedCount =
    (config.branding.logoMediaId ? 1 : 0) +
    (config.branding.fonts.heading !== 'Cormorant Garamond' ? 1 : 0) +
    (config.branding.fonts.body !== 'Inter' ? 1 : 0);

  return (
    <AdminShell adminEmail={session.email} active="settings">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Réglages</h1>
        <p className="mt-1 text-sm text-stone-600">
          Configuration centralisée du site et de l'admin. Cascade :{' '}
          <code className="rounded bg-stone-100 px-1 text-xs">defaults TS</code> →{' '}
          <code className="rounded bg-stone-100 px-1 text-xs">DB</code> → résolu.
        </p>
      </header>
      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Sections de configuration"
      >
        <SectionCard
          href="/admin/settings/navigation"
          title="Navigation"
          description="Items affichés dans la sidebar admin (libellés, ordre, icônes)."
          count={navCount}
          countLabel="items"
          meta={config.meta.nav}
        />
        <SectionCard
          href="/admin/settings/flags"
          title="Feature Flags"
          description="Bascules pour activer/désactiver des fonctionnalités."
          count={flagCount}
          countLabel={`flags · ${modifiedFlagCount} actifs`}
          meta={config.meta.flags}
        />
        <SectionCard
          href="/admin/settings/rbac"
          title="RBAC"
          description="Matrice rôles × ressources × actions."
          count={roleCount}
          countLabel="rôles"
          meta={config.meta.rbac}
        />
        <SectionCard
          href="/admin/settings/branding"
          title="Branding"
          description="Couleurs, polices et logo du site."
          count={brandingChangedCount}
          countLabel="éléments custom"
          meta={config.meta.branding}
        />
      </section>
      <footer className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong className="font-semibold">Sécurité :</strong> chaque modification est
        snapshotée et auditée. La cascade fait du failsafe en cas de payload invalide.
      </footer>
    </AdminShell>
  );
}
