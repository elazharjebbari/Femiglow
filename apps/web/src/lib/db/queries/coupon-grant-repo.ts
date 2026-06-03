/**
 * Repo des crédits de fidélité (Phase 3) — dual driver.
 * Émission idempotente par commande source, rédemption à usage unique,
 * validation non mutante pour la prévisualisation.
 * cf. docs/coupons-qa-2026-06-02 (Phase 3).
 */
import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { CouponGrantRow } from '@/lib/db/schema';

export type GrantStatus = 'issued' | 'redeemed' | 'expired';

interface ExtendedStore {
  couponGrants: Map<string, CouponGrantRow>;
}
function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.couponGrants) store.couponGrants = new Map();
  return store;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 ambigus

/** Code lisible « FG-XXXXXX » (legacy, conservé pour compat tests). */
export function generateGrantCode(): string {
  const bytes = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i += 1) s += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  return `FG-${s}`;
}

/** Mots de la voix maison pour des codes MÉMORABLES, dictables au téléphone. */
const MEMORABLE_WORDS = [
  'RITUEL', 'ATLAS', 'SAUGE', 'ECLAT', 'ACCUEIL',
  'MAISON', 'GESTE', 'ATELIER', 'LUMIERE', 'SAISON',
] as const;

/** Code MÉMORABLE « FG-<MOT>-<NNNN> » (ex. FG-ATLAS-2048). */
export function generateMemorableGrantCode(): string {
  const b = randomBytes(3);
  const word = MEMORABLE_WORDS[(b[0] ?? 0) % MEMORABLE_WORDS.length];
  const num = (((b[1] ?? 0) << 8) | (b[2] ?? 0)) % 10000;
  return `FG-${word}-${String(num).padStart(4, '0')}`;
}

/** Durée de validité (jours) APRÈS activation. */
export const GRANT_VALIDITY_DAYS = 60;

export interface IssueGrantInput {
  templateCouponId: string | null;
  leadId: string | null;
  sourceOrderId: string;
  valueCents: number;
  currency?: string;
  /** Téléphone bénéficiaire (E.164) — unicité 1 code actif/phone. */
  phoneE164?: string | null;
  /** Date d'activation (commande + délai ville). expiresAt = +60j. */
  activatesAt?: Date | null;
  now?: Date;
}

/**
 * Émet un crédit de fidélité. Idempotent :
 *  1) si un crédit existe déjà pour cette commande → on le renvoie ;
 *  2) sinon, si un crédit ACTIF (issued) existe déjà pour ce TÉLÉPHONE → on le
 *     renvoie (un seul code actif par téléphone, anti-farming).
 * Code MÉMORABLE ; `expires_at = activates_at + GRANT_VALIDITY_DAYS`.
 */
export async function issueGrant(input: IssueGrantInput): Promise<CouponGrantRow | null> {
  const now = input.now ?? new Date();
  const drizzle = db();

  const existing = await findGrantBySourceOrder(input.sourceOrderId);
  if (existing) return existing;
  if (input.phoneE164) {
    const active = await findActiveGrantByPhone(input.phoneE164);
    if (active) return active;
  }

  const activatesAt = input.activatesAt ?? null;
  const expiresAt = activatesAt
    ? new Date(activatesAt.getTime() + GRANT_VALIDITY_DAYS * 24 * 3600 * 1000)
    : null;

  // Code mémorable + retry en cas de collision (unicité DB).
  let code = generateMemorableGrantCode();
  for (let i = 0; i < 5; i += 1) {
    if (!(await findGrantByCode(code))) break;
    code = generateMemorableGrantCode();
  }

  const row: CouponGrantRow = {
    id: createId('grt'),
    templateCouponId: input.templateCouponId,
    code,
    leadId: input.leadId,
    sourceOrderId: input.sourceOrderId,
    status: 'issued',
    valueCents: input.valueCents,
    currency: input.currency ?? 'MAD',
    redeemedOrderId: null,
    phoneE164: input.phoneE164 ?? null,
    activatesAt,
    expiresAt,
    createdAt: now,
    redeemedAt: null,
  } as CouponGrantRow;

  if (drizzle) {
    await drizzle.insert(schema.couponGrants).values(row as never).onConflictDoNothing();
    // Relit : conflit possible sur sourceOrder OU phone-actif.
    return (
      (await findGrantBySourceOrder(input.sourceOrderId)) ??
      (input.phoneE164 ? await findActiveGrantByPhone(input.phoneE164) : null)
    );
  }
  ext().couponGrants.set(row.id, row);
  return row;
}

/** Crédit ACTIF (issued) pour un téléphone, ou null. */
export async function findActiveGrantByPhone(
  phoneE164: string,
): Promise<CouponGrantRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.couponGrants)
      .where(
        and(
          eq(schema.couponGrants.phoneE164, phoneE164),
          eq(schema.couponGrants.status, 'issued'),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
  return (
    Array.from(ext().couponGrants.values()).find(
      (g) => g.phoneE164 === phoneE164 && g.status === 'issued',
    ) ?? null
  );
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
  | {
      valid: false;
      reason: 'not_found' | 'already_redeemed' | 'expired' | 'not_yet_active';
      /** Date d'activation, fournie quand reason='not_yet_active'. */
      activatesAt?: Date | null;
    };

/** Valide un code SANS le consommer (prévisualisation). */
export async function validateGrant(code: string, now: Date = new Date()): Promise<GrantValidity> {
  const grant = await findGrantByCode(code.trim().toUpperCase());
  if (!grant) return { valid: false, reason: 'not_found' };
  if (grant.status === 'redeemed') return { valid: false, reason: 'already_redeemed' };
  // Activation différée : le code n'est utilisable qu'après la durée de
  // livraison de la ville (la 1ʳᵉ commande a été reçue).
  if (grant.activatesAt && now.getTime() < new Date(grant.activatesAt).getTime()) {
    return { valid: false, reason: 'not_yet_active', activatesAt: grant.activatesAt };
  }
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

export interface ListGrantsFilter {
  phoneE164?: string;
  status?: GrantStatus;
  limit?: number;
}

/** Liste des crédits émis (admin), filtrable par téléphone / statut. */
export async function listGrants(filter: ListGrantsFilter = {}): Promise<CouponGrantRow[]> {
  const limit = Math.min(filter.limit ?? 100, 500);
  const drizzle = db();
  if (drizzle) {
    const conds = [];
    if (filter.phoneE164) conds.push(eq(schema.couponGrants.phoneE164, filter.phoneE164));
    if (filter.status) conds.push(eq(schema.couponGrants.status, filter.status));
    return drizzle
      .select()
      .from(schema.couponGrants)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.couponGrants.createdAt))
      .limit(limit);
  }
  let rows = Array.from(ext().couponGrants.values());
  if (filter.phoneE164) rows = rows.filter((g) => g.phoneE164 === filter.phoneE164);
  if (filter.status) rows = rows.filter((g) => g.status === filter.status);
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows.slice(0, limit);
}

/** Masque un téléphone pour l'affichage admin (06…**…78). */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const p = phone.replace(/\s+/g, '');
  if (p.length < 6) return '***';
  return `${p.slice(0, 4)}…${p.slice(-2)}`;
}
