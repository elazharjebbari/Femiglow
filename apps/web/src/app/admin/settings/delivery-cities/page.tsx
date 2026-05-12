/**
 * CHA-230 — Admin /admin/settings/delivery-cities
 *
 * Listing + CRUD du catalogue de villes de livraison piloté par
 * `delivery_cities`. Le contenu (430 villes côté MA, source `sendit`)
 * est seedé via `pnpm run seed:delivery-cities` ou le bouton
 * « Réimporter sendit » qui rejoue le seeder en préservant les éditions
 * manuelles (`source !== 'sendit'`).
 *
 * Pourquoi un Server Component qui transmet le premier batch au
 * Client Component ? Pour éviter un FOUC sur le tableau et permettre
 * à Next.js de servir un HTML rendu avec les données — le tri/filtre
 * côté client ne reste qu'un nice-to-have UX.
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { DeliveryCitiesEditor } from '@/components/admin/settings/DeliveryCitiesEditor';
import {
  countActiveDeliveryCities,
  listDeliveryCities,
} from '@/lib/db/queries/delivery-cities';

export const dynamic = 'force-dynamic';

export default async function AdminDeliveryCitiesPage() {
  const session = await requireAdmin('/admin/settings/delivery-cities');
  const [initial, activeCount] = await Promise.all([
    listDeliveryCities({ page: 1, pageSize: 50, sort: 'name' }),
    countActiveDeliveryCities('MA'),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="settings">
      <DeliveryCitiesEditor
        initialItems={initial.items.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }))}
        initialTotal={initial.total}
        initialPage={initial.page}
        initialPageSize={initial.pageSize}
        activeCount={activeCount}
      />
    </AdminShell>
  );
}
