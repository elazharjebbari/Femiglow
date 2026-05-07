/**
 * Queries — `component_field_bindings` + `component_field_history`.
 *
 * Bicéphale : Drizzle/Postgres si DATABASE_URL, sinon `memoryStore` pour
 * dev/tests. Voir `docs/components-cms/architecture/02-data-model.md`
 * pour le contrat (invariants I1–I7).
 */
import 'server-only';
import { and, asc, desc, eq, lt, lte } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  ComponentFieldBinding,
  ComponentFieldHistoryEntry,
  FieldBindingStatus,
  FieldHistoryAction,
} from '@/lib/db/types';

export interface UpsertDraftInput {
  componentId: string;
  fieldKey: string;
  locale?: string;
  value: unknown;
  authorId: string | null;
  notes?: string | null;
  /** updatedAt attendu (If-Match). Sert au verrouillage optimiste — 409 si désynchronisé. */
  expectedUpdatedAt?: Date | null;
}

export interface PublishInput {
  bindingId: string;
  actorId: string | null;
  expectedUpdatedAt?: Date | null;
}

export interface ScheduleInput {
  bindingId: string;
  scheduledAt: Date;
  actorId: string | null;
  expectedUpdatedAt?: Date | null;
}

export interface RestoreInput {
  componentId: string;
  fieldKey: string;
  locale: string;
  historyId: string;
  actorId: string | null;
}

export class ConflictError extends Error {
  code = 'cfb_conflict';
  constructor(public binding: ComponentFieldBinding) {
    super('Component field binding has been updated by someone else');
  }
}

export class NotFoundError extends Error {
  code = 'cfb_not_found';
  constructor(message: string) {
    super(message);
  }
}

function rowToBinding(row: unknown): ComponentFieldBinding {
  return row as ComponentFieldBinding;
}

function rowToHistory(row: unknown): ComponentFieldHistoryEntry {
  return row as ComponentFieldHistoryEntry;
}

function nextVersionFromList(list: ComponentFieldBinding[]): number {
  if (list.length === 0) return 1;
  return Math.max(...list.map((b) => b.version)) + 1;
}

async function listAllForTriplet(
  componentId: string,
  fieldKey: string,
  locale: string,
): Promise<ComponentFieldBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldBindings)
      .where(
        and(
          eq(schema.componentFieldBindings.componentId, componentId),
          eq(schema.componentFieldBindings.fieldKey, fieldKey),
          eq(schema.componentFieldBindings.locale, locale),
        ),
      );
    return rows.map(rowToBinding);
  }
  return Array.from(memoryStore().componentFieldBindings.values()).filter(
    (b) =>
      b.componentId === componentId && b.fieldKey === fieldKey && b.locale === locale,
  );
}

export async function getBindingByStatus(
  componentId: string,
  fieldKey: string,
  locale: string,
  status: FieldBindingStatus,
): Promise<ComponentFieldBinding | null> {
  const list = await listAllForTriplet(componentId, fieldKey, locale);
  return list.find((b) => b.status === status) ?? null;
}

export async function getPublishedBinding(
  componentId: string,
  fieldKey: string,
  locale: string,
): Promise<ComponentFieldBinding | null> {
  return getBindingByStatus(componentId, fieldKey, locale, 'published');
}

export async function getDraftBinding(
  componentId: string,
  fieldKey: string,
  locale: string,
): Promise<ComponentFieldBinding | null> {
  return getBindingByStatus(componentId, fieldKey, locale, 'draft');
}

export async function listPublishedBindings(
  componentId: string,
  locale = 'fr',
): Promise<ComponentFieldBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldBindings)
      .where(
        and(
          eq(schema.componentFieldBindings.componentId, componentId),
          eq(schema.componentFieldBindings.locale, locale),
          eq(schema.componentFieldBindings.status, 'published'),
        ),
      );
    return rows.map(rowToBinding);
  }
  return Array.from(memoryStore().componentFieldBindings.values()).filter(
    (b) =>
      b.componentId === componentId && b.locale === locale && b.status === 'published',
  );
}

export async function listBindingsByComponent(
  componentId: string,
  locale = 'fr',
): Promise<ComponentFieldBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldBindings)
      .where(
        and(
          eq(schema.componentFieldBindings.componentId, componentId),
          eq(schema.componentFieldBindings.locale, locale),
        ),
      );
    return rows.map(rowToBinding);
  }
  return Array.from(memoryStore().componentFieldBindings.values()).filter(
    (b) => b.componentId === componentId && b.locale === locale,
  );
}

export async function getBindingById(id: string): Promise<ComponentFieldBinding | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldBindings)
      .where(eq(schema.componentFieldBindings.id, id))
      .limit(1);
    return rows[0] ? rowToBinding(rows[0]) : null;
  }
  return memoryStore().componentFieldBindings.get(id) ?? null;
}

export async function getHistoryById(
  id: string,
): Promise<ComponentFieldHistoryEntry | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldHistory)
      .where(eq(schema.componentFieldHistory.id, id))
      .limit(1);
    return rows[0] ? rowToHistory(rows[0]) : null;
  }
  return memoryStore().componentFieldHistory.get(id) ?? null;
}

async function insertBinding(b: ComponentFieldBinding): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.componentFieldBindings).values(b);
    return;
  }
  memoryStore().componentFieldBindings.set(b.id, b);
}

async function updateBinding(b: ComponentFieldBinding): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.componentFieldBindings)
      .set({
        value: b.value,
        status: b.status,
        version: b.version,
        publishedAt: b.publishedAt,
        scheduledAt: b.scheduledAt,
        notes: b.notes,
        authorId: b.authorId,
        updatedAt: b.updatedAt,
      })
      .where(eq(schema.componentFieldBindings.id, b.id));
    return;
  }
  memoryStore().componentFieldBindings.set(b.id, b);
}

async function appendHistory(
  binding: ComponentFieldBinding,
  action: FieldHistoryAction,
  actorId: string | null,
  notes?: string | null,
): Promise<void> {
  const entry: ComponentFieldHistoryEntry = {
    id: createId('cfh'),
    bindingId: binding.id,
    componentId: binding.componentId,
    fieldKey: binding.fieldKey,
    locale: binding.locale,
    version: binding.version,
    value: binding.value,
    status: binding.status,
    actorId,
    action,
    notes: notes ?? null,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.componentFieldHistory).values(entry);
    return;
  }
  memoryStore().componentFieldHistory.set(entry.id, entry);
}

/**
 * Crée ou met à jour la ligne `draft` du triplet. Si une ligne `draft`
 * existe déjà, la valeur est remplacée. Sinon, on insère.
 *
 * Si `expectedUpdatedAt` est fourni et que la ligne existante a un
 * `updatedAt` différent, on lance `ConflictError` (optimistic concurrency).
 *
 * Retourne le binding draft courant.
 */
export async function upsertDraftBinding(
  input: UpsertDraftInput,
): Promise<ComponentFieldBinding> {
  const locale = input.locale ?? 'fr';
  const list = await listAllForTriplet(input.componentId, input.fieldKey, locale);
  const existingDraft = list.find((b) => b.status === 'draft');
  const now = new Date();

  if (existingDraft) {
    if (
      input.expectedUpdatedAt &&
      existingDraft.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
    ) {
      throw new ConflictError(existingDraft);
    }
    const updated: ComponentFieldBinding = {
      ...existingDraft,
      value: input.value,
      authorId: input.authorId ?? existingDraft.authorId,
      notes: input.notes ?? existingDraft.notes,
      updatedAt: now,
    };
    await updateBinding(updated);
    await appendHistory(updated, 'update', input.authorId);
    return updated;
  }

  // Pas de draft : créer
  const targetVersion = nextVersionFromList(list);
  const created: ComponentFieldBinding = {
    id: createId('cfb'),
    componentId: input.componentId,
    fieldKey: input.fieldKey,
    locale,
    value: input.value,
    status: 'draft',
    version: targetVersion,
    publishedAt: null,
    scheduledAt: null,
    notes: input.notes ?? null,
    authorId: input.authorId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await insertBinding(created);
  await appendHistory(created, 'create', input.authorId);
  return created;
}

/**
 * Insère un binding `published` initial directement (utilisé par le seed).
 * Idempotent : si un `published` existe déjà pour le triplet, retourne-le
 * sans modification.
 */
export async function ensureSeedPublishedBinding(input: {
  componentId: string;
  fieldKey: string;
  locale?: string;
  value: unknown;
  authorId?: string | null;
}): Promise<ComponentFieldBinding> {
  const locale = input.locale ?? 'fr';
  const existing = await getPublishedBinding(input.componentId, input.fieldKey, locale);
  if (existing) return existing;

  const list = await listAllForTriplet(input.componentId, input.fieldKey, locale);
  const targetVersion = nextVersionFromList(list);
  const now = new Date();
  const created: ComponentFieldBinding = {
    id: createId('cfb'),
    componentId: input.componentId,
    fieldKey: input.fieldKey,
    locale,
    value: input.value,
    status: 'published',
    version: targetVersion,
    publishedAt: now,
    scheduledAt: null,
    notes: null,
    authorId: input.authorId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await insertBinding(created);
  await appendHistory(created, 'publish', input.authorId ?? null, 'seed');
  return created;
}

/**
 * Promote a `draft` binding to `published` (or a `scheduled` to `published`),
 * archiving the previous `published` if any. Non-transactional fallback for
 * memory store; in Postgres, wrapped in a transaction by the caller (route).
 */
export async function publishBinding(
  input: PublishInput,
): Promise<ComponentFieldBinding> {
  const binding = await getBindingById(input.bindingId);
  if (!binding) throw new NotFoundError(`Binding ${input.bindingId} not found`);
  if (binding.status !== 'draft' && binding.status !== 'scheduled') {
    throw new Error(
      `Cannot publish binding in status '${binding.status}' (must be draft or scheduled)`,
    );
  }
  if (
    input.expectedUpdatedAt &&
    binding.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    throw new ConflictError(binding);
  }

  // Archiver l'ancien published
  const list = await listAllForTriplet(binding.componentId, binding.fieldKey, binding.locale);
  const previousPublished = list.find((b) => b.status === 'published');
  if (previousPublished) {
    const archived: ComponentFieldBinding = {
      ...previousPublished,
      status: 'archived',
      updatedAt: new Date(),
    };
    await updateBinding(archived);
    await appendHistory(archived, 'archive', input.actorId);
  }

  const now = new Date();
  const targetVersion = previousPublished
    ? nextVersionFromList(list.filter((b) => b.id !== binding.id))
    : binding.version;
  const promoted: ComponentFieldBinding = {
    ...binding,
    status: 'published',
    version: targetVersion,
    publishedAt: now,
    scheduledAt: null,
    updatedAt: now,
    authorId: input.actorId ?? binding.authorId,
  };
  await updateBinding(promoted);
  await appendHistory(promoted, 'publish', input.actorId);
  return promoted;
}

/** Programme un draft pour publication ultérieure. */
export async function scheduleBinding(
  input: ScheduleInput,
): Promise<ComponentFieldBinding> {
  const binding = await getBindingById(input.bindingId);
  if (!binding) throw new NotFoundError(`Binding ${input.bindingId} not found`);
  if (binding.status !== 'draft' && binding.status !== 'scheduled') {
    throw new Error(`Cannot schedule binding in status '${binding.status}'`);
  }
  if (input.scheduledAt.getTime() <= Date.now() + 60_000) {
    throw new Error('schedule.in_past');
  }
  if (
    input.expectedUpdatedAt &&
    binding.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    throw new ConflictError(binding);
  }
  const now = new Date();
  const updated: ComponentFieldBinding = {
    ...binding,
    status: 'scheduled',
    scheduledAt: input.scheduledAt,
    updatedAt: now,
    authorId: input.actorId ?? binding.authorId,
  };
  await updateBinding(updated);
  await appendHistory(updated, 'schedule', input.actorId);
  return updated;
}

export async function cancelSchedule(
  bindingId: string,
  actorId: string | null,
): Promise<ComponentFieldBinding> {
  const binding = await getBindingById(bindingId);
  if (!binding) throw new NotFoundError(`Binding ${bindingId} not found`);
  if (binding.status !== 'scheduled') {
    throw new Error(`Binding is not scheduled (status='${binding.status}')`);
  }
  const now = new Date();
  const updated: ComponentFieldBinding = {
    ...binding,
    status: 'draft',
    scheduledAt: null,
    updatedAt: now,
  };
  await updateBinding(updated);
  await appendHistory(updated, 'unschedule', actorId);
  return updated;
}

/**
 * Liste tous les bindings actuellement programmés (cross-composant).
 *
 * Utilisé par le dashboard admin pour afficher les publications à venir.
 * Trié par `scheduledAt` ascendant. Limite par défaut 200 (le dashboard
 * paginera si on dépasse).
 */
export async function listAllScheduled(limit = 200): Promise<ComponentFieldBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldBindings)
      .where(eq(schema.componentFieldBindings.status, 'scheduled'))
      .orderBy(asc(schema.componentFieldBindings.scheduledAt))
      .limit(limit);
    return rows.map(rowToBinding);
  }
  return Array.from(memoryStore().componentFieldBindings.values())
    .filter((b) => b.status === 'scheduled')
    .sort((a, b) => {
      const ta = a.scheduledAt?.getTime() ?? 0;
      const tb = b.scheduledAt?.getTime() ?? 0;
      return ta - tb;
    })
    .slice(0, limit);
}

export async function listScheduledDue(now: Date): Promise<ComponentFieldBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldBindings)
      .where(
        and(
          eq(schema.componentFieldBindings.status, 'scheduled'),
          lte(schema.componentFieldBindings.scheduledAt, now),
        ),
      )
      .orderBy(asc(schema.componentFieldBindings.scheduledAt))
      .limit(100);
    return rows.map(rowToBinding);
  }
  return Array.from(memoryStore().componentFieldBindings.values())
    .filter((b) => b.status === 'scheduled' && b.scheduledAt && b.scheduledAt <= now)
    .sort((a, b) => (a.scheduledAt!.getTime() - b.scheduledAt!.getTime()));
}

/**
 * Crée un nouveau `draft` à partir d'un snapshot d'history. Si un draft
 * existe déjà pour le triplet, sa valeur est écrasée.
 */
export async function restoreFromHistory(
  input: RestoreInput,
): Promise<ComponentFieldBinding> {
  const drizzle = db();
  let snapshot: ComponentFieldHistoryEntry | null = null;
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldHistory)
      .where(eq(schema.componentFieldHistory.id, input.historyId))
      .limit(1);
    snapshot = rows[0] ? rowToHistory(rows[0]) : null;
  } else {
    snapshot = memoryStore().componentFieldHistory.get(input.historyId) ?? null;
  }
  if (!snapshot) throw new NotFoundError(`History ${input.historyId} not found`);
  if (
    snapshot.componentId !== input.componentId ||
    snapshot.fieldKey !== input.fieldKey ||
    snapshot.locale !== input.locale
  ) {
    throw new Error('history.mismatch');
  }
  return upsertDraftBinding({
    componentId: input.componentId,
    fieldKey: input.fieldKey,
    locale: input.locale,
    value: snapshot.value,
    authorId: input.actorId,
    notes: `restore from version ${snapshot.version}`,
  });
}

export async function listHistory(
  componentId: string,
  fieldKey: string,
  locale = 'fr',
  limit = 20,
): Promise<ComponentFieldHistoryEntry[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldHistory)
      .where(
        and(
          eq(schema.componentFieldHistory.componentId, componentId),
          eq(schema.componentFieldHistory.fieldKey, fieldKey),
          eq(schema.componentFieldHistory.locale, locale),
        ),
      )
      .orderBy(desc(schema.componentFieldHistory.createdAt))
      .limit(limit);
    return rows.map(rowToHistory);
  }
  return Array.from(memoryStore().componentFieldHistory.values())
    .filter(
      (h) =>
        h.componentId === componentId && h.fieldKey === fieldKey && h.locale === locale,
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Purge les entrées d'historique antérieures à `cutoff`. Utilisé par le
 * cron `/api/cron/purge-field-history`.
 *
 * Idempotent : on supprime simplement les rows < cutoff. La rétention
 * effective dépend du `RETENTION_DAYS` côté cron.
 *
 * NB : on garde toujours **au moins** la dernière entrée par binding
 * (utile pour les diagnostics) — implémenté via `min(createdAt) per binding`
 * exclu de la purge.
 */
export async function purgeFieldHistoryBefore(cutoff: Date): Promise<number> {
  const drizzle = db();
  if (drizzle) {
    // Stratégie : on récupère, pour chaque binding, l'entrée la plus
    // récente, et on supprime tout ce qui est < cutoff sauf elle.
    const allRows = await drizzle
      .select()
      .from(schema.componentFieldHistory)
      .where(lt(schema.componentFieldHistory.createdAt, cutoff));
    const candidates = allRows.map(rowToHistory);
    if (candidates.length === 0) return 0;

    const newestPerBinding = new Map<string, ComponentFieldHistoryEntry>();
    for (const c of candidates) {
      const cur = newestPerBinding.get(c.bindingId);
      if (!cur || c.createdAt > cur.createdAt) newestPerBinding.set(c.bindingId, c);
    }
    const keepIds = new Set(
      Array.from(newestPerBinding.values()).map((c) => c.id),
    );
    let purged = 0;
    for (const c of candidates) {
      if (keepIds.has(c.id)) continue;
      await drizzle
        .delete(schema.componentFieldHistory)
        .where(eq(schema.componentFieldHistory.id, c.id));
      purged++;
    }
    return purged;
  }

  // Memory store
  const all = Array.from(memoryStore().componentFieldHistory.values()).filter(
    (h) => h.createdAt < cutoff,
  );
  if (all.length === 0) return 0;
  const newestPerBinding = new Map<string, ComponentFieldHistoryEntry>();
  for (const c of all) {
    const cur = newestPerBinding.get(c.bindingId);
    if (!cur || c.createdAt > cur.createdAt) newestPerBinding.set(c.bindingId, c);
  }
  const keepIds = new Set(
    Array.from(newestPerBinding.values()).map((c) => c.id),
  );
  let purged = 0;
  for (const c of all) {
    if (keepIds.has(c.id)) continue;
    memoryStore().componentFieldHistory.delete(c.id);
    purged++;
  }
  return purged;
}

/**
 * Marque comme `archived` tous les bindings d'un composant qui pointent
 * vers un fieldKey absent du registre. Utilisé par seed-pipeline.
 */
export async function archiveOrphanBindings(
  componentId: string,
  validFieldKeys: string[],
): Promise<number> {
  const validSet = new Set(validFieldKeys);
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentFieldBindings)
      .where(eq(schema.componentFieldBindings.componentId, componentId));
    const bindings = rows.map(rowToBinding);
    let count = 0;
    for (const b of bindings) {
      if (!validSet.has(b.fieldKey) && b.status !== 'archived') {
        const archived: ComponentFieldBinding = {
          ...b,
          status: 'archived',
          updatedAt: new Date(),
        };
        await updateBinding(archived);
        await appendHistory(archived, 'archive', null, 'orphan: field removed from registry');
        count++;
      }
    }
    return count;
  }

  let count = 0;
  for (const b of memoryStore().componentFieldBindings.values()) {
    if (b.componentId !== componentId) continue;
    if (validSet.has(b.fieldKey)) continue;
    if (b.status === 'archived') continue;
    const archived: ComponentFieldBinding = {
      ...b,
      status: 'archived',
      updatedAt: new Date(),
    };
    memoryStore().componentFieldBindings.set(b.id, archived);
    await appendHistory(archived, 'archive', null, 'orphan: field removed from registry');
    count++;
  }
  return count;
}
