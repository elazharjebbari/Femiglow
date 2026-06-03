/**
 * Repo coupons — dual driver (Drizzle si DATABASE_URL, sinon memoryStore).
 *
 * Suit le pattern `app-config.ts` : la table memoryStore est ajoutée
 * paresseusement via `ext()` (pas de modification du Store global), ce qui
 * garantit l'isolation entre tests (`resetMemoryStore()` la fait disparaître).
 *
 * cf. docs/coupons-qa-2026-06-02/01-data-model/.
 */
import { and, desc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { CouponRow } from '@/lib/db/schema';
import type {
  CouponDef,
  CouponEligibility,
  CouponStatus,
} from '@/lib/coupons/types';
import type { CouponInput, CouponPatch } from '@/lib/coupons/schemas';

interface ExtendedStore {
  coupons: Map<string, CouponRow>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.coupons) store.coupons = new Map();
  return store;
}

/** Normalise une row (DB ou mémoire) vers la forme domaine `CouponDef`. */
export function mapRowToDef(row: CouponRow): CouponDef {
  return {
    id: row.id,
    label: row.label,
    code: row.code,
    type: row.type,
    mode: row.mode,
    status: row.status,
    valueKind: row.valueKind,
    valueAmount: row.valueAmount,
    target: row.target,
    currency: row.currency,
    eligibility: (row.eligibility ?? {}) as CouponEligibility,
    startsAt: row.startsAt ? new Date(row.startsAt) : null,
    endsAt: row.endsAt ? new Date(row.endsAt) : null,
    stackable: row.stackable,
    usageScope: row.usageScope,
    usageCap: row.usageCap,
    usageCount: row.usageCount,
    holdoutPct: row.holdoutPct,
    priority: row.priority,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(0),
  };
}

function buildRow(id: string, input: CouponInput, now: Date, actorId: string | null): CouponRow {
  return {
    id,
    label: input.label,
    code: input.code ?? null,
    type: input.type,
    mode: input.mode,
    status: input.status,
    valueKind: input.valueKind,
    valueAmount: input.valueAmount,
    target: input.target,
    currency: input.currency,
    eligibility: input.eligibility ?? {},
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    stackable: input.stackable,
    usageScope: input.usageScope,
    usageCap: input.usageCap ?? null,
    usageCount: 0,
    holdoutPct: input.holdoutPct,
    priority: input.priority,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  } as CouponRow;
}

// ── Lecture moteur ────────────────────────────────────────────────────────

/** Coupons en mode `auto` (le moteur filtre ensuite statut/fenêtre/éligibilité). */
export async function listAutoCoupons(): Promise<CouponDef[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.mode, 'auto'));
    return rows.map(mapRowToDef);
  }
  return Array.from(ext().coupons.values())
    .filter((c) => c.mode === 'auto')
    .map(mapRowToDef);
}

// ── CRUD admin ──────────────────────────────────────────────────────────────

export interface ListCouponsFilter {
  status?: CouponStatus;
  type?: CouponDef['type'];
}

export async function listCoupons(filter: ListCouponsFilter = {}): Promise<CouponDef[]> {
  const drizzle = db();
  if (drizzle) {
    const conds = [];
    if (filter.status) conds.push(eq(schema.coupons.status, filter.status));
    if (filter.type) conds.push(eq(schema.coupons.type, filter.type));
    const rows = await drizzle
      .select()
      .from(schema.coupons)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.coupons.createdAt));
    return rows.map(mapRowToDef);
  }
  let rows = Array.from(ext().coupons.values());
  if (filter.status) rows = rows.filter((c) => c.status === filter.status);
  if (filter.type) rows = rows.filter((c) => c.type === filter.type);
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows.map(mapRowToDef);
}

export async function getCouponById(id: string): Promise<CouponDef | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.id, id))
      .limit(1);
    return rows[0] ? mapRowToDef(rows[0]) : null;
  }
  const row = ext().coupons.get(id);
  return row ? mapRowToDef(row) : null;
}

async function findByCode(code: string): Promise<CouponDef | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.code, code))
      .limit(1);
    return rows[0] ? mapRowToDef(rows[0]) : null;
  }
  const row = Array.from(ext().coupons.values()).find((c) => c.code === code);
  return row ? mapRowToDef(row) : null;
}

export class DuplicateCouponCodeError extends Error {
  constructor(public code: string) {
    super(`Code coupon déjà utilisé : ${code}`);
    this.name = 'DuplicateCouponCodeError';
  }
}

export async function createCoupon(
  input: CouponInput,
  actorId: string | null = null,
  now: Date = new Date(),
): Promise<CouponDef> {
  if (input.code) {
    const existing = await findByCode(input.code);
    if (existing) throw new DuplicateCouponCodeError(input.code);
  }
  const id = createId('cpn');
  const row = buildRow(id, input, now, actorId);
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.coupons).values(row as never);
  } else {
    ext().coupons.set(id, row);
  }
  return mapRowToDef(row);
}

export async function updateCoupon(
  id: string,
  patch: CouponPatch,
  now: Date = new Date(),
): Promise<CouponDef | null> {
  const current = await getCouponById(id);
  if (!current) return null;
  if (patch.code && patch.code !== current.code) {
    const dup = await findByCode(patch.code);
    if (dup && dup.id !== id) throw new DuplicateCouponCodeError(patch.code);
  }
  const drizzle = db();
  const setValues: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) setValues[k] = v;
  }
  if (drizzle) {
    await drizzle.update(schema.coupons).set(setValues as never).where(eq(schema.coupons.id, id));
    return getCouponById(id);
  }
  const row = ext().coupons.get(id)!;
  ext().coupons.set(id, { ...row, ...(setValues as Partial<CouponRow>) });
  return getCouponById(id);
}

export async function setCouponStatus(
  id: string,
  status: CouponStatus,
  now: Date = new Date(),
): Promise<CouponDef | null> {
  return updateCoupon(id, { status }, now);
}

/** Incrémente le compteur d'usage (à la conversion). Best-effort. */
export async function incrementUsage(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.id, id))
      .limit(1);
    if (rows[0]) {
      await drizzle
        .update(schema.coupons)
        .set({ usageCount: rows[0].usageCount + 1 } as never)
        .where(eq(schema.coupons.id, id));
    }
    return;
  }
  const row = ext().coupons.get(id);
  if (row) ext().coupons.set(id, { ...row, usageCount: row.usageCount + 1 });
}
