import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SectionCard } from '@/components/admin/settings/SectionCard';
import { getAppConfig } from '@/lib/admin-config/resolve';
import {
  countActiveDeliveryCities,
  listDeliveryCities,
} from '@/lib/db/queries/delivery-cities';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { SEEDERS_REGISTRY } from '@/lib/seeders/registry';

export const dynamic = 'force-dynamic';

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

export default async function AdminSettingsPage() {
  const session = await requireAdmin('/admin/settings');
  const [config, activeCityCount, latestCities, wizardKit, wizardCommander] =
    await Promise.all([
      getAppConfig(),
      countActiveDeliveryCities('MA'),
      // On lit la plus récente édition pour afficher la fraîcheur dans la card.
      listDeliveryCities({ page: 1, pageSize: 1, sort: 'updated' }),
      formConfigRepo.getByKey('wizard_kit'),
      formConfigRepo.getByKey('wizard_commander'),
    ]);
  const latestCityUpdate = latestCities.items[0]?.updatedAt ?? null;
  const totalCityCount = latestCities.total;

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

  // Form-config stats : nombre de wizards seedés + nombre actifs.
  const wizardSeededCount = [wizardKit, wizardCommander].filter(Boolean).length;
  const wizardActiveCount = [wizardKit, wizardCommander].filter(
    (w) => w?.active,
  ).length;
  const latestWizardUpdate = [wizardKit?.updatedAt, wizardCommander?.updatedAt]
    .filter((d): d is Date => d !== undefined && d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

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
        {/*
          CHA-230 — Section villes de livraison. Vit hors du modèle
          `admin_config` (table dédiée `delivery_cities`), donc on ne
          peut pas réutiliser SectionCard avec un ConfigMeta. On rend
          une carte similaire mais autonome.
        */}
        <Link
          href="/admin/settings/delivery-cities"
          className="group flex flex-col rounded-md border border-stone-200 bg-white p-5 transition hover:border-stone-400 hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold tracking-tight text-stone-900">
              Villes de livraison
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
              {totalCityCount > 0 ? 'Catalogue actif' : 'Vide'}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Catalogue des villes desservies, importé depuis sendit (430 villes
            MA). Édition prix / ETA / activation.
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-stone-900">
              {activeCityCount}
            </span>
            <span className="text-xs uppercase tracking-wide text-stone-500">
              villes actives · {totalCityCount} au total
            </span>
          </div>
          <p className="mt-4 text-xs text-stone-500">
            {latestCityUpdate
              ? `Dernière édition ${relativeTime(latestCityUpdate)}`
              : 'Aucune édition pour le moment.'}
          </p>
        </Link>
        {/*
          CHA-230 admin — Configuration des wizards de commande (form-config).
          Vit dans la table `form_config` (hors admin_config). Card autonome
          identique au pattern delivery-cities.
        */}
        <Link
          href="/admin/settings/form-config"
          data-testid="settings-card-form-config"
          className="group flex flex-col rounded-md border border-stone-200 bg-white p-5 transition hover:border-stone-400 hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold tracking-tight text-stone-900">
              Configuration des formulaires
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                wizardSeededCount === 0
                  ? 'bg-amber-200 text-amber-900'
                  : wizardActiveCount > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-stone-600'
              }`}
            >
              {wizardSeededCount === 0
                ? 'Non initialisé'
                : wizardActiveCount > 0
                  ? `${wizardActiveCount} actif${wizardActiveCount > 1 ? 's' : ''}`
                  : 'Tous inactifs'}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Steps, copy et validation des wizards <code className="font-mono">kit</code>{' '}
            et <code className="font-mono">commander</code>. Versionné + audit.
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-stone-900">
              {wizardSeededCount}
            </span>
            <span className="text-xs uppercase tracking-wide text-stone-500">
              wizard{wizardSeededCount > 1 ? 's' : ''} configuré
              {wizardSeededCount > 1 ? 's' : ''}
            </span>
          </div>
          <p className="mt-4 text-xs text-stone-500">
            {latestWizardUpdate
              ? `Dernière édition ${relativeTime(latestWizardUpdate)}`
              : 'Aucune édition pour le moment.'}
          </p>
        </Link>
        {/*
          Seeders Runner — point d'entrée unique pour relancer les feeds de
          configuration par défaut (analytics/tracking/media/composants/villes
          /paramètres/menu/chat/produits/rituels). UI dédiée avec progress + ETA.
        */}
        <Link
          href="/admin/settings/seeders"
          data-testid="settings-card-seeders"
          className="group flex flex-col rounded-md border border-stone-200 bg-white p-5 transition hover:border-stone-400 hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold tracking-tight text-stone-900">
              Seeders (configuration par défaut)
            </h2>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-800">
              {SEEDERS_REGISTRY.length} feeds
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Relance les feeds de seed (analytics, tracking, médias, composants,
            villes, chat, etc.) pour rétablir la configuration de référence.
            Idempotent.
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-stone-900">
              {SEEDERS_REGISTRY.length}
            </span>
            <span className="text-xs uppercase tracking-wide text-stone-500">
              feeds · 5 groupes
            </span>
          </div>
          <p className="mt-4 text-xs text-stone-500">
            Progress + ETA en direct, sélection feed par feed.
          </p>
        </Link>
      </section>
      <footer className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong className="font-semibold">Sécurité :</strong> chaque modification est
        snapshotée et auditée. La cascade fait du failsafe en cas de payload invalide.
      </footer>
    </AdminShell>
  );
}
