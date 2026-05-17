/**
 * CHA-240 — Identity hash for lead dedup.
 *
 * Computes a stable SHA-256 hash from phone + first name so that
 * the same session can have multiple leads with different identities,
 * while blocking true duplicates (same phone + same name).
 *
 * Normalization:
 *  - phone_e164: already normalized to E.164, just trimmed
 *  - first_name: trimmed + lowercased so "Ahmed" ≡ "ahmed"
 *
 * The pipe separator prevents ambiguity between adjacent fields.
 */
import { createHash } from 'node:crypto';

export function computeIdentityHash(phoneE164: string, firstName: string): string {
  const normalizedPhone = phoneE164.trim();
  const normalizedName = firstName.trim().toLowerCase();
  const raw = `${normalizedPhone}|${normalizedName}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}