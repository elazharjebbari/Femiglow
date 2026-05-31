import { and, desc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import type { AuditEvent } from '@/lib/db/types';

export async function listAuditEventsForResource(
  resourceType: string,
  resourceId: string,
  limit = 50,
): Promise<AuditEvent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.resourceType, resourceType),
          eq(schema.auditEvents.resourceId, resourceId),
        ),
      )
      .orderBy(desc(schema.auditEvents.createdAt))
      .limit(limit);
    return rows as unknown as AuditEvent[];
  }
  return Array.from(memoryStore().auditEvents.values())
    .filter((e) => e.resourceType === resourceType && e.resourceId === resourceId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Liste les N derniers events d'audit toutes ressources confondues.
 * Utilisé par le dashboard `/admin/content-studio-v2/home` (Phase 6) pour
 * peupler l'activity feed. Pas de filtre — on assume que la table reste
 * dans un volume raisonnable (capping à 10 par défaut).
 */
export async function listRecentAuditEvents(limit = 10): Promise<AuditEvent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.auditEvents)
      .orderBy(desc(schema.auditEvents.createdAt))
      .limit(limit);
    return rows as unknown as AuditEvent[];
  }
  return Array.from(memoryStore().auditEvents.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Liste les events d'audit pour un type de ressource (cross-resource).
 * Utilisé par la vue `/admin/audit?resource=componentField` (P11).
 */
export async function listAuditEventsByResourceType(
  resourceType: string,
  limit = 100,
): Promise<AuditEvent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.resourceType, resourceType))
      .orderBy(desc(schema.auditEvents.createdAt))
      .limit(limit);
    return rows as unknown as AuditEvent[];
  }
  return Array.from(memoryStore().auditEvents.values())
    .filter((e) => e.resourceType === resourceType)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
