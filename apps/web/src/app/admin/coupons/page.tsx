/**
 * /admin/coupons — gestion des coupons (CPN-10/11/12).
 *
 * RSC : auth + fetch initial server-side, puis délègue à `<CouponsManager/>`
 * (client) pour les mutations via les routes /api/admin/coupons/**.
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { CouponsManager } from '@/components/admin/coupons/CouponsManager';
import { listCoupons } from '@/lib/db/queries/coupon-repo';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  const session = await requireAdmin('/admin/coupons');
  const coupons = await listCoupons();
  const initial = coupons.map((c) => ({
    ...c,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <AdminShell adminEmail={session.email} active="coupons">
      <CouponsManager initialCoupons={initial} />
    </AdminShell>
  );
}
