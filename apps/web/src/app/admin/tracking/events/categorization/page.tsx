import { Metadata } from 'next';
import { EventCategorizationTable } from '@/components/admin/tracking/events/EventCategorizationTable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Catégorisation Google Ads — Tracking',
};

/**
 * Page admin /admin/tracking/events/categorization (T27 + C3.F.1).
 *
 * Affiche tous les events conversion avec leur catégorie Google Ads
 * (default + override). L'admin peut override par event via le dropdown
 * et reset au default. D-005.
 */
export default function CategorizationPage() {
  return (
    <main className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900">
          Catégorisation Google Ads
        </h1>
        <p className="text-sm text-stone-500">
          Mappe chaque event conversion vers une catégorie Google Ads
          (Conversion Action Category). Le default est issu du catalog (code).
          L'admin peut override par event ; un reset rétablit le default.
        </p>
      </header>
      <EventCategorizationTable />
    </main>
  );
}
