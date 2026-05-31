import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Tokens HMAC pour le lien d'e-mail J+45.
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 7
 *    docs/reviews-wall/08-architecture-data.md § 9
 */

export interface EmailTokenPayload {
  orderId: string;
  customerHash: string;
  issuedAt: number;
  expiresAt: number;
}

function getSecret(): string {
  const s = process.env.RITUAL_EMAIL_SECRET;
  if (!s) throw new Error('RITUAL_EMAIL_SECRET non configuré');
  return s;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function generateEmailToken(payload: EmailTokenPayload): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

export function decodeEmailToken(token: string): EmailTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Token mal formé');
  const [body, sig] = parts;
  if (!body || !sig) throw new Error('Token mal formé');

  const expected = createHmac('sha256', getSecret()).update(body).digest();
  let provided: Buffer;
  try {
    provided = base64UrlDecode(sig);
  } catch {
    throw new Error('Token signature invalide');
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error('Token signature invalide');
  }

  let payload: EmailTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body).toString('utf8'));
  } catch {
    throw new Error('Token payload invalide');
  }

  if (
    typeof payload.orderId !== 'string' ||
    typeof payload.customerHash !== 'string' ||
    typeof payload.issuedAt !== 'number' ||
    typeof payload.expiresAt !== 'number'
  ) {
    throw new Error('Token payload incomplet');
  }

  if (payload.expiresAt < Date.now()) {
    throw new Error('Token expiré');
  }

  return payload;
}
