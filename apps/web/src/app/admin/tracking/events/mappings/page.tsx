import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { MappingVersionsList } from '@/components/admin/tracking/mappings/MappingVersionsList';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mappings event ↔ vendors — Tracking',
};

/**
 * /admin/tracking/events/mappings — Liste des versions de mappings.
 * cf. docs/event-mappings/40-frontend/routing.md
 */
export default async function MappingsPage() {
  const session = await requireAdmin('/admin/tracking/events/mappings');
  return (
    <TrackingShell
      adminEmail={session.email}
      active="mappings"
      title="Mappings event ↔ vendors"
      description="Configure la correspondance des événements canoniques vers Meta, GA4, Google Ads, TikTok, Snap, Pinterest. Versionnée, exportable vers GTM, restaurable au factory en 1 click."
    >
      <MappingVersionsList />
    </TrackingShell>
  );
}
