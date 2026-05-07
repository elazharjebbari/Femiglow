import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { gtmExporter } from '@/lib/tracking/gtm/exporter';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { buildGraphDescriptor } from '@/lib/tracking/gtm/viz/descriptor';
import { GtmAdminTabs } from '@/components/admin/tracking/gtm/GtmAdminTabs';
import { GtmExportClient } from '@/components/admin/tracking/gtm/GtmExportClient';
import { GtmConfigClient } from '@/components/admin/tracking/gtm/GtmConfigClient';
import { GtmVisualizationClient } from '@/components/admin/tracking/gtm/GtmVisualizationClient';

export const dynamic = 'force-dynamic';

export default async function TrackingGtmPage() {
  const session = await requireAdmin('/admin/tracking/gtm');

  const initialExport = gtmExporter.build({ env: 'production' });
  const list = await gtmConfigStore.list();
  const initialDescriptor = buildGraphDescriptor(initialExport.container);

  return (
    <TrackingShell
      adminEmail={session.email}
      active="gtm"
      title="Export GTM"
      description="Le conteneur Google Tag Manager est généré depuis le catalogue d'événements. Visualise, configure les variables, télécharge le fichier de configuration à importer."
    >
      <GtmAdminTabs
        defaultTab="export"
        panels={{
          export: (
            <GtmExportClient
              initial={{
                pretty: initialExport.pretty,
                stats: initialExport.stats,
                meta: initialExport.meta,
                env: 'production',
              }}
              configs={list.versions.map((v) => ({ id: v.id, name: v.name }))}
              activeConfigId={list.activeId}
            />
          ),
          configurations: (
            <GtmConfigClient initialActiveId={list.activeId} initialVersions={list.versions} />
          ),
          visualization: (
            <GtmVisualizationClient
              initialDescriptor={initialDescriptor}
              initialEnv="production"
              configs={list.versions.map((v) => ({
                id: v.id,
                name: v.name,
                notes: v.notes,
                createdAt: v.createdAt,
                createdBy: v.createdBy,
              }))}
              activeConfigId={list.activeId}
            />
          ),
        }}
      />
    </TrackingShell>
  );
}
