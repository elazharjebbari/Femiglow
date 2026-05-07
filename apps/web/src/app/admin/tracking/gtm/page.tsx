import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { gtmExporter } from '@/lib/tracking/gtm/exporter';
import { GtmExportClient } from '@/components/admin/tracking/gtm/GtmExportClient';

export const dynamic = 'force-dynamic';

export default async function TrackingGtmPage() {
  const session = await requireAdmin('/admin/tracking/gtm');
  const initial = gtmExporter.build({ env: 'production' });

  return (
    <TrackingShell
      adminEmail={session.email}
      active="gtm"
      title="Export GTM"
      description="Le conteneur Google Tag Manager est généré depuis le catalogue d'événements. Visualise, télécharge ou copie le fichier de configuration à importer."
    >
      <GtmExportClient
        initial={{
          pretty: initial.pretty,
          stats: initial.stats,
          meta: initial.meta,
          env: 'production',
        }}
      />
    </TrackingShell>
  );
}
