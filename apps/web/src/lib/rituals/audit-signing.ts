import { createHash, createHmac } from 'crypto';
import type { RitualAuditEntry } from '@/lib/db/types';

/**
 * Signature cryptographique en chaîne pour `ritual_audit_log`.
 *
 * Chaque entrée stocke :
 *  - `previousHash` : SHA-256(JSON canonique de l'entrée précédente + sa signature)
 *  - `signature` : HMAC-SHA256(secret, previousHash || JSON canonique de l'entrée)
 *
 * Toute modification a posteriori (édition d'une note, suppression, etc.)
 * casse la chaîne au point modifié et est détectable par `verifyChain`.
 *
 * Le secret est lu depuis `RITUAL_AUDIT_SECRET` (Vercel Secrets / KMS).
 * Absence de secret = mode non-signé (utile en dev/test).
 *
 * Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P3.4
 */

export interface SignableEntry {
  id: string;
  testimonialId: string | null;
  actorId: string | null;
  action: string;
  note: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Représentation canonique JSON triée par clé, pour un hash reproductible.
 */
function canonicalize(entry: SignableEntry): string {
  return JSON.stringify({
    action: entry.action,
    actorId: entry.actorId,
    createdAt: entry.createdAt.toISOString(),
    id: entry.id,
    note: entry.note,
    payload: sortObject(entry.payload),
    testimonialId: entry.testimonialId,
  });
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortObject((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function hashEntry(entry: SignableEntry, signature: string | null): string {
  return createHash('sha256')
    .update(`${canonicalize(entry)}|${signature ?? ''}`)
    .digest('hex');
}

export function getAuditSecret(): string | null {
  const s = process.env.RITUAL_AUDIT_SECRET;
  return s && s.length >= 16 ? s : null;
}

/**
 * Calcule le hash de chaînage à utiliser pour signer l'entrée suivante,
 * à partir de l'entrée précédente effectivement persistée.
 */
export function chainPreviousHash(previous: RitualAuditEntry | null): string | null {
  if (!previous) return null;
  return hashEntry(previous, previous.signature);
}

/**
 * Calcule previousHash + signature pour l'entrée courante à partir de
 * l'entrée précédente persistée. Si aucun secret n'est configuré,
 * `signature` reste `null` (mode dev), mais `previousHash` est calculé
 * et la chaîne reste vérifiable structurellement.
 */
export function signWithPrevious(
  entry: SignableEntry,
  previous: RitualAuditEntry | null,
): { previousHash: string | null; signature: string | null } {
  const previousHash = chainPreviousHash(previous);
  const secret = getAuditSecret();
  if (!secret) return { previousHash, signature: null };
  const signature = createHmac('sha256', secret)
    .update(`${previousHash ?? ''}|${canonicalize(entry)}`)
    .digest('hex');
  return { previousHash, signature };
}

export interface ChainVerificationResult {
  valid: boolean;
  /** ID de la première entrée brisée, le cas échéant. */
  brokenAt: string | null;
  /** Raison de la cassure. */
  reason: string | null;
  /** Nombre d'entrées vérifiées. */
  checked: number;
}

/**
 * Vérifie l'intégrité d'une chaîne d'audit en l'état où elle est lue.
 * Entrées doivent être triées chronologiquement (createdAt asc).
 */
export function verifyChain(entries: RitualAuditEntry[]): ChainVerificationResult {
  const secret = getAuditSecret();
  let previous: RitualAuditEntry | null = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const expectedPrevHash = chainPreviousHash(previous);
    if ((e.previousHash ?? null) !== (expectedPrevHash ?? null)) {
      return {
        valid: false,
        brokenAt: e.id,
        reason: 'previousHash mismatch',
        checked: i,
      };
    }
    if (secret) {
      const expectedSig = createHmac('sha256', secret)
        .update(`${expectedPrevHash ?? ''}|${canonicalize(e)}`)
        .digest('hex');
      if (e.signature !== expectedSig) {
        return {
          valid: false,
          brokenAt: e.id,
          reason: 'signature mismatch',
          checked: i,
        };
      }
    }
    previous = e;
  }
  return { valid: true, brokenAt: null, reason: null, checked: entries.length };
}
