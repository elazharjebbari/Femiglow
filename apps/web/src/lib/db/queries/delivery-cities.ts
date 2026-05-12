/**
 * DELIV-CITIES — Requêtes sur le catalogue de villes de livraison.
 *
 * Dual driver : Drizzle si DATABASE_URL, fallback memoryStore en dev/tests.
 *
 * API publique
 * ────────────
 *  - listDeliveryCities      : admin — listing paginé + filtres.
 *  - searchDeliveryCities    : public — autocomplete FR + AR (insensible accents).
 *  - findDeliveryCityBySlug  : public — lookup par slug stable.
 *  - findDeliveryCityById    : admin — lookup par id.
 *  - bulkUpsertDeliveryCities: seeder — upsert idempotent par slug, préserve
 *                              les éditions admin (`source !== 'sendit'`).
 *  - createDeliveryCity      : admin — création manuelle.
 *  - updateDeliveryCity      : admin — édition (prix, ETA, nom, aliases, …).
 *  - setDeliveryCityActive   : admin — toggle visibilité.
 *  - deleteDeliveryCity      : admin — suppression définitive (rare).
 *  - countActiveDeliveryCities: admin — KPI dashboard.
 *
 * Stratégie de recherche
 * ──────────────────────
 *  - Script détecté côté code (`isArabicInput`).
 *  - FR : ILIKE préfixe sur name_fr + match alias (post-filter en mémoire).
 *  - AR : ILIKE préfixe sur name_ar + normalisation tashkil/ال (post-filter).
 *  - Query vide : top-N actifs triés par position, puis nameFr.
 *
 * Le dataset (~430 lignes) tient en mémoire — le post-filter pour les alias
 * et la normalisation arabe ne pose pas de problème de scalabilité.
 */
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import {
  normalizeArabicKey,
  normalizeCityKey,
} from '@/lib/checkout/data/moroccan-cities';

// ─────────────────────────────────────────────────────────────────────────────
// Types externes (DTO d'API)
// ─────────────────────────────────────────────────────────────────────────────

export interface DeliveryCity {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string | null;
  countryCode: string;
  deliveryPriceMad: number;
  deliveryEta: string;
  isActive: boolean;
  source: 'sendit' | 'manual' | 'custom';
  externalRef: string | null;
  aliases: string[];
  metadata: Record<string, unknown>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface DeliveryCityInput {
  slug: string;
  nameFr: string;
  nameAr?: string | null;
  countryCode?: string;
  deliveryPriceMad: number;
  deliveryEta: string;
  isActive?: boolean;
  source?: 'sendit' | 'manual' | 'custom';
  externalRef?: string | null;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  position?: number;
}

export interface DeliveryCityPatch {
  nameFr?: string;
  nameAr?: string | null;
  deliveryPriceMad?: number;
  deliveryEta?: string;
  isActive?: boolean;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  position?: number;
  /** Si défini, override la source de la ville (audit lors d'édition admin). */
  source?: 'sendit' | 'manual' | 'custom';
}

export interface ListOptions {
  active?: boolean | 'all';
  countryCode?: string;
  q?: string;
  source?: 'sendit' | 'manual' | 'custom' | 'all';
  page?: number;
  pageSize?: number;
  sort?: 'position' | 'name' | 'price' | 'updated';
}

export interface ListResult {
  items: DeliveryCity[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchOptions {
  /** Code ISO 3166-1 alpha-2 (défaut 'MA'). */
  countryCode?: string;
  /** Nombre max de résultats (défaut 8, max 50). */
  limit?: number;
  /** Inclut les villes inactives (admin uniquement). */
  includeInactive?: boolean;
}

export interface BulkUpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
  /** Slugs des villes ignorées (source !== 'sendit', éditées par l'admin). */
  preservedSlugs: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory store extension
// ─────────────────────────────────────────────────────────────────────────────

interface ExtendedStore {
  deliveryCities: Map<string, DeliveryCity>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.deliveryCities) store.deliveryCities = new Map();
  return store;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────────────────

function rowToCity(r: typeof schema.deliveryCities.$inferSelect): DeliveryCity {
  return {
    id: r.id,
    slug: r.slug,
    nameFr: r.nameFr,
    nameAr: r.nameAr,
    countryCode: r.countryCode,
    deliveryPriceMad: r.deliveryPriceMad,
    deliveryEta: r.deliveryEta,
    isActive: r.isActive,
    source: r.source as DeliveryCity['source'],
    externalRef: r.externalRef,
    aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    position: r.position,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdBy: r.createdBy,
    updatedBy: r.updatedBy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTING (admin)
// ─────────────────────────────────────────────────────────────────────────────

export async function listDeliveryCities(
  opts: ListOptions = {},
): Promise<ListResult> {
  const page = Math.max(opts.page ?? 1, 1);
  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 1), 500);
  const offset = (page - 1) * pageSize;
  const drizzle = db();

  if (drizzle) {
    const conds = [];
    if (opts.active === true) conds.push(eq(schema.deliveryCities.isActive, true));
    if (opts.active === false) conds.push(eq(schema.deliveryCities.isActive, false));
    if (opts.countryCode) {
      conds.push(eq(schema.deliveryCities.countryCode, opts.countryCode));
    }
    if (opts.source && opts.source !== 'all') {
      conds.push(eq(schema.deliveryCities.source, opts.source));
    }
    if (opts.q) {
      const needle = `%${opts.q}%`;
      conds.push(
        or(
          ilike(schema.deliveryCities.nameFr, needle),
          ilike(schema.deliveryCities.slug, needle),
          ilike(schema.deliveryCities.nameAr, needle),
        )!,
      );
    }
    const where = conds.length ? and(...conds) : undefined;

    const order =
      opts.sort === 'name'
        ? asc(schema.deliveryCities.nameFr)
        : opts.sort === 'price'
          ? asc(schema.deliveryCities.deliveryPriceMad)
          : opts.sort === 'updated'
            ? desc(schema.deliveryCities.updatedAt)
            : asc(schema.deliveryCities.position);

    const [items, totalRows] = await Promise.all([
      drizzle
        .select()
        .from(schema.deliveryCities)
        .where(where)
        .orderBy(order, asc(schema.deliveryCities.nameFr))
        .limit(pageSize)
        .offset(offset),
      drizzle
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.deliveryCities)
        .where(where),
    ]);

    return {
      items: items.map(rowToCity),
      total: totalRows[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  // Fallback mémoire
  let rows = Array.from(ext().deliveryCities.values());
  if (opts.active === true) rows = rows.filter((c) => c.isActive);
  if (opts.active === false) rows = rows.filter((c) => !c.isActive);
  if (opts.countryCode) rows = rows.filter((c) => c.countryCode === opts.countryCode);
  if (opts.source && opts.source !== 'all') {
    rows = rows.filter((c) => c.source === opts.source);
  }
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    rows = rows.filter(
      (c) =>
        c.nameFr.toLowerCase().includes(needle) ||
        c.slug.toLowerCase().includes(needle) ||
        (c.nameAr ?? '').toLowerCase().includes(needle),
    );
  }
  rows.sort((a, b) => {
    switch (opts.sort) {
      case 'name':
        return a.nameFr.localeCompare(b.nameFr, 'fr');
      case 'price':
        return a.deliveryPriceMad - b.deliveryPriceMad;
      case 'updated':
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      default:
        return a.position - b.position || a.nameFr.localeCompare(b.nameFr, 'fr');
    }
  });
  const total = rows.length;
  return { items: rows.slice(offset, offset + pageSize), total, page, pageSize };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH (public — autocomplete combobox)
// ─────────────────────────────────────────────────────────────────────────────

function isArabicInput(input: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/u.test(input);
}

/**
 * Autocomplete par préfixe. Retourne au plus `limit` résultats actifs,
 * triés par position puis nom. Si `query` est vide, renvoie les premiers
 * (utile pour afficher des suggestions au focus).
 */
export async function searchDeliveryCities(
  query: string,
  opts: SearchOptions = {},
): Promise<DeliveryCity[]> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 50);
  const countryCode = opts.countryCode ?? 'MA';
  const trimmed = (query ?? '').trim();
  const drizzle = db();

  // Cas query vide : top-N actifs (position ASC, name ASC).
  if (!trimmed) {
    if (drizzle) {
      const rows = await drizzle
        .select()
        .from(schema.deliveryCities)
        .where(
          and(
            eq(schema.deliveryCities.countryCode, countryCode),
            opts.includeInactive ? undefined : eq(schema.deliveryCities.isActive, true),
          ),
        )
        .orderBy(
          asc(schema.deliveryCities.position),
          asc(schema.deliveryCities.nameFr),
        )
        .limit(limit);
      return rows.map(rowToCity);
    }
    return Array.from(ext().deliveryCities.values())
      .filter(
        (c) =>
          c.countryCode === countryCode &&
          (opts.includeInactive || c.isActive),
      )
      .sort((a, b) => a.position - b.position || a.nameFr.localeCompare(b.nameFr, 'fr'))
      .slice(0, limit);
  }

  const arabic = isArabicInput(trimmed);

  // Phase 1 — pré-filter via index (préfixe ILIKE FR ou AR).
  // Phase 2 — post-filter pour normalisation accents / tashkil / aliases.
  if (drizzle) {
    const baseConds = [eq(schema.deliveryCities.countryCode, countryCode)];
    if (!opts.includeInactive) {
      baseConds.push(eq(schema.deliveryCities.isActive, true));
    }
    // On élargit la fenêtre via ILIKE %needle% pour capter les alias
    // qui pourraient ne pas matcher le préfixe FR. Sur 429 lignes
    // c'est OK ; la sélection est ensuite ré-filtrée précisément en mémoire.
    const needle = `%${trimmed}%`;
    const fieldCond = arabic
      ? or(
          ilike(schema.deliveryCities.nameAr, needle),
          ilike(schema.deliveryCities.nameFr, needle),
        )!
      : or(
          ilike(schema.deliveryCities.nameFr, needle),
          ilike(schema.deliveryCities.slug, needle),
          ilike(schema.deliveryCities.nameAr, needle),
        )!;
    const rows = await drizzle
      .select()
      .from(schema.deliveryCities)
      .where(and(...baseConds, fieldCond))
      .orderBy(asc(schema.deliveryCities.position), asc(schema.deliveryCities.nameFr))
      .limit(Math.max(limit * 4, 32)); // marge pour post-filter
    const candidates = rows.map(rowToCity);
    return postFilterAndRank(candidates, trimmed, arabic, limit);
  }

  // Fallback mémoire — full scan
  const candidates = Array.from(ext().deliveryCities.values()).filter(
    (c) =>
      c.countryCode === countryCode &&
      (opts.includeInactive || c.isActive),
  );
  return postFilterAndRank(candidates, trimmed, arabic, limit);
}

function postFilterAndRank(
  candidates: DeliveryCity[],
  query: string,
  arabic: boolean,
  limit: number,
): DeliveryCity[] {
  if (candidates.length === 0) return [];

  if (arabic) {
    const q = normalizeArabicKey(query);
    if (!q) return [];
    const matched: Array<{ city: DeliveryCity; rank: number }> = [];
    for (const c of candidates) {
      const nameArKey = c.nameAr ? normalizeArabicKey(c.nameAr) : '';
      const aliasMatch = c.aliases.some(
        (a) => isArabicInput(a) && normalizeArabicKey(a).startsWith(q),
      );
      let rank: number | null = null;
      if (nameArKey && nameArKey.startsWith(q)) rank = 0; // préfixe nom AR
      else if (aliasMatch) rank = 1;
      else if (nameArKey && nameArKey.includes(q)) rank = 2;
      if (rank !== null) matched.push({ city: c, rank });
    }
    matched.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.city.position - b.city.position ||
        a.city.nameFr.localeCompare(b.city.nameFr, 'fr'),
    );
    return matched.slice(0, limit).map((m) => m.city);
  }

  const q = normalizeCityKey(query);
  if (!q) return [];
  const matched: Array<{ city: DeliveryCity; rank: number }> = [];
  for (const c of candidates) {
    const nameFrKey = normalizeCityKey(c.nameFr);
    const slugKey = c.slug.toLowerCase();
    const aliasPrefix = c.aliases.some(
      (a) => !isArabicInput(a) && normalizeCityKey(a).startsWith(q),
    );
    let rank: number | null = null;
    if (nameFrKey.startsWith(q)) rank = 0;
    else if (slugKey.startsWith(q.replace(/\s+/g, '-'))) rank = 0;
    else if (aliasPrefix) rank = 1;
    else if (nameFrKey.includes(q)) rank = 2;
    if (rank !== null) matched.push({ city: c, rank });
  }
  matched.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.city.position - b.city.position ||
      a.city.nameFr.localeCompare(b.city.nameFr, 'fr'),
  );
  return matched.slice(0, limit).map((m) => m.city);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────────

export async function findDeliveryCityBySlug(
  slug: string,
): Promise<DeliveryCity | null> {
  if (!slug) return null;
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.deliveryCities)
      .where(eq(schema.deliveryCities.slug, slug))
      .limit(1);
    return rows[0] ? rowToCity(rows[0]) : null;
  }
  for (const c of ext().deliveryCities.values()) {
    if (c.slug === slug) return c;
  }
  return null;
}

export async function findDeliveryCityById(
  id: string,
): Promise<DeliveryCity | null> {
  if (!id) return null;
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.deliveryCities)
      .where(eq(schema.deliveryCities.id, id))
      .limit(1);
    return rows[0] ? rowToCity(rows[0]) : null;
  }
  return ext().deliveryCities.get(id) ?? null;
}

/**
 * Bulk lookup par slug — utilisé par le router public pour résoudre
 * plusieurs villes en une requête.
 */
export async function findDeliveryCitiesBySlugs(
  slugs: string[],
): Promise<DeliveryCity[]> {
  if (!slugs.length) return [];
  const unique = Array.from(new Set(slugs.filter((s) => typeof s === 'string' && s)));
  if (!unique.length) return [];
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.deliveryCities)
      .where(inArray(schema.deliveryCities.slug, unique));
    return rows.map(rowToCity);
  }
  return Array.from(ext().deliveryCities.values()).filter((c) =>
    unique.includes(c.slug),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS (admin + seeder)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert massif des villes. Idempotent.
 *
 * Règle métier critique : **préserve les éditions admin**. Une ligne dont
 * `source !== 'sendit'` (édité manuellement) est intouchée — sauf si le
 * caller passe `force: true`. Cela évite qu'un seed nocturne écrase une
 * correction de prix faite via /admin.
 *
 * Lignes nouvelles → INSERT, lignes existantes (par slug) avec source='sendit'
 * → UPDATE des champs modifiables, ligne avec source!='sendit' → SKIP.
 */
export async function bulkUpsertDeliveryCities(
  inputs: DeliveryCityInput[],
  opts: { actorId?: string | null; force?: boolean } = {},
): Promise<BulkUpsertResult> {
  if (inputs.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, preservedSlugs: [] };
  }

  const drizzle = db();
  const actorId = opts.actorId ?? null;
  const force = opts.force === true;

  if (drizzle) {
    const slugs = inputs.map((i) => i.slug);
    // 1) Lookup des existants pour distinguer insert/update/skip.
    const existing = await drizzle
      .select({
        slug: schema.deliveryCities.slug,
        source: schema.deliveryCities.source,
      })
      .from(schema.deliveryCities)
      .where(inArray(schema.deliveryCities.slug, slugs));
    const existingMap = new Map(existing.map((r) => [r.slug, r.source as string]));

    const preservedSlugs: string[] = [];
    const toInsert: DeliveryCityInput[] = [];
    const toUpdate: DeliveryCityInput[] = [];

    for (const input of inputs) {
      const src = existingMap.get(input.slug);
      if (src === undefined) {
        toInsert.push(input);
      } else if (force || src === 'sendit') {
        toUpdate.push(input);
      } else {
        preservedSlugs.push(input.slug);
      }
    }

    // 2) Insert massif
    if (toInsert.length > 0) {
      await drizzle.insert(schema.deliveryCities).values(
        toInsert.map((i) => ({
          id: `dc_${i.slug}`,
          slug: i.slug,
          nameFr: i.nameFr,
          nameAr: i.nameAr ?? null,
          countryCode: i.countryCode ?? 'MA',
          deliveryPriceMad: i.deliveryPriceMad,
          deliveryEta: i.deliveryEta,
          isActive: i.isActive ?? true,
          source: i.source ?? 'sendit',
          externalRef: i.externalRef ?? null,
          aliases: i.aliases ?? [],
          metadata: i.metadata ?? {},
          position: i.position ?? 0,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    // 3) Updates (boucle — bulk update PG nécessite VALUES + JOIN, overkill ici)
    for (const i of toUpdate) {
      await drizzle
        .update(schema.deliveryCities)
        .set({
          nameFr: i.nameFr,
          nameAr: i.nameAr ?? null,
          countryCode: i.countryCode ?? 'MA',
          deliveryPriceMad: i.deliveryPriceMad,
          deliveryEta: i.deliveryEta,
          isActive: i.isActive ?? true,
          externalRef: i.externalRef ?? null,
          aliases: i.aliases ?? [],
          metadata: i.metadata ?? {},
          position: i.position ?? 0,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(schema.deliveryCities.slug, i.slug));
    }

    return {
      inserted: toInsert.length,
      updated: toUpdate.length,
      skipped: preservedSlugs.length,
      preservedSlugs,
    };
  }

  // Fallback mémoire
  const store = ext();
  const preservedSlugs: string[] = [];
  let inserted = 0;
  let updated = 0;
  const now = new Date();

  for (const i of inputs) {
    const id = `dc_${i.slug}`;
    const existing = store.deliveryCities.get(id);
    if (!existing) {
      store.deliveryCities.set(id, {
        id,
        slug: i.slug,
        nameFr: i.nameFr,
        nameAr: i.nameAr ?? null,
        countryCode: i.countryCode ?? 'MA',
        deliveryPriceMad: i.deliveryPriceMad,
        deliveryEta: i.deliveryEta,
        isActive: i.isActive ?? true,
        source: i.source ?? 'sendit',
        externalRef: i.externalRef ?? null,
        aliases: i.aliases ?? [],
        metadata: i.metadata ?? {},
        position: i.position ?? 0,
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
        updatedBy: actorId,
      });
      inserted++;
    } else if (force || existing.source === 'sendit') {
      store.deliveryCities.set(id, {
        ...existing,
        nameFr: i.nameFr,
        nameAr: i.nameAr ?? null,
        countryCode: i.countryCode ?? existing.countryCode,
        deliveryPriceMad: i.deliveryPriceMad,
        deliveryEta: i.deliveryEta,
        isActive: i.isActive ?? existing.isActive,
        externalRef: i.externalRef ?? null,
        aliases: i.aliases ?? existing.aliases,
        metadata: i.metadata ?? existing.metadata,
        position: i.position ?? existing.position,
        updatedAt: now,
        updatedBy: actorId,
      });
      updated++;
    } else {
      preservedSlugs.push(i.slug);
    }
  }

  return { inserted, updated, skipped: preservedSlugs.length, preservedSlugs };
}

export async function createDeliveryCity(
  input: DeliveryCityInput,
  opts: { actorId?: string | null } = {},
): Promise<DeliveryCity> {
  const drizzle = db();
  const actorId = opts.actorId ?? null;
  const id = `dc_${input.slug}`;
  const payload = {
    id,
    slug: input.slug,
    nameFr: input.nameFr,
    nameAr: input.nameAr ?? null,
    countryCode: input.countryCode ?? 'MA',
    deliveryPriceMad: input.deliveryPriceMad,
    deliveryEta: input.deliveryEta,
    isActive: input.isActive ?? true,
    source: input.source ?? 'manual',
    externalRef: input.externalRef ?? null,
    aliases: input.aliases ?? [],
    metadata: input.metadata ?? {},
    position: input.position ?? 0,
    createdBy: actorId,
    updatedBy: actorId,
  };
  if (drizzle) {
    const [row] = await drizzle.insert(schema.deliveryCities).values(payload).returning();
    if (!row) throw new Error('delivery_city_create_failed');
    return rowToCity(row);
  }
  const now = new Date();
  const city: DeliveryCity = {
    ...payload,
    source: payload.source as DeliveryCity['source'],
    createdAt: now,
    updatedAt: now,
  };
  ext().deliveryCities.set(id, city);
  return city;
}

export async function updateDeliveryCity(
  slug: string,
  patch: DeliveryCityPatch,
  opts: { actorId?: string | null } = {},
): Promise<DeliveryCity | null> {
  if (!slug) return null;
  const drizzle = db();
  const actorId = opts.actorId ?? null;
  if (drizzle) {
    const setBlock: Record<string, unknown> = { updatedAt: new Date(), updatedBy: actorId };
    if (patch.nameFr !== undefined) setBlock.nameFr = patch.nameFr;
    if (patch.nameAr !== undefined) setBlock.nameAr = patch.nameAr;
    if (patch.deliveryPriceMad !== undefined) {
      setBlock.deliveryPriceMad = patch.deliveryPriceMad;
    }
    if (patch.deliveryEta !== undefined) setBlock.deliveryEta = patch.deliveryEta;
    if (patch.isActive !== undefined) setBlock.isActive = patch.isActive;
    if (patch.aliases !== undefined) setBlock.aliases = patch.aliases;
    if (patch.metadata !== undefined) setBlock.metadata = patch.metadata;
    if (patch.position !== undefined) setBlock.position = patch.position;
    if (patch.source !== undefined) setBlock.source = patch.source;
    const [row] = await drizzle
      .update(schema.deliveryCities)
      .set(setBlock)
      .where(eq(schema.deliveryCities.slug, slug))
      .returning();
    return row ? rowToCity(row) : null;
  }
  const store = ext();
  for (const [id, city] of store.deliveryCities) {
    if (city.slug !== slug) continue;
    const next: DeliveryCity = {
      ...city,
      ...(patch.nameFr !== undefined ? { nameFr: patch.nameFr } : {}),
      ...(patch.nameAr !== undefined ? { nameAr: patch.nameAr } : {}),
      ...(patch.deliveryPriceMad !== undefined
        ? { deliveryPriceMad: patch.deliveryPriceMad }
        : {}),
      ...(patch.deliveryEta !== undefined ? { deliveryEta: patch.deliveryEta } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.aliases !== undefined ? { aliases: patch.aliases } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      updatedAt: new Date(),
      updatedBy: actorId,
    };
    store.deliveryCities.set(id, next);
    return next;
  }
  return null;
}

export async function setDeliveryCityActive(
  slug: string,
  active: boolean,
  opts: { actorId?: string | null } = {},
): Promise<DeliveryCity | null> {
  return updateDeliveryCity(slug, { isActive: active }, opts);
}

export async function deleteDeliveryCity(slug: string): Promise<boolean> {
  if (!slug) return false;
  const drizzle = db();
  if (drizzle) {
    // `.returning(fields)` collapse sur l'union DrizzleNeon | DrizzlePg —
    // on revient au `.returning()` plein puis on lit `.length`.
    const rows = await drizzle
      .delete(schema.deliveryCities)
      .where(eq(schema.deliveryCities.slug, slug))
      .returning();
    return rows.length > 0;
  }
  const store = ext();
  for (const [id, city] of store.deliveryCities) {
    if (city.slug === slug) {
      store.deliveryCities.delete(id);
      return true;
    }
  }
  return false;
}

export async function countActiveDeliveryCities(
  countryCode = 'MA',
): Promise<number> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.deliveryCities)
      .where(
        and(
          eq(schema.deliveryCities.countryCode, countryCode),
          eq(schema.deliveryCities.isActive, true),
        ),
      );
    return rows[0]?.count ?? 0;
  }
  let n = 0;
  for (const c of ext().deliveryCities.values()) {
    if (c.countryCode === countryCode && c.isActive) n++;
  }
  return n;
}
