import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
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
  await requireAdmin('/admin/tracking/events/mappings');
  return (
    <main className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900">Mappings event ↔ vendors</h1>
        <p className="text-sm text-stone-500">
          Configure la correspondance des événements canoniques vers Meta, GA4, Google Ads,
          TikTok, Snap, Pinterest. Versionnée, exportable vers GTM, restaurable au factory en 1 click.
        </p>
      </header>
      <MappingVersionsList />
    </main>
  );
}
