/**
 * RBAC enforcement runtime — vérifie qu'une session admin a la permission
 * pour effectuer une action sur la ressource `legal`.
 *
 * Stratégie V1 :
 *  - Récupère le rôle de l'admin depuis `admin_users.role` (si la colonne
 *    existe ; sinon défaut `superadmin` pour back-compat).
 *  - Résout la matrice depuis `rbacDefault` (V1.1 : lire la config
 *    sauvée en DB via admin-config si présente).
 *  - 403 si la permission n'est pas accordée.
 *
 * Usage dans une route :
 * ```ts
 * await requireLegalPermission('publish', session);
 * ```
 */
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

import { rbacDefault } from '@/lib/admin-config/defaults';
import type { RbacAction, RbacResource } from '@/lib/admin-config/types';
import type { AdminSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { adminUsers } from '@/lib/db/schema';
import { HttpError } from '@/lib/errors/http-error';

export type Role = 'superadmin' | 'admin' | 'editor' | 'viewer';

const DEFAULT_ROLE: Role = 'superadmin';

/**
 * Récupère le rôle d'un admin. Lit `admin_users.role` si la colonne
 * existe ; fallback `superadmin` (back-compat) si :
 *  - la colonne n'existe pas (back-compat DB)
 *  - l'admin n'a pas de role assigné
 *  - DB indisponible
 */
export async function getAdminRole(adminId: string): Promise<Role> {
  const conn = db();
  if (!conn) return DEFAULT_ROLE;
  try {
    // Sélection brute via SQL pour ne pas bloquer si la colonne `role`
    // n'a pas encore été ajoutée à la table (migration V1.1).
    const rows = await conn.execute(
      sql`SELECT role FROM admin_users WHERE id = ${adminId} LIMIT 1`,
    );
    const list = (rows as unknown as { rows?: Array<{ role?: string }> }).rows ?? rows;
    const arr = Array.isArray(list) ? list : [];
    const role = (arr[0] as { role?: string } | undefined)?.role;
    if (role && ['superadmin', 'admin', 'editor', 'viewer'].includes(role)) {
      return role as Role;
    }
    return DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

/**
 * Renvoie true si le rôle a la permission `action` sur `resource`.
 */
export function hasPermission(role: Role, resource: RbacResource, action: RbacAction): boolean {
  const matrix = rbacDefault.matrix[role];
  if (!matrix) return false;
  const actions = matrix[resource];
  if (!actions) return false;
  return actions.includes(action);
}

/**
 * Helper : throw HttpError('forbidden') si la session n'a pas la
 * permission `action` sur `legal`.
 */
export async function requireLegalPermission(
  action: RbacAction,
  session: AdminSession,
): Promise<void> {
  const role = await getAdminRole(session.adminId);
  if (!hasPermission(role, 'legal', action)) {
    throw new HttpError(
      'forbidden',
      `Permission refusée : rôle "${role}" sans droit "${action}" sur legal.`,
    );
  }
}

// Re-export pour faciliter le tree-shake côté tests
export { eq, adminUsers };
