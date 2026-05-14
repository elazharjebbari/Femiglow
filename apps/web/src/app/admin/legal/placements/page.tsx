import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { PlacementMatrix } from '@/components/admin/legal/PlacementMatrix';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listAllPlacements, listAllZones, listLegalPages } from '@/lib/legal/repository';

export const dynamic = 'force-dynamic';

export default async function PlacementsPage() {
  const session = await requireAdmin('/admin/legal/placements');
  const [zones, pages, placements] = await Promise.all([
    listAllZones(),
    listLegalPages(),
    listAllPlacements(),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="legal">
      <header className="mb-6">
        <Link href="/admin/legal" className="text-xs text-stone-500 hover:underline">
          ← Pages légales
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Matrice de placements
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Coche les zones où chaque page doit apparaître. Les zones avec un trait rouge
          (footer-main, checkout-consent) sont obligatoires.
        </p>
      </header>

      <PlacementMatrix
        zones={zones.map((z) => ({
          key: z.key,
          label: z.label,
          isRequired: z.isRequired,
          maxItemsRecommended: z.maxItemsRecommended,
        }))}
        pages={pages.map((p) => ({ slug: p.slug, title: p.title, status: p.status }))}
        placements={placements.map((p) => ({
          pageSlug: p.pageSlug,
          zoneKey: p.zoneKey,
          isVisible: p.isVisible,
          displayOrder: p.displayOrder,
          labelOverride: p.labelOverride,
        }))}
      />
    </AdminShell>
  );
}
