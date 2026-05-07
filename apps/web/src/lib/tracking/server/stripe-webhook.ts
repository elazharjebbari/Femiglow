/**
 * Vérification HMAC SHA256 d'une signature Stripe au format `t=…,v1=…`.
 * Implémentation locale pour éviter d'introduire la dépendance `stripe` SDK
 * juste pour le check signature.
 *
 * cf. https://stripe.com/docs/webhooks/signatures (Verifying signatures
 * manually).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StripeSignatureParts {
  timestamp: number;
  v1Signatures: string[];
}

export function parseStripeSignature(header: string): StripeSignatureParts | null {
  const parts = header.split(',').map((p) => p.trim());
  let timestamp: number | null = null;
  const sigs: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (!k || !v) continue;
    if (k === 't') timestamp = Number(v);
    if (k === 'v1') sigs.push(v);
  }
  if (timestamp === null || Number.isNaN(timestamp) || sigs.length === 0) return null;
  return { timestamp, v1Signatures: sigs };
}

/**
 * Vérifie la signature Stripe d'un payload raw + signature header.
 * Throw si invalide. Le seuil de tolérance par défaut est 5 minutes.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
  now: Date = new Date(),
): void {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) throw new Error('Stripe signature header malformed');
  const ageSeconds = Math.floor(now.getTime() / 1000) - parsed.timestamp;
  if (ageSeconds > toleranceSeconds) {
    throw new Error('Stripe signature timestamp outside tolerance window');
  }
  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  let matched = false;
  for (const v1 of parsed.v1Signatures) {
    let candidate: Buffer;
    try {
      candidate = Buffer.from(v1, 'hex');
    } catch {
      continue;
    }
    if (candidate.length !== expectedBuf.length) continue;
    if (timingSafeEqual(candidate, expectedBuf)) {
      matched = true;
      break;
    }
  }
  if (!matched) throw new Error('Stripe signature mismatch');
}
