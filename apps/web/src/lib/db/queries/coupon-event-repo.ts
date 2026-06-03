/**
 * Repo des événements coupon — journal append-only pour l'incrémentalité.
 *
 * Idempotence : au plus UN événement `converted` par `orderId`
 * (contrainte unique partielle en DB ; check applicatif en mémoire).
 * Émission best-effort : l'appelant ne doit jamais bloquer la commande
 * si l'insert échoue.
 *
 * cf. docs/coupons-qa-2026-06-02/09-coupon-events-logging/.
 */
import { and, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { CouponEventRow } from '@/lib/db/schema';
import type { CouponBucket, CouponEventPhase } from '@/lib/coupons/types';

interface ExtendedStore {
  couponEvents: Map<string, CouponEventRow>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.couponEvents) store.couponEvents = new Map();
  return store;
}

export interface RecordEventInput {
  couponId: string | null;
  phase: CouponEventPhase;
  bucket: CouponBucket;
  visitorKey?: string | null;
  orderId?: string | null;
  amountCents?: number | null;
  trafficSource?: string | null;
  device?: string | null;
  now?: Date;
}

/**
 * Enregistre un événement. Pour `converted`, garantit l'unicité par
 * `orderId` (renvoie `false` si un converted existe déjà pour cet order).
 * Renvoie `true` si l'événement a été inséré.
 */
export async function recordCouponEvent(input: RecordEventInput): Promise<boolean> {
  const now = input.now ?? new Date();
  const id = createId('cev');
  const row: CouponEventRow = {
    id,
    couponId: input.couponId ?? null,
    phase: input.phase,
    bucket: input.bucket,
    visitorKey: input.visitorKey ?? null,
    orderId: input.orderId ?? null,
    amountCents: input.amountCents ?? null,
    trafficSource: input.trafficSource ?? null,
    device: input.device ?? null,
    createdAt: now,
  } as CouponEventRow;

  const drizzle = db();
  if (drizzle) {
    if (input.phase === 'converted' && input.orderId) {
      // Pré-check + ON CONFLICT DO NOTHING (double garde sur l'index partiel
      // converted/(orderId,couponId)). Le `.returning()` est évité car le type
      // DrizzleDb est une union neon/postgres-js aux signatures divergentes.
      if (await hasConvertedForOrder(input.orderId, input.couponId ?? null)) return false;
      await drizzle.insert(schema.couponEvents).values(row as never).onConflictDoNothing();
      return true;
    }
    await drizzle.insert(schema.couponEvents).values(row as never);
    return true;
  }

  // memoryStore : check d'unicité applicatif pour converted (par order+coupon).
  if (input.phase === 'converted' && input.orderId) {
    const exists = Array.from(ext().couponEvents.values()).some(
      (e) =>
        e.phase === 'converted' &&
        e.orderId === input.orderId &&
        e.couponId === (input.couponId ?? null),
    );
    if (exists) return false;
  }
  ext().couponEvents.set(id, row);
  return true;
}

export interface PhaseBucketCount {
  phase: CouponEventPhase;
  bucket: CouponBucket;
  count: number;
}

/** Agrégat exposed/applied/converted × treatment/holdout pour un coupon. */
export async function countByPhaseAndBucket(couponId: string): Promise<PhaseBucketCount[]> {
  const drizzle = db();
  const acc = new Map<string, number>();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.couponEvents)
      .where(eq(schema.couponEvents.couponId, couponId));
    for (const r of rows) acc.set(`${r.phase}:${r.bucket}`, (acc.get(`${r.phase}:${r.bucket}`) ?? 0) + 1);
  } else {
    for (const r of ext().couponEvents.values()) {
      if (r.couponId !== couponId) continue;
      acc.set(`${r.phase}:${r.bucket}`, (acc.get(`${r.phase}:${r.bucket}`) ?? 0) + 1);
    }
  }
  return Array.from(acc.entries()).map(([k, count]) => {
    const [phase, bucket] = k.split(':') as [CouponEventPhase, CouponBucket];
    return { phase, bucket, count };
  });
}

/**
 * Renvoie le bucket de la dernière exposition `rescue` pour un visiteur, ou
 * `null` s'il n'a pas été exposé. Sert à lier `converted ⊆ exposed` (mesure
 * d'incrémentalité cohérente). Joint `coupon_events` → `coupons` (type=rescue).
 */
export async function getRescueExposureBucket(
  visitorKey: string,
): Promise<CouponBucket | null> {
  if (!visitorKey) return null;
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({ bucket: schema.couponEvents.bucket })
      .from(schema.couponEvents)
      .innerJoin(schema.coupons, eq(schema.couponEvents.couponId, schema.coupons.id))
      .where(
        and(
          eq(schema.couponEvents.visitorKey, visitorKey),
          eq(schema.couponEvents.phase, 'exposed'),
          eq(schema.coupons.type, 'rescue'),
        ),
      )
      .orderBy(schema.couponEvents.createdAt)
      .limit(1);
    return rows[0]?.bucket ?? null;
  }
  // memoryStore : on lit aussi la map coupons (même store global).
  const store = memoryStore() as unknown as {
    couponEvents?: Map<string, CouponEventRow>;
    coupons?: Map<string, { id: string; type: string }>;
  };
  const events = store.couponEvents ? Array.from(store.couponEvents.values()) : [];
  const coupons = store.coupons ?? new Map();
  const match = events
    .filter(
      (e) =>
        e.visitorKey === visitorKey &&
        e.phase === 'exposed' &&
        coupons.get(e.couponId ?? '')?.type === 'rescue',
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  return match ? match.bucket : null;
}

/**
 * Existe-t-il déjà un converted pour cet order (optionnellement pour un coupon
 * donné) ? Si `couponId` fourni, l'unicité est par (order, coupon).
 */
export async function hasConvertedForOrder(
  orderId: string,
  couponId: string | null = null,
): Promise<boolean> {
  const drizzle = db();
  if (drizzle) {
    const conds = [
      eq(schema.couponEvents.orderId, orderId),
      eq(schema.couponEvents.phase, 'converted'),
    ];
    if (couponId) conds.push(eq(schema.couponEvents.couponId, couponId));
    const rows = await drizzle
      .select({ id: schema.couponEvents.id })
      .from(schema.couponEvents)
      .where(and(...conds))
      .limit(1);
    return rows.length > 0;
  }
  return Array.from(ext().couponEvents.values()).some(
    (e) =>
      e.phase === 'converted' &&
      e.orderId === orderId &&
      (couponId === null || e.couponId === couponId),
  );
}
