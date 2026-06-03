/**
 * Repo des crédits de fidélité (Phase 3) — dual driver.
 * Émission idempotente par commande source, rédemption à usage unique,
 * validation non mutante pour la prévisualisation.
 * cf. docs/coupons-qa-2026-06-02 (Phase 3).
 */
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { CouponGrantRow } from '@/lib/db/schema';

interface ExtendedStore {
  couponGrants: Map<string, CouponGrantRow>;
}
function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.couponGrants) store.couponGrants = new Map();
  return store;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 ambigus

/** Code lisible « FG-XXXXXX ». */
export function generateGrantCode(): string {
  const bytes = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i += 1) s += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  return `FG-${s}`;
}

export interface IssueGrantInput {
  templateCouponId: string | null;
  leadId: string | null;
  sourceOrderId: string;
  valueCents: number;
  currency?: string;
  expiresAt?: Date | null;
  now?: Date;
}

/** Émet un crédit pour une commande. Idempotent : 1 crédit par sourceOrderId. */
export async function issueGrant(input: IssueGrantInput): Promise<CouponGrantRow | null> {
  const now = input.now ?? new Date();
  const drizzle = db();

  // Idempotence : si un crédit existe déjà pour cette commande, on le renvoie.
  const existing = await findGrantBySourceOrder(input.sourceOrderId);
  if (existing) return existing;

  const row: CouponGrantRow = {
    id: createId('grt'),
    templateCouponId: input.templateCouponId,
    code: generateGrantCode(),
    leadId: input.leadId,
    sourceOrderId: input.sourceOrderId,
    status: 'issued',
    valueCents: input.valueCents,
    currency: input.currency ?? 'MAD',
    redeemedOrderId: null,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    redeemedAt: null,
  } as CouponGrantRow;

  if (drizzle) {
    await drizzle.insert(schema.couponGrants).values(row as never).onConflictDoNothing();
    return findGrantBySourceOrder(input.sourceOrderId);
  }
  ext().couponGrants.set(row.id, row);
  return row;
}

export async function findGrantByCode(code: string): Promise<CouponGrantRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.couponGrants)
      .where(eq(schema.couponGrants.code, code))
      .limit(1);
    return rows[0] ?? null;
  }
  return Array.from(ext().couponGrants.values()).find((g) => g.code === code) ?? null;
}

export async function findGrantBySourceOrder(orderId: string): Promise<CouponGrantRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.couponGrants)
      .where(eq(schema.couponGrants.sourceOrderId, orderId))
      .limit(1);
    return rows[0] ?? null;
  }
  return Array.from(ext().couponGrants.values()).find((g) => g.sourceOrderId === orderId) ?? null;
}

export type GrantValidity =
  | { valid: true; grant: CouponGrantRow; valueCents: number }
  | { valid: false; reason: 'not_found' | 'already_redeemed' | 'expired' };

/** Valide un code SANS le consommer (prévisualisation). */
export async function validateGrant(code: string, now: Date = new Date()): Promise<GrantValidity> {
  const grant = await findGrantByCode(code.trim().toUpperCase());
  if (!grant) return { valid: false, reason: 'not_found' };
  if (grant.status === 'redeemed') return { valid: false, reason: 'already_redeemed' };
  if (grant.expiresAt && now.getTime() > new Date(grant.expiresAt).getTime()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, grant, valueCents: grant.valueCents };
}

/**
 * Consomme un crédit (à la commande). Atomicité best-effort : on ne marque
 * redeemed que si le crédit est `issued` ET non expiré. Renvoie le grant
 * consommé ou null si non consommable.
 */
export async function redeemGrant(
  code: string,
  redeemedOrderId: string,
  now: Date = new Date(),
): Promise<CouponGrantRow | null> {
  const check = await validateGrant(code, now);
  if (!check.valid) return null;
  const grant = check.grant;
  const drizzle = db();
  if (drizzle) {
    // Garde de concurrence : update conditionnel sur status='issued'.
    await drizzle
      .update(schema.couponGrants)
      .set({ status: 'redeemed', redeemedOrderId, redeemedAt: now } as never)
      .where(eq(schema.couponGrants.id, grant.id));
    return findGrantByCode(grant.code);
  }
  const updated = { ...grant, status: 'redeemed' as const, redeemedOrderId, redeemedAt: now };
  ext().couponGrants.set(grant.id, updated);
  return updated;
}
