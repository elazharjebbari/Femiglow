/**
 * Queries — `component_media_sets` + `component_media_set_items` +
 * `component_media_set_history` (médias par audience).
 *
 * Bicéphale : Drizzle/Postgres si DATABASE_URL, sinon `memoryStore` pour
 * dev/tests. Modèle : `component-fields.ts` (cycle draft / published /
 * scheduled / archived, verrouillage optimiste, historique).
 *
 * Invariants :
 *  - I1 au plus UN ensemble `published`, UN `draft` et UN `scheduled` par
 *    tuple (composant, slot, dimension, clé, langue) — index uniques partiels ;
 *  - I2 on publie un ensemble ENTIER (items remplacés en bloc, jamais mélangés) ;
 *  - I3 chaque mutation écrit une ligne d'historique avec l'instantané des items ;
 *  - I4 les mutations multi-lignes sont atomiques (transaction Postgres,
 *    instantané + rollback en mémoire). Sans transaction interactive
 *    (neon-http), les mutations ÉCHOUENT (`MediaSetTransactionUnavailableError`)
 *    au lieu d'écrire en séquence ;
 *  - I5 un média référencé ne peut pas être supprimé définitivement
 *    (FK `ON DELETE RESTRICT`, équivalent mémoire dans `hardDeleteMedia`).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.1
 */
import { and, asc, desc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { getSiteComponentById } from '@/lib/db/queries/site-components';
import { NotFoundError } from '@/lib/db/queries/component-fields';
import { mediaDisplayUrl } from '@/lib/components/media-variants/dto';
import {
  readMediaVariantPolicy,
  validateMediaSetShape,
  type MediaSetIssue,
} from '@/lib/components/media-variants/policy';
import type {
  ComponentMediaSet,
  ComponentMediaSetHistoryEntry,
  ComponentMediaSetItem,
  ComponentMediaSetItemSnapshot,
  ComponentMediaSetItemWithMedia,
  ComponentMediaSetWithItems,
  ComponentMediaSetWithMedia,
  FieldBindingStatus,
  FieldHistoryAction,
  Media,
  MediaObjectPosition,
  MediaSetItemAlt,
  MediaSetMedia,
  MediaSetSource,
  MediaStatus,
  MediaVariant,
} from '@/lib/db/types';

export { NotFoundError } from '@/lib/db/queries/component-fields';

/* ──────────────────────────────────────────────────────────────────
 * Types d'entrée
 * ────────────────────────────────────────────────────────────────── */

/** Tuple d'unicité d'un ensemble. */
export interface MediaSetTuple {
  componentId: string;
  slot: string;
  /** Défaut `default`. */
  variantDim?: string;
  /** Défaut `*`. */
  variantKey?: string;
  /** Défaut `*`. */
  locale?: string;
}

export interface MediaSetItemInput {
  mediaId: string;
  mobileMediaId?: string | null;
  alt?: MediaSetItemAlt | null;
  objectPosition?: MediaObjectPosition | null;
  focalX?: number | null;
  focalY?: number | null;
}

export interface UpsertDraftSetInput extends MediaSetTuple {
  /** Liste complète et ordonnée (position = index). Remplace l'existant. */
  items: MediaSetItemInput[];
  crossLocale?: boolean;
  source?: MediaSetSource;
  notes?: string | null;
  authorId: string | null;
  /** updatedAt attendu (If-Match) — `MediaSetConflictError` si désynchronisé. */
  expectedUpdatedAt?: Date | null;
  /** version attendue — alternative à `expectedUpdatedAt`. */
  expectedVersion?: number | null;
}

export interface MediaSetMutationInput {
  setId: string;
  actorId: string | null;
  expectedUpdatedAt?: Date | null;
  /** Horloge injectable (tests, cron). Défaut : `new Date()`. */
  now?: Date;
}

export interface ScheduleSetInput extends MediaSetMutationInput {
  scheduledAt: Date;
}

export interface RestoreSetInput {
  historyId: string;
  actorId: string | null;
  expectedUpdatedAt?: Date | null;
}

/* ──────────────────────────────────────────────────────────────────
 * Erreurs
 * ────────────────────────────────────────────────────────────────── */

/** Où retrouver l'état courant après une violation d'index unique (23505). */
interface ConflictLookup {
  tuple: Required<MediaSetTuple>;
  status: FieldBindingStatus;
}

/**
 * Verrouillage optimiste : l'ensemble a changé depuis la lecture (→ 409).
 * `set` porte l'état courant quand il est connu (y compris après un 23505 :
 * relu hors transaction, cf. `atomically`).
 */
export class MediaSetConflictError extends Error {
  code = 'cms_set_conflict';
  constructor(
    public set: ComponentMediaSet | null,
    /** @internal indice de relecture (violation d'index unique). */
    public readonly lookup?: ConflictLookup,
  ) {
    super('Component media set has been updated by someone else');
  }
}

/**
 * Le driver ne sait pas faire de transaction interactive (neon-http) : les
 * mutations multi-lignes refusent de s'exécuter plutôt que d'écrire en
 * séquence sans atomicité (→ 503). Prod = postgres-js, non concerné.
 */
export class MediaSetTransactionUnavailableError extends Error {
  code = 'cms_set_tx_unavailable';
  constructor(public override cause?: unknown) {
    super(
      'Component media set mutations require interactive transactions (postgres-js, PGlite); ' +
        'the current database driver (neon-http) does not support them',
    );
  }
}

/** Entrée invalide (slot, dimension, nombre d'items, média absent…) (→ 422). */
export class MediaSetValidationError extends Error {
  code = 'cms_set_invalid';
  constructor(public issues: MediaSetIssue[]) {
    super(`Invalid component media set: ${issues.map((i) => i.code).join(', ')}`);
  }
}

/** Transition de statut interdite (publier un archivé, etc.) (→ 409). */
export class MediaSetStateError extends Error {
  code = 'cms_set_state';
  constructor(public reason: string) {
    super(reason);
  }
}

/* ──────────────────────────────────────────────────────────────────
 * Constantes & helpers purs
 * ────────────────────────────────────────────────────────────────── */

/** Statuts média exploitables à l'affichage (cf. `lib/media/preload.ts`). */
export const MEDIA_USABLE_STATUSES: readonly MediaStatus[] = ['ready', 'passthrough'];

/** Délai minimal d'une programmation (aligné sur `scheduleBinding`). */
const SCHEDULE_MIN_DELAY_MS = 60_000;

/**
 * Note d'historique d'un brouillon abandonné (`discardDraft`). L'enum
 * `field_history_action` n'a pas de valeur `discard` : on écrit `archive`
 * (statut `draft`) avec cette note.
 */
export const MEDIA_SET_DISCARD_NOTE = 'discard_draft';

/** Note d'historique d'une programmation annulée par une publication manuelle. */
export const MEDIA_SET_SUPERSEDED_NOTE = 'superseded_by_publish';

/** Statuts soumis à un index unique partiel par tuple (I1). */
const UNIQUE_PER_TUPLE: readonly FieldBindingStatus[] = ['draft', 'published', 'scheduled'];

/**
 * Horloge monotone d'une mutation : chaque appel renvoie un instant
 * strictement postérieur au précédent (et au moins égal à `floor`), pour
 * que les lignes d'historique d'une même mutation (archive → publish) aient
 * des `createdAt` distincts et postérieurs à l'historique des ensembles
 * qu'elle archive.
 */
function monotonicClock(start: Date): (floor?: Date) => Date {
  let next = start.getTime();
  return (floor) => {
    const t = Math.max(next, floor ? floor.getTime() : next);
    next = t + 1;
    return new Date(t);
  };
}

function normalizeTuple(t: MediaSetTuple): Required<MediaSetTuple> {
  return {
    componentId: t.componentId,
    slot: t.slot,
    variantDim: t.variantDim ?? 'default',
    variantKey: t.variantKey ?? '*',
    locale: t.locale ?? '*',
  };
}

function sameTuple(a: Required<MediaSetTuple>, b: ComponentMediaSet): boolean {
  return (
    a.componentId === b.componentId &&
    a.slot === b.slot &&
    a.variantDim === b.variantDim &&
    a.variantKey === b.variantKey &&
    a.locale === b.locale
  );
}

function tupleOf(set: ComponentMediaSet): Required<MediaSetTuple> {
  return {
    componentId: set.componentId,
    slot: set.slot,
    variantDim: set.variantDim,
    variantKey: set.variantKey,
    locale: set.locale,
  };
}

function nextVersion(list: ComponentMediaSet[]): number {
  if (list.length === 0) return 1;
  return Math.max(...list.map((s) => s.version)) + 1;
}

/**
 * Horodatage strictement postérieur à `previous` : deux écritures dans la
 * même milliseconde produiraient sinon le même `updatedAt` et
 * neutraliseraient le verrouillage optimiste.
 */
function tick(now: Date, previous?: Date | null): Date {
  if (previous && now.getTime() <= previous.getTime()) {
    return new Date(previous.getTime() + 1);
  }
  return now;
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

function toSnapshot(items: ComponentMediaSetItem[]): ComponentMediaSetItemSnapshot[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      position: i.position,
      mediaId: i.mediaId,
      mobileMediaId: i.mobileMediaId,
      alt: i.alt,
      objectPosition: i.objectPosition,
      focalX: i.focalX,
      focalY: i.focalY,
    }));
}

function cleanAlt(alt: MediaSetItemAlt | null | undefined): MediaSetItemAlt {
  const out: MediaSetItemAlt = {};
  for (const [lang, text] of Object.entries(alt ?? {})) {
    if (typeof text === 'string' && text.trim().length > 0) {
      out[lang as keyof MediaSetItemAlt] = text.trim();
    }
  }
  return out;
}

function buildItems(
  setId: string,
  inputs: MediaSetItemInput[],
  now: Date,
): ComponentMediaSetItem[] {
  return inputs.map((input, position) => ({
    id: createId('cmsi'),
    setId,
    position,
    mediaId: input.mediaId,
    mobileMediaId: input.mobileMediaId ?? null,
    alt: cleanAlt(input.alt),
    objectPosition: input.objectPosition ?? null,
    focalX: input.focalX ?? null,
    focalY: input.focalY ?? null,
    createdAt: now,
  }));
}

function sortSets<T extends ComponentMediaSet>(list: T[]): T[] {
  const statusOrder: Record<FieldBindingStatus, number> = {
    published: 0,
    scheduled: 1,
    draft: 2,
    archived: 3,
  };
  return [...list].sort(
    (a, b) =>
      a.slot.localeCompare(b.slot) ||
      a.variantDim.localeCompare(b.variantDim) ||
      a.variantKey.localeCompare(b.variantKey) ||
      a.locale.localeCompare(b.locale) ||
      statusOrder[a.status] - statusOrder[b.status] ||
      b.version - a.version,
  );
}

/** Code SQLSTATE d'une erreur pilote (postgres-js, PGlite, ou enveloppe Drizzle). */
function sqlState(err: unknown): string | null {
  let cur: unknown = err;
  for (let depth = 0; depth < 4 && cur && typeof cur === 'object'; depth += 1) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────
 * Dépôt (memory / Drizzle) — utilisé à l'intérieur d'une « unité » atomique
 * ────────────────────────────────────────────────────────────────── */

type Exec = PgDatabase<PgQueryResultHKT, typeof schema>;

interface MediaPresence {
  id: string;
  deletedAt: Date | null;
}

interface Repo {
  listTuple(tuple: Required<MediaSetTuple>): Promise<ComponentMediaSet[]>;
  getSet(id: string): Promise<ComponentMediaSet | null>;
  listItems(setId: string): Promise<ComponentMediaSetItem[]>;
  insertSet(set: ComponentMediaSet): Promise<void>;
  /** Mise à jour conditionnelle (`updated_at` attendu). `false` = conflit. */
  updateSet(set: ComponentMediaSet, expectedUpdatedAt: Date): Promise<boolean>;
  replaceItems(setId: string, items: ComponentMediaSetItem[]): Promise<void>;
  /** Suppression conditionnelle (`updated_at` attendu), items en cascade. `false` = conflit. */
  deleteSet(id: string, expectedUpdatedAt: Date): Promise<boolean>;
  insertHistory(entry: ComponentMediaSetHistoryEntry): Promise<void>;
  findMedia(ids: string[]): Promise<MediaPresence[]>;
}

function memoryRepo(): Repo {
  const store = memoryStore();
  return {
    async listTuple(tuple) {
      return Array.from(store.componentMediaSets.values()).filter((s) => sameTuple(tuple, s));
    },
    async getSet(id) {
      return store.componentMediaSets.get(id) ?? null;
    },
    async listItems(setId) {
      return Array.from(store.componentMediaSetItems.values())
        .filter((i) => i.setId === setId)
        .sort((a, b) => a.position - b.position);
    },
    async insertSet(set) {
      // Équivalent mémoire des index uniques partiels (I1).
      if (UNIQUE_PER_TUPLE.includes(set.status)) {
        const clash = Array.from(store.componentMediaSets.values()).find(
          (s) => s.status === set.status && sameTuple(tupleOf(set), s),
        );
        if (clash) throw new MediaSetConflictError(clash);
      }
      store.componentMediaSets.set(set.id, set);
    },
    async updateSet(set, expectedUpdatedAt) {
      const current = store.componentMediaSets.get(set.id);
      if (!current || !sameInstant(current.updatedAt, expectedUpdatedAt)) return false;
      if (UNIQUE_PER_TUPLE.includes(set.status)) {
        const clash = Array.from(store.componentMediaSets.values()).find(
          (s) => s.id !== set.id && s.status === set.status && sameTuple(tupleOf(set), s),
        );
        if (clash) throw new MediaSetConflictError(clash);
      }
      store.componentMediaSets.set(set.id, set);
      return true;
    },
    async replaceItems(setId, items) {
      for (const item of Array.from(store.componentMediaSetItems.values())) {
        if (item.setId === setId) store.componentMediaSetItems.delete(item.id);
      }
      for (const item of items) store.componentMediaSetItems.set(item.id, item);
    },
    async deleteSet(id, expectedUpdatedAt) {
      const current = store.componentMediaSets.get(id);
      if (!current || !sameInstant(current.updatedAt, expectedUpdatedAt)) return false;
      // Équivalent mémoire de `ON DELETE CASCADE` sur les items.
      for (const item of Array.from(store.componentMediaSetItems.values())) {
        if (item.setId === id) store.componentMediaSetItems.delete(item.id);
      }
      store.componentMediaSets.delete(id);
      return true;
    },
    async insertHistory(entry) {
      store.componentMediaSetHistory.set(entry.id, entry);
    },
    async findMedia(ids) {
      return ids
        .map((id) => store.media.get(id))
        .filter((m): m is Media => !!m)
        .map((m) => ({ id: m.id, deletedAt: m.deletedAt }));
    },
  };
}

function drizzleRepo(exec: Exec): Repo {
  const sets = schema.componentMediaSets;
  const items = schema.componentMediaSetItems;
  return {
    async listTuple(tuple) {
      const rows = await exec
        .select()
        .from(sets)
        .where(
          and(
            eq(sets.componentId, tuple.componentId),
            eq(sets.slot, tuple.slot),
            eq(sets.variantDim, tuple.variantDim),
            eq(sets.variantKey, tuple.variantKey),
            eq(sets.locale, tuple.locale),
          ),
        );
      return rows as ComponentMediaSet[];
    },
    async getSet(id) {
      const rows = await exec.select().from(sets).where(eq(sets.id, id)).limit(1);
      return (rows[0] as ComponentMediaSet | undefined) ?? null;
    },
    async listItems(setId) {
      const rows = await exec
        .select()
        .from(items)
        .where(eq(items.setId, setId))
        .orderBy(asc(items.position));
      return rows as ComponentMediaSetItem[];
    },
    async insertSet(set) {
      try {
        await exec.insert(sets).values(set);
      } catch (err) {
        // 23505 = index unique partiel (I1) : écriture concurrente. L'état
        // courant est relu après le rollback (transaction avortée ici).
        if (sqlState(err) === '23505') {
          throw new MediaSetConflictError(null, { tuple: tupleOf(set), status: set.status });
        }
        throw err;
      }
    },
    async updateSet(set, expectedUpdatedAt) {
      try {
        const rows = await exec
          .update(sets)
          .set({
            crossLocale: set.crossLocale,
            status: set.status,
            version: set.version,
            publishedAt: set.publishedAt,
            scheduledAt: set.scheduledAt,
            source: set.source,
            notes: set.notes,
            authorId: set.authorId,
            updatedAt: set.updatedAt,
          })
          .where(and(eq(sets.id, set.id), eq(sets.updatedAt, expectedUpdatedAt)))
          .returning({ id: sets.id });
        return rows.length > 0;
      } catch (err) {
        if (sqlState(err) === '23505') {
          throw new MediaSetConflictError(null, { tuple: tupleOf(set), status: set.status });
        }
        throw err;
      }
    },
    async replaceItems(setId, list) {
      await exec.delete(items).where(eq(items.setId, setId));
      if (list.length > 0) await exec.insert(items).values(list);
    },
    async deleteSet(id, expectedUpdatedAt) {
      // Items supprimés par la FK `ON DELETE CASCADE` ; l'historique reste
      // (pas de FK sur `component_media_set_history.set_id`).
      const rows = await exec
        .delete(sets)
        .where(and(eq(sets.id, id), eq(sets.updatedAt, expectedUpdatedAt)))
        .returning({ id: sets.id });
      return rows.length > 0;
    },
    async insertHistory(entry) {
      await exec.insert(schema.componentMediaSetHistory).values(entry);
    },
    async findMedia(ids) {
      if (ids.length === 0) return [];
      const rows = await exec
        .select({ id: schema.media.id, deletedAt: schema.media.deletedAt })
        .from(schema.media)
        .where(inArray(schema.media.id, ids));
      return rows;
    },
  };
}

function isNoTransactionSupport(err: unknown): boolean {
  return err instanceof Error && /No transactions support/i.test(err.message);
}

/**
 * Exécute `fn` de façon atomique (I4).
 *  - Postgres : `transaction()` Drizzle (postgres-js, PGlite). Le driver
 *    neon-http ne sait pas faire de transaction interactive : on ÉCHOUE
 *    (`MediaSetTransactionUnavailableError`) plutôt que d'écrire en
 *    séquence — une panne au milieu d'une publication laisserait un tuple
 *    sans publié, ou un historique incomplet.
 *  - Sur une violation d'index unique (23505), l'état courant du tuple est
 *    relu APRÈS le rollback et joint à `MediaSetConflictError.set`.
 *  - Mémoire : instantané des trois Maps, restauré si `fn` lève.
 */
async function atomically<T>(fn: (repo: Repo) => Promise<T>): Promise<T> {
  const drizzle = db();
  if (drizzle) {
    const exec = drizzle as unknown as Exec;
    try {
      return await exec.transaction(async (tx) => fn(drizzleRepo(tx as unknown as Exec)));
    } catch (err) {
      if (isNoTransactionSupport(err)) throw new MediaSetTransactionUnavailableError(err);
      if (err instanceof MediaSetConflictError && !err.set && err.lookup) {
        const { tuple, status } = err.lookup;
        err.set =
          (await drizzleRepo(exec)
            .listTuple(tuple)
            .then((list) => list.find((s) => s.status === status) ?? null)
            .catch(() => null)) ?? null;
      }
      throw err;
    }
  }
  const store = memoryStore();
  const snapshot = {
    sets: new Map(store.componentMediaSets),
    items: new Map(store.componentMediaSetItems),
    history: new Map(store.componentMediaSetHistory),
  };
  try {
    return await fn(memoryRepo());
  } catch (err) {
    store.componentMediaSets = snapshot.sets;
    store.componentMediaSetItems = snapshot.items;
    store.componentMediaSetHistory = snapshot.history;
    throw err;
  }
}

async function appendHistory(
  repo: Repo,
  set: ComponentMediaSet,
  items: ComponentMediaSetItem[],
  action: FieldHistoryAction,
  actorId: string | null,
  notes?: string | null,
  now: Date = new Date(),
): Promise<void> {
  await repo.insertHistory({
    id: createId('cmsh'),
    setId: set.id,
    componentId: set.componentId,
    slot: set.slot,
    variantDim: set.variantDim,
    variantKey: set.variantKey,
    locale: set.locale,
    version: set.version,
    items: toSnapshot(items),
    crossLocale: set.crossLocale,
    status: set.status,
    action,
    actorId,
    notes: notes ?? null,
    createdAt: now,
  });
}

/** Vérifie que tous les médias référencés existent et ne sont pas supprimés. */
async function assertMediaAvailable(
  repo: Repo,
  list: Array<{ mediaId: string; mobileMediaId?: string | null }>,
): Promise<void> {
  const ids = Array.from(
    new Set(list.flatMap((i) => [i.mediaId, i.mobileMediaId ?? null]).filter((id): id is string => !!id)),
  );
  const found = new Map((await repo.findMedia(ids)).map((m) => [m.id, m]));
  const issues: MediaSetIssue[] = [];
  list.forEach((item, i) => {
    for (const [field, id] of [
      ['mediaId', item.mediaId],
      ['mobileMediaId', item.mobileMediaId ?? null],
    ] as const) {
      if (!id) continue;
      const m = found.get(id);
      if (!m) {
        issues.push({ code: 'item.media_not_found', path: ['items', i, field], message: `Média introuvable : ${id}` });
      } else if (m.deletedAt) {
        issues.push({ code: 'item.media_deleted', path: ['items', i, field], message: `Média supprimé : ${id}` });
      }
    }
  });
  if (issues.length > 0) throw new MediaSetValidationError(issues);
}

/** Valide la forme de l'ensemble contre la politique du composant (registre). */
async function assertShape(
  tuple: Required<MediaSetTuple>,
  items: MediaSetItemInput[],
): Promise<void> {
  const component = await getSiteComponentById(tuple.componentId);
  if (!component) throw new NotFoundError(`Component ${tuple.componentId} not found`);
  const policy = readMediaVariantPolicy(component.metadata);
  if (!policy) {
    throw new MediaSetValidationError([
      { code: 'policy.missing', path: [], message: "Ce composant n'a pas de politique « médias par audience »" },
    ]);
  }
  const issues = validateMediaSetShape(policy, { ...tuple, items });
  if (issues.length > 0) throw new MediaSetValidationError(issues);
}

/* ──────────────────────────────────────────────────────────────────
 * Lecture
 * ────────────────────────────────────────────────────────────────── */

export async function getSetById(id: string): Promise<ComponentMediaSet | null> {
  const drizzle = db();
  if (drizzle) return drizzleRepo(drizzle as unknown as Exec).getSet(id);
  return memoryRepo().getSet(id);
}

export async function getSetWithItems(id: string): Promise<ComponentMediaSetWithItems | null> {
  const drizzle = db();
  const repo = drizzle ? drizzleRepo(drizzle as unknown as Exec) : memoryRepo();
  const set = await repo.getSet(id);
  if (!set) return null;
  return { ...set, items: await repo.listItems(id) };
}

export interface ListSetsByComponentOptions {
  /** Inclure les archivés (ignoré si `statuses` est fourni). Défaut : non. */
  includeArchived?: boolean;
  /** Statuts à renvoyer — filtrés EN BASE. Prioritaire sur `includeArchived`. */
  statuses?: readonly FieldBindingStatus[];
  /**
   * Pagination (admin : historique des archivés). Sans `limit`, tout est
   * renvoyé — à réserver aux statuts vivants (≤ 3 ensembles par tuple).
   */
  limit?: number;
  offset?: number;
  /** Filtres de tuple (en base, avant pagination). */
  slot?: string;
  variantDim?: string;
  variantKey?: string;
  locale?: string;
}

/** Statuts « vivants » (I1 : au plus un de chaque par tuple). */
const LIVE_STATUSES: readonly FieldBindingStatus[] = ['draft', 'published', 'scheduled'];

/**
 * Ensembles d'un composant avec leurs items (admin : matrice). Archivés
 * exclus par défaut, filtre de statut appliqué en base. Avec `limit`,
 * l'ordre est celui du tuple puis de la version décroissante (stable d'une
 * page à l'autre).
 */
export async function listSetsByComponent(
  componentId: string,
  opts: ListSetsByComponentOptions = {},
): Promise<ComponentMediaSetWithItems[]> {
  const statuses: readonly FieldBindingStatus[] =
    opts.statuses ?? (opts.includeArchived ? [...LIVE_STATUSES, 'archived'] : LIVE_STATUSES);
  if (statuses.length === 0) return [];
  const offset = Math.max(0, opts.offset ?? 0);
  const drizzle = db();
  let sets: ComponentMediaSet[];
  let items: ComponentMediaSetItem[];
  if (drizzle) {
    const t = schema.componentMediaSets;
    const base = drizzle
      .select()
      .from(t)
      .where(
        and(
          eq(t.componentId, componentId),
          inArray(t.status, [...statuses]),
          opts.slot !== undefined ? eq(t.slot, opts.slot) : undefined,
          opts.variantDim !== undefined ? eq(t.variantDim, opts.variantDim) : undefined,
          opts.variantKey !== undefined ? eq(t.variantKey, opts.variantKey) : undefined,
          opts.locale !== undefined ? eq(t.locale, opts.locale) : undefined,
        ),
      )
      .orderBy(asc(t.slot), asc(t.variantDim), asc(t.variantKey), asc(t.locale), desc(t.version), asc(t.id));
    const rows = opts.limit !== undefined ? await base.limit(opts.limit).offset(offset) : await base;
    sets = rows as ComponentMediaSet[];
    const ids = sets.map((s) => s.id);
    items =
      ids.length === 0
        ? []
        : ((await drizzle
            .select()
            .from(schema.componentMediaSetItems)
            .where(inArray(schema.componentMediaSetItems.setId, ids))
            .orderBy(asc(schema.componentMediaSetItems.position))) as ComponentMediaSetItem[]);
  } else {
    const store = memoryStore();
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const all = Array.from(store.componentMediaSets.values())
      .filter(
        (s) =>
          s.componentId === componentId &&
          statuses.includes(s.status) &&
          (opts.slot === undefined || s.slot === opts.slot) &&
          (opts.variantDim === undefined || s.variantDim === opts.variantDim) &&
          (opts.variantKey === undefined || s.variantKey === opts.variantKey) &&
          (opts.locale === undefined || s.locale === opts.locale),
      )
      .sort(
        (a, b) =>
          cmp(a.slot, b.slot) ||
          cmp(a.variantDim, b.variantDim) ||
          cmp(a.variantKey, b.variantKey) ||
          cmp(a.locale, b.locale) ||
          b.version - a.version ||
          cmp(a.id, b.id),
      );
    sets = opts.limit !== undefined ? all.slice(offset, offset + opts.limit) : all;
    const ids = new Set(sets.map((s) => s.id));
    items = Array.from(store.componentMediaSetItems.values()).filter((i) => ids.has(i.setId));
  }
  return sortSets(sets).map((s) => ({
    ...s,
    items: items.filter((i) => i.setId === s.id).sort((a, b) => a.position - b.position),
  }));
}

/**
 * L'ensemble d'un tuple au statut donné (`draft`, `published`, `scheduled`
 * — au plus un, I1), sans items. Lecture ciblée (PUT /draft : 201 vs 200).
 */
export async function findSetByTuple(
  tuple: MediaSetTuple,
  status: FieldBindingStatus,
): Promise<ComponentMediaSet | null> {
  const t = normalizeTuple(tuple);
  const drizzle = db();
  if (drizzle) {
    const sets = schema.componentMediaSets;
    const rows = await drizzle
      .select()
      .from(sets)
      .where(
        and(
          eq(sets.componentId, t.componentId),
          eq(sets.slot, t.slot),
          eq(sets.variantDim, t.variantDim),
          eq(sets.variantKey, t.variantKey),
          eq(sets.locale, t.locale),
          eq(sets.status, status),
        ),
      )
      .orderBy(desc(sets.version))
      .limit(1);
    return (rows[0] as ComponentMediaSet | undefined) ?? null;
  }
  return (
    Array.from(memoryStore().componentMediaSets.values()).find(
      (s) => s.status === status && sameTuple(t, s),
    ) ?? null
  );
}

/** Assemble ensembles + items + médias (avec variants) en mémoire. */
function assembleWithMedia(
  sets: ComponentMediaSet[],
  items: ComponentMediaSetItem[],
  mediaById: Map<string, MediaSetMedia>,
): ComponentMediaSetWithMedia[] {
  return sortSets(sets).map((s) => ({
    ...s,
    items: items
      .filter((i) => i.setId === s.id)
      .sort((a, b) => a.position - b.position)
      .map(
        (i): ComponentMediaSetItemWithMedia => ({
          ...i,
          media: mediaById.get(i.mediaId) ?? null,
          mobileMedia: i.mobileMediaId ? (mediaById.get(i.mobileMediaId) ?? null) : null,
        }),
      ),
  }));
}

function isUsableMedia(m: Pick<Media, 'deletedAt' | 'status'>): boolean {
  return m.deletedAt === null && MEDIA_USABLE_STATUSES.includes(m.status);
}

/**
 * Ensembles d'un composant aux statuts donnés, avec items, médias et
 * variants, en UNE requête (Postgres). Un média supprimé (soft delete) ou
 * pas encore prêt est renvoyé à `null` : le sélecteur passe alors au niveau
 * de repli suivant (ou ignore l'image mobile).
 */
async function listSetsWithMedia(
  componentId: string,
  statuses: FieldBindingStatus[],
): Promise<ComponentMediaSetWithMedia[]> {
  const drizzle = db();
  if (drizzle) {
    const sets = schema.componentMediaSets;
    const items = schema.componentMediaSetItems;
    const media = schema.media;
    const variants = schema.mediaVariants;
    const rows = await drizzle
      .select({ set: sets, item: items, media, variant: variants })
      .from(sets)
      .innerJoin(items, eq(items.setId, sets.id))
      .leftJoin(
        media,
        and(
          or(eq(media.id, items.mediaId), eq(media.id, items.mobileMediaId)),
          isNull(media.deletedAt),
          inArray(media.status, [...MEDIA_USABLE_STATUSES]),
        ),
      )
      .leftJoin(variants, eq(variants.mediaId, media.id))
      .where(and(eq(sets.componentId, componentId), inArray(sets.status, statuses)))
      .orderBy(asc(sets.id), asc(items.position), asc(variants.createdAt), asc(variants.id));

    const setMap = new Map<string, ComponentMediaSet>();
    const itemMap = new Map<string, ComponentMediaSetItem>();
    const mediaMap = new Map<string, MediaSetMedia>();
    const variantSeen = new Set<string>();
    for (const row of rows) {
      setMap.set(row.set.id, row.set as ComponentMediaSet);
      itemMap.set(row.item.id, row.item as ComponentMediaSetItem);
      if (row.media) {
        let m = mediaMap.get(row.media.id);
        if (!m) {
          m = { ...(row.media as Media), variants: [] };
          mediaMap.set(m.id, m);
        }
        if (row.variant && !variantSeen.has(row.variant.id)) {
          variantSeen.add(row.variant.id);
          m.variants.push(row.variant as MediaVariant);
        }
      }
    }
    return assembleWithMedia([...setMap.values()], [...itemMap.values()], mediaMap);
  }

  const store = memoryStore();
  const sets = Array.from(store.componentMediaSets.values()).filter(
    (s) => s.componentId === componentId && statuses.includes(s.status),
  );
  const setIds = new Set(sets.map((s) => s.id));
  // Comme l'INNER JOIN : un ensemble sans item n'est pas renvoyé.
  const items = Array.from(store.componentMediaSetItems.values()).filter((i) => setIds.has(i.setId));
  const withItems = sets.filter((s) => items.some((i) => i.setId === s.id));
  const mediaMap = new Map<string, MediaSetMedia>();
  for (const id of new Set(items.flatMap((i) => [i.mediaId, i.mobileMediaId]))) {
    if (!id) continue;
    const m = store.media.get(id);
    if (!m || !isUsableMedia(m)) continue;
    const vs = Array.from(store.mediaVariants.values())
      .filter((v) => v.mediaId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    mediaMap.set(id, { ...m, variants: vs });
  }
  return assembleWithMedia(withItems, items, mediaMap);
}

/** Ensembles publiés d'un composant, avec médias (lecture publique, cachée en amont). */
export async function listPublishedSetsWithMedia(
  componentId: string,
): Promise<ComponentMediaSetWithMedia[]> {
  return listSetsWithMedia(componentId, ['published']);
}

/** Vrai si au moins un item a une image desktop affichable. */
function hasRenderableItem(set: ComponentMediaSetWithMedia): boolean {
  return set.items.some((i) => mediaDisplayUrl(i.media) !== null);
}

/**
 * Aperçu admin : pour chaque tuple, le brouillon s'il a au moins une image
 * affichable, sinon le publié (un brouillon dont les médias ne sont pas
 * encore prêts ne doit pas masquer la version en ligne). Jamais mis en cache.
 */
export async function listPreviewSetsWithMedia(
  componentId: string,
): Promise<ComponentMediaSetWithMedia[]> {
  const all = await listSetsWithMedia(componentId, ['published', 'draft']);
  const byTuple = new Map<string, { draft?: ComponentMediaSetWithMedia; published?: ComponentMediaSetWithMedia }>();
  for (const s of all) {
    const key = [s.slot, s.variantDim, s.variantKey, s.locale].join('\u0000');
    const entry = byTuple.get(key) ?? {};
    if (s.status === 'draft') entry.draft = s;
    else entry.published = s;
    byTuple.set(key, entry);
  }
  const picked: ComponentMediaSetWithMedia[] = [];
  for (const { draft, published } of byTuple.values()) {
    const chosen = draft && hasRenderableItem(draft) ? draft : (published ?? draft);
    if (chosen) picked.push(chosen);
  }
  return sortSets(picked);
}

/** Ensembles programmés arrivés à échéance (cron), par `scheduledAt` croissant. */
export async function listScheduledDueSets(now: Date, limit = 100): Promise<ComponentMediaSet[]> {
  const drizzle = db();
  if (drizzle) {
    const t = schema.componentMediaSets;
    const rows = await drizzle
      .select()
      .from(t)
      .where(and(eq(t.status, 'scheduled'), lte(t.scheduledAt, now)))
      .orderBy(asc(t.scheduledAt))
      .limit(limit);
    return rows as ComponentMediaSet[];
  }
  return Array.from(memoryStore().componentMediaSets.values())
    .filter((s) => s.status === 'scheduled' && s.scheduledAt && s.scheduledAt <= now)
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())
    .slice(0, limit);
}

/**
 * Historique d'un tuple (plus récent d'abord). Ordre déterministe : les
 * lignes d'une même mutation ont des `createdAt` distincts
 * (`monotonicClock`), et `id` départage le reste.
 */
export async function listSetHistory(
  tuple: MediaSetTuple,
  limit = 20,
): Promise<ComponentMediaSetHistoryEntry[]> {
  const t = normalizeTuple(tuple);
  const drizzle = db();
  if (drizzle) {
    const h = schema.componentMediaSetHistory;
    const rows = await drizzle
      .select()
      .from(h)
      .where(
        and(
          eq(h.componentId, t.componentId),
          eq(h.slot, t.slot),
          eq(h.variantDim, t.variantDim),
          eq(h.variantKey, t.variantKey),
          eq(h.locale, t.locale),
        ),
      )
      .orderBy(desc(h.createdAt), desc(h.id))
      .limit(limit);
    return rows as ComponentMediaSetHistoryEntry[];
  }
  return Array.from(memoryStore().componentMediaSetHistory.values())
    .filter(
      (e) =>
        e.componentId === t.componentId &&
        e.slot === t.slot &&
        e.variantDim === t.variantDim &&
        e.variantKey === t.variantKey &&
        e.locale === t.locale,
    )
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    )
    .slice(0, limit);
}

export async function getSetHistoryById(id: string): Promise<ComponentMediaSetHistoryEntry | null> {
  const drizzle = db();
  if (drizzle) {
    const h = schema.componentMediaSetHistory;
    const rows = await drizzle.select().from(h).where(eq(h.id, id)).limit(1);
    return (rows[0] as ComponentMediaSetHistoryEntry | undefined) ?? null;
  }
  return memoryStore().componentMediaSetHistory.get(id) ?? null;
}

/** Ensemble qui référence un média (message de refus d'une suppression définitive). */
export interface MediaSetUsage {
  setId: string;
  componentId: string;
  /** `site_components.key`, `null` si le composant a disparu. */
  componentKey: string | null;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  status: FieldBindingStatus;
  version: number;
}

/**
 * Ensembles (tous statuts) dont un item référence `mediaId` (desktop ou
 * mobile). C'est exactement ce que la FK `ON DELETE RESTRICT` protège (I5).
 */
export async function listMediaSetUsages(mediaId: string, limit = 50): Promise<MediaSetUsage[]> {
  const drizzle = db();
  if (drizzle) {
    const sets = schema.componentMediaSets;
    const items = schema.componentMediaSetItems;
    const rows = await drizzle
      .selectDistinct({
        setId: sets.id,
        componentId: sets.componentId,
        componentKey: schema.siteComponents.key,
        slot: sets.slot,
        variantDim: sets.variantDim,
        variantKey: sets.variantKey,
        locale: sets.locale,
        status: sets.status,
        version: sets.version,
      })
      .from(items)
      .innerJoin(sets, eq(sets.id, items.setId))
      .leftJoin(schema.siteComponents, eq(schema.siteComponents.id, sets.componentId))
      .where(or(eq(items.mediaId, mediaId), eq(items.mobileMediaId, mediaId)))
      .limit(limit);
    return rows.map((r) => ({ ...r, componentKey: r.componentKey ?? null }) as MediaSetUsage);
  }
  const store = memoryStore();
  const setIds = new Set(
    Array.from(store.componentMediaSetItems.values())
      .filter((i) => i.mediaId === mediaId || i.mobileMediaId === mediaId)
      .map((i) => i.setId),
  );
  return sortSets(
    Array.from(setIds)
      .map((id) => store.componentMediaSets.get(id))
      .filter((s): s is ComponentMediaSet => !!s),
  )
    .slice(0, limit)
    .map((s) => ({
      setId: s.id,
      componentId: s.componentId,
      componentKey: store.siteComponents.get(s.componentId)?.key ?? null,
      slot: s.slot,
      variantDim: s.variantDim,
      variantKey: s.variantKey,
      locale: s.locale,
      status: s.status,
      version: s.version,
    }));
}

/* ──────────────────────────────────────────────────────────────────
 * Écriture
 * ────────────────────────────────────────────────────────────────── */

/**
 * Crée ou remplace le brouillon du tuple (items remplacés en bloc).
 *
 * Verrouillage optimiste : si `expectedUpdatedAt` (ou `expectedVersion`)
 * est fourni et ne correspond plus au brouillon existant →
 * `MediaSetConflictError`. Deux créations concurrentes du même brouillon
 * se heurtent à l'index unique partiel → `MediaSetConflictError`.
 */
export async function upsertDraftSet(
  input: UpsertDraftSetInput,
  opts: { historyAction?: FieldHistoryAction } = {},
): Promise<ComponentMediaSetWithItems> {
  const tuple = normalizeTuple(input);
  await assertShape(tuple, input.items);

  return atomically(async (repo) => {
    await assertMediaAvailable(repo, input.items);
    const list = await repo.listTuple(tuple);
    const existing = list.find((s) => s.status === 'draft');

    if (existing) {
      if (input.expectedUpdatedAt && !sameInstant(existing.updatedAt, input.expectedUpdatedAt)) {
        throw new MediaSetConflictError(existing);
      }
      if (input.expectedVersion != null && existing.version !== input.expectedVersion) {
        throw new MediaSetConflictError(existing);
      }
      const now = tick(new Date(), existing.updatedAt);
      const updated: ComponentMediaSet = {
        ...existing,
        crossLocale: input.crossLocale ?? existing.crossLocale,
        source: input.source ?? existing.source,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        authorId: input.authorId ?? existing.authorId,
        updatedAt: now,
      };
      if (!(await repo.updateSet(updated, existing.updatedAt))) {
        throw new MediaSetConflictError(await repo.getSet(existing.id));
      }
      const items = buildItems(updated.id, input.items, now);
      await repo.replaceItems(updated.id, items);
      await appendHistory(repo, updated, items, opts.historyAction ?? 'update', input.authorId, input.notes, now);
      return { ...updated, items };
    }

    // Le client croyait modifier un brouillon (If-Match) qui n'existe plus
    // (publié, programmé ou abandonné entre-temps) : on ne recrée pas en
    // silence un brouillon par-dessus — conflit avec l'état courant.
    if (input.expectedUpdatedAt || input.expectedVersion != null) {
      const current =
        [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null;
      throw new MediaSetConflictError(current);
    }

    const now = new Date();
    const created: ComponentMediaSet = {
      id: createId('cms'),
      ...tuple,
      crossLocale: input.crossLocale ?? false,
      status: 'draft',
      version: nextVersion(list),
      publishedAt: null,
      scheduledAt: null,
      source: input.source ?? 'admin',
      notes: input.notes ?? null,
      authorId: input.authorId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await repo.insertSet(created);
    const items = buildItems(created.id, input.items, now);
    await repo.replaceItems(created.id, items);
    await appendHistory(repo, created, items, opts.historyAction ?? 'create', input.authorId, input.notes, now);
    return { ...created, items };
  });
}

/** Charge l'ensemble et applique les contrôles communs (existence, statut, If-Match). */
async function loadForMutation(
  repo: Repo,
  input: MediaSetMutationInput,
  allowed: FieldBindingStatus[],
  action: string,
): Promise<ComponentMediaSet> {
  const set = await repo.getSet(input.setId);
  if (!set) throw new NotFoundError(`Media set ${input.setId} not found`);
  if (!allowed.includes(set.status)) {
    throw new MediaSetStateError(`${action}.invalid_status:${set.status}`);
  }
  if (input.expectedUpdatedAt && !sameInstant(set.updatedAt, input.expectedUpdatedAt)) {
    throw new MediaSetConflictError(set);
  }
  return set;
}

/**
 * Publie un brouillon (ou un programmé) — atomique : archive l'ensemble
 * publié du même tuple, archive la programmation en attente du tuple s'il
 * y en a une autre (publication manuelle prioritaire), publie celui-ci avec
 * une version strictement supérieure. Historique : `archive` (ancien
 * publié), `archive` + note `superseded_by_publish` (programmation
 * annulée), puis `publish` — horodatages strictement croissants.
 */
export async function publishSet(input: MediaSetMutationInput): Promise<ComponentMediaSetWithItems> {
  return atomically(async (repo) => {
    const set = await loadForMutation(repo, input, ['draft', 'scheduled'], 'publish');
    const items = await repo.listItems(set.id);
    if (items.length === 0) {
      throw new MediaSetValidationError([
        { code: 'items.empty', path: ['items'], message: 'Au moins une image est requise' },
      ]);
    }
    await assertMediaAvailable(repo, items);

    const now = tick(input.now ?? new Date(), set.updatedAt);
    const stamp = monotonicClock(now);
    const list = await repo.listTuple(tupleOf(set));

    const previous = list.find((s) => s.status === 'published');
    if (previous) {
      const archived: ComponentMediaSet = {
        ...previous,
        status: 'archived',
        updatedAt: tick(now, previous.updatedAt),
      };
      if (!(await repo.updateSet(archived, previous.updatedAt))) {
        throw new MediaSetConflictError(await repo.getSet(previous.id));
      }
      await appendHistory(
        repo,
        archived,
        await repo.listItems(previous.id),
        'archive',
        input.actorId,
        null,
        stamp(archived.updatedAt),
      );
    }

    // Publication manuelle d'un brouillon alors qu'une autre version est
    // programmée : la programmation deviendrait une régression silencieuse
    // à son échéance → archivée (avec historique).
    for (const pending of list.filter((s) => s.status === 'scheduled' && s.id !== set.id)) {
      const cancelled: ComponentMediaSet = {
        ...pending,
        status: 'archived',
        updatedAt: tick(now, pending.updatedAt),
      };
      if (!(await repo.updateSet(cancelled, pending.updatedAt))) {
        throw new MediaSetConflictError(await repo.getSet(pending.id));
      }
      await appendHistory(
        repo,
        cancelled,
        await repo.listItems(pending.id),
        'archive',
        input.actorId,
        `${MEDIA_SET_SUPERSEDED_NOTE}:${set.id}`,
        stamp(cancelled.updatedAt),
      );
    }

    const others = list.filter((s) => s.id !== set.id);
    const promoted: ComponentMediaSet = {
      ...set,
      status: 'published',
      version: Math.max(set.version, nextVersion(others)),
      publishedAt: now,
      scheduledAt: null,
      updatedAt: now,
      authorId: input.actorId ?? set.authorId,
    };
    if (!(await repo.updateSet(promoted, set.updatedAt))) {
      throw new MediaSetConflictError(await repo.getSet(set.id));
    }
    await appendHistory(repo, promoted, items, 'publish', input.actorId, null, stamp());
    return { ...promoted, items };
  });
}

/**
 * Programme un brouillon pour publication ultérieure (≥ 1 minute). Refusé
 * si une AUTRE programmation est déjà en attente pour le tuple
 * (`schedule.scheduled_exists`, → 409) : l'admin doit d'abord l'annuler.
 */
export async function scheduleSet(input: ScheduleSetInput): Promise<ComponentMediaSetWithItems> {
  return atomically(async (repo) => {
    const set = await loadForMutation(repo, input, ['draft', 'scheduled'], 'schedule');
    const now = input.now ?? new Date();
    if (input.scheduledAt.getTime() <= now.getTime() + SCHEDULE_MIN_DELAY_MS) {
      throw new MediaSetStateError('schedule.in_past');
    }
    const items = await repo.listItems(set.id);
    if (items.length === 0) {
      throw new MediaSetValidationError([
        { code: 'items.empty', path: ['items'], message: 'Au moins une image est requise' },
      ]);
    }
    const list = await repo.listTuple(tupleOf(set));
    if (list.some((s) => s.status === 'scheduled' && s.id !== set.id)) {
      throw new MediaSetStateError('schedule.scheduled_exists');
    }
    const at = tick(now, set.updatedAt);
    const updated: ComponentMediaSet = {
      ...set,
      status: 'scheduled',
      scheduledAt: input.scheduledAt,
      updatedAt: at,
      authorId: input.actorId ?? set.authorId,
    };
    if (!(await repo.updateSet(updated, set.updatedAt))) {
      throw new MediaSetConflictError(await repo.getSet(set.id));
    }
    await appendHistory(repo, updated, items, 'schedule', input.actorId, null, at);
    return { ...updated, items };
  });
}

/**
 * Annule une programmation : l'ensemble redevient brouillon. Refusé si un
 * autre brouillon existe déjà pour le tuple (I1) — l'admin doit choisir
 * (le publier, ou l'abandonner avec `discardDraft`).
 */
export async function cancelSetSchedule(input: MediaSetMutationInput): Promise<ComponentMediaSetWithItems> {
  return atomically(async (repo) => {
    const set = await loadForMutation(repo, input, ['scheduled'], 'cancel_schedule');
    const list = await repo.listTuple(tupleOf(set));
    if (list.some((s) => s.status === 'draft')) {
      throw new MediaSetStateError('cancel_schedule.draft_exists');
    }
    const at = tick(input.now ?? new Date(), set.updatedAt);
    const updated: ComponentMediaSet = { ...set, status: 'draft', scheduledAt: null, updatedAt: at };
    if (!(await repo.updateSet(updated, set.updatedAt))) {
      throw new MediaSetConflictError(await repo.getSet(set.id));
    }
    const items = await repo.listItems(set.id);
    await appendHistory(repo, updated, items, 'unschedule', input.actorId, null, at);
    return { ...updated, items };
  });
}

/**
 * Dépublie : l'ensemble publié est archivé, la cellule retombe au niveau
 * de repli suivant (§4.3).
 */
export async function unpublishSet(input: MediaSetMutationInput): Promise<ComponentMediaSetWithItems> {
  return atomically(async (repo) => {
    const set = await loadForMutation(repo, input, ['published'], 'unpublish');
    const at = tick(input.now ?? new Date(), set.updatedAt);
    const updated: ComponentMediaSet = { ...set, status: 'archived', updatedAt: at };
    if (!(await repo.updateSet(updated, set.updatedAt))) {
      throw new MediaSetConflictError(await repo.getSet(set.id));
    }
    const items = await repo.listItems(set.id);
    await appendHistory(repo, updated, items, 'unpublish', input.actorId, null, at);
    return { ...updated, items };
  });
}

/**
 * Abandonne un brouillon : l'ensemble et ses items sont SUPPRIMÉS (libère
 * les médias pour une suppression définitive), l'historique est conservé.
 * Ligne d'historique : action `archive` (pas de valeur `discard` dans
 * `field_history_action`), statut `draft`, note `discard_draft`, avec
 * l'instantané des items — restaurable via `restoreSetFromHistory`.
 * Renvoie l'ensemble tel qu'il était avant suppression.
 */
export async function discardDraft(input: MediaSetMutationInput): Promise<ComponentMediaSetWithItems> {
  return atomically(async (repo) => {
    const set = await loadForMutation(repo, input, ['draft'], 'discard');
    const items = await repo.listItems(set.id);
    const at = tick(input.now ?? new Date(), set.updatedAt);
    if (!(await repo.deleteSet(set.id, set.updatedAt))) {
      throw new MediaSetConflictError(await repo.getSet(set.id));
    }
    await appendHistory(repo, set, items, 'archive', input.actorId, MEDIA_SET_DISCARD_NOTE, at);
    return { ...set, items };
  });
}

/**
 * Restaure un instantané d'historique sous forme de BROUILLON du même tuple
 * (jamais publié directement). Écrase le brouillon existant le cas échéant.
 */
export async function restoreSetFromHistory(
  input: RestoreSetInput,
): Promise<ComponentMediaSetWithItems> {
  const snapshot = await getSetHistoryById(input.historyId);
  if (!snapshot) throw new NotFoundError(`History ${input.historyId} not found`);
  return upsertDraftSet(
    {
      componentId: snapshot.componentId,
      slot: snapshot.slot,
      variantDim: snapshot.variantDim,
      variantKey: snapshot.variantKey,
      locale: snapshot.locale,
      crossLocale: snapshot.crossLocale,
      items: [...snapshot.items]
        .sort((a, b) => a.position - b.position)
        .map((i) => ({
          mediaId: i.mediaId,
          mobileMediaId: i.mobileMediaId,
          alt: i.alt,
          objectPosition: i.objectPosition,
          focalX: i.focalX,
          focalY: i.focalY,
        })),
      authorId: input.actorId,
      notes: `restore from version ${snapshot.version}`,
      expectedUpdatedAt: input.expectedUpdatedAt,
    },
    { historyAction: 'restore' },
  );
}

function withoutItems(set: ComponentMediaSetWithItems): ComponentMediaSet {
  const copy: Partial<ComponentMediaSetWithItems> = { ...set };
  delete copy.items;
  return copy as ComponentMediaSet;
}

/** Ensemble promu par le cron, avec la clé de son composant (invalidation). */
export interface PromotedMediaSet extends ComponentMediaSet {
  /**
   * `site_components.key` — pour `revalidateTag(mediaSetsCacheTag(key))`.
   * `null` seulement si le composant a disparu entre-temps.
   */
  componentKey: string | null;
}

export interface PromoteDueMediaSetsResult {
  promoted: PromotedMediaSet[];
  /**
   * Course avec un autre tick (ou une publication manuelle) : l'ensemble a
   * déjà été publié ou modifié entre la lecture et la publication. Pas une
   * erreur — rien à faire.
   */
  skipped: Array<{ setId: string; reason: 'already_published' | 'superseded' | 'version_conflict' }>;
  /**
   * Programmation bloquée : un média de l'ensemble a été supprimé ou est
   * introuvable. Elle restera due à chaque tick jusqu'à correction par
   * l'admin (liste `stuckScheduled` de GET /media-sets).
   */
  stuck: Array<{ setId: string; issues: string[] }>;
  failed: Array<{ setId: string; error: string }>;
}

/** Codes de validation qui signalent un média indisponible (programmation bloquée). */
const MEDIA_UNAVAILABLE_ISSUES = new Set(['item.media_deleted', 'item.media_not_found']);

/**
 * Publie les ensembles programmés arrivés à échéance (appelé par les crons
 * `promote-scheduled-fields` et `promote-now`). Un échec n'empêche pas les
 * suivants. Chaque ensemble promu porte `componentKey` pour que le cron
 * invalide `mediaSetsCacheTag(componentKey)` ; la recherche de la clé est
 * HORS de la publication : un échec de lecture du composant ne fait pas
 * passer pour « échoué » un ensemble bel et bien publié (clé `null`).
 */
export async function promoteDueMediaSets(now: Date = new Date()): Promise<PromoteDueMediaSetsResult> {
  return promoteScheduledSets(await listScheduledDueSets(now), now);
}

/**
 * Publie une liste d'ensembles programmés lue au préalable (cœur de
 * `promoteDueMediaSets`). La lecture peut être périmée — un autre tick ou
 * une publication manuelle est passé entre-temps : ces cas sont classés
 * `skipped`, jamais `failed`.
 */
export async function promoteScheduledSets(
  due: readonly ComponentMediaSet[],
  now: Date = new Date(),
): Promise<PromoteDueMediaSetsResult> {
  const result: PromoteDueMediaSetsResult = { promoted: [], skipped: [], stuck: [], failed: [] };
  const keys = new Map<string, string | null>();
  for (const set of due) {
    let published: ComponentMediaSetWithItems;
    try {
      published = await publishSet({
        setId: set.id,
        actorId: null,
        expectedUpdatedAt: set.updatedAt,
        now,
      });
    } catch (err) {
      if (err instanceof MediaSetConflictError) {
        result.skipped.push({ setId: set.id, reason: 'version_conflict' });
      } else if (err instanceof MediaSetStateError && err.reason === 'publish.invalid_status:published') {
        result.skipped.push({ setId: set.id, reason: 'already_published' });
      } else if (err instanceof MediaSetStateError && err.reason === 'publish.invalid_status:archived') {
        // Une publication manuelle a annulé cette programmation entre-temps.
        result.skipped.push({ setId: set.id, reason: 'superseded' });
      } else if (
        err instanceof MediaSetValidationError &&
        err.issues.length > 0 &&
        err.issues.every((i) => MEDIA_UNAVAILABLE_ISSUES.has(i.code))
      ) {
        result.stuck.push({ setId: set.id, issues: Array.from(new Set(err.issues.map((i) => i.code))) });
      } else {
        result.failed.push({ setId: set.id, error: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }
    if (!keys.has(published.componentId)) {
      // Lecture en échec → clé `null` (l'appelant invalide alors au moins
      // le tag global `components`) ; non mise en cache, retentée au suivant.
      const component = await getSiteComponentById(published.componentId).catch(() => undefined);
      if (component !== undefined) keys.set(published.componentId, component?.key ?? null);
    }
    result.promoted.push({
      ...withoutItems(published),
      componentKey: keys.get(published.componentId) ?? null,
    });
  }
  return result;
}
