import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { ValidatePairWizard } from '@/components/admin/tracking/gtm/ValidatePairWizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Valider import GTM — Tracking',
};

/**
 * /admin/tracking/gtm/validate-pair — Couche A Poka-Yoke
 * Wizard pré-import : drop des 2 JSON → diff → verdict.
 */
export default async function ValidatePairPage() {
  const session = await requireAdmin('/admin/tracking/gtm/validate-pair');

  return (
    <TrackingShell
      adminEmail={session.email}
      active="gtm-validate"
      title="Valider l'import GTM"
      description="Vérifie la cohérence de tes 2 fichiers (config + mapping) AVANT de les importer dans GTM."
    >
      <ValidatePairWizard />
    </TrackingShell>
  );
}
