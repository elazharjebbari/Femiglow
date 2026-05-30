/**
 * Page admin — Moteur de suggestion de langue (`/admin/i18n/engine`, lot L11).
 *
 * Server Component : `requireAdmin` → `getAdminEngineConfig` (payload validé +
 * version) → éditeur client optimiste dans `AdminShell`. OFF par défaut
 * (INV-13) ; pilotable sans redéploiement (INV-18).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/admin-feature-spec.md
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { EngineEditor } from '@/components/admin/i18n/EngineEditor';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getAdminEngineConfig } from '@/lib/i18n/engine-config';

export const dynamic = 'force-dynamic';

export default async function AdminI18nEnginePage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/i18n/engine');
  const { payload, version, updatedAt, updatedBy, isDefault } =
    await getAdminEngineConfig();
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <EngineEditor
        initialConfig={payload}
        meta={{ version, updatedAt, updatedBy, isDefault }}
      />
    </AdminShell>
  );
}
