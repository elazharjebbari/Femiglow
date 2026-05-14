/**
 * One-click List-Unsubscribe token (RFC 8058).
 *
 * Format : base64url( hmac_sha256(secret, email + '|' + exp_ts) ).email.exp
 * The token expires after 90 days by default.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

const VALIDITY_SECONDS = 90 * 24 * 60 * 60;

function getSecret(): string {
  const secret = env.MAIL_UNSUB_TOKEN_SECRET;
  if (!secret) {
    throw new Error('MAIL_UNSUB_TOKEN_SECRET not configured');
  }
  return secret;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function generateUnsubToken(email: string, now: number = Date.now()): string {
  const exp = Math.floor(now / 1000) + VALIDITY_SECONDS;
  const payload = `${email.toLowerCase().trim()}|${exp}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest();
  return `${base64url(sig)}.${base64url(Buffer.from(payload))}`;
}

export function verifyUnsubToken(token: string, now: number = Date.now()): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const sigB64 = parts[0]!;
  const payloadB64 = parts[1]!;
  let payload: string;
  try {
    payload = fromBase64url(payloadB64).toString('utf8');
  } catch {
    return null;
  }
  const sep = payload.lastIndexOf('|');
  if (sep < 1) return null;
  const email = payload.slice(0, sep);
  const expStr = payload.slice(sep + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return null;
  if (Math.floor(now / 1000) > exp) return null;

  const expectedSig = createHmac('sha256', getSecret()).update(payload).digest();
  let providedSig: Buffer;
  try {
    providedSig = fromBase64url(sigB64);
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;
  return email;
}

export function unsubscribeUrl(email: string, baseUrl: string): string {
  const token = generateUnsubToken(email);
  return `${baseUrl}/api/mail/unsubscribe?t=${encodeURIComponent(token)}`;
}
