/**
 * CRUD queries pour admin_email_view (saved views par admin).
 *
 * Le `system` owner_email='system' renvoie les vues prédéfinies seedées
 * par la migration 0039. Modifiable seulement en ajoutant une variante
 * owned (chaque admin a son propre namespace).
 */
import 'server-only';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { adminEmailView, type AdminEmailViewRow } from '@/lib/db/schema-emails';
import type { CreateViewDto, UpdateViewDto } from './schemas';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type ViewListItem = Pick<
  AdminEmailViewRow,
  'id' | 'ownerEmail' | 'name' | 'scope' | 'filterState' | 'isSystem' | 'createdAt' | 'updatedAt'
>;

/**
 * Liste des vues visibles pour un admin : ses propres custom views + les vues système.
 * Tri : system d'abord, puis custom par date de création desc.
 */
export async function listViewsForAdmin(
  ownerEmail: string,
  scope: 'transactional' | 'campaigns' | 'automation',
): Promise<ViewListItem[]> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select({
      id: adminEmailView.id,
      ownerEmail: adminEmailView.ownerEmail,
      name: adminEmailView.name,
      scope: adminEmailView.scope,
      filterState: adminEmailView.filterState,
      isSystem: adminEmailView.isSystem,
      createdAt: adminEmailView.createdAt,
      updatedAt: adminEmailView.updatedAt,
    })
    .from(adminEmailView)
    .where(
      and(
        eq(adminEmailView.scope, scope),
        or(eq(adminEmailView.ownerEmail, ownerEmail), eq(adminEmailView.isSystem, true)),
        isNull(adminEmailView.deletedAt),
      ),
    )
    .orderBy(desc(adminEmailView.isSystem), asc(adminEmailView.name));

  return rows as ViewListItem[];
}

export async function getViewById(id: string): Promise<AdminEmailViewRow | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(adminEmailView)
    .where(and(eq(adminEmailView.id, id), isNull(adminEmailView.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createView(
  ownerEmail: string,
  input: CreateViewDto,
): Promise<AdminEmailViewRow> {
  const drizzle = requireDb();
  const [row] = await drizzle
    .insert(adminEmailView)
    .values({
      ownerEmail,
      name: input.name,
      scope: input.scope,
      filterState: input.filterState,
      isSystem: false,
    })
    .returning();
  if (!row) throw new Error('Insert failed');
  return row;
}

export async function updateView(
  id: string,
  ownerEmail: string,
  input: UpdateViewDto,
): Promise<AdminEmailViewRow | null> {
  const drizzle = requireDb();
  const existing = await getViewById(id);
  if (!existing) return null;
  // Refuser de modifier les vues système ou celles d'un autre admin.
  if (existing.isSystem) throw new Error('Cannot edit system view');
  if (existing.ownerEmail !== ownerEmail) throw new Error('Cannot edit another admin view');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.filterState !== undefined) patch.filterState = input.filterState;

  const [row] = await drizzle
    .update(adminEmailView)
    .set(patch)
    .where(eq(adminEmailView.id, id))
    .returning();
  return row ?? null;
}

export async function deleteView(id: string, ownerEmail: string): Promise<boolean> {
  const drizzle = requireDb();
  const existing = await getViewById(id);
  if (!existing) return false;
  if (existing.isSystem) throw new Error('Cannot delete system view');
  if (existing.ownerEmail !== ownerEmail) throw new Error('Cannot delete another admin view');

  await drizzle
    .update(adminEmailView)
    .set({ deletedAt: new Date() })
    .where(eq(adminEmailView.id, id));
  return true;
}
