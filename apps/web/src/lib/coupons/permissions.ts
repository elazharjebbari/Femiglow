/**
 * RBAC enforcement pour la ressource `coupons` — calqué sur
 * `lib/legal/permissions.ts`. 403 si le rôle n'a pas l'action demandée.
 * cf. docs/coupons-qa-2026-06-02/13-rbac/.
 */
import { getAdminRole, hasPermission } from '@/lib/legal/permissions';
import type { RbacAction } from '@/lib/admin-config/types';
import type { AdminSession } from '@/lib/auth/session';
import { HttpError } from '@/lib/errors/http-error';

export async function requireCouponPermission(
  action: RbacAction,
  session: AdminSession,
): Promise<void> {
  const role = await getAdminRole(session.adminId);
  if (!hasPermission(role, 'coupons', action)) {
    throw new HttpError(
      'forbidden',
      `Permission refusée : rôle "${role}" sans droit "${action}" sur coupons.`,
    );
  }
}
