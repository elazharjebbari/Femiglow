import { createHmac, timingSafeEqual } from 'node:crypto';

export function signHmac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64');
}

export function verifyHmac(secret: string, payload: string, signature: string): boolean {
  const expected = signHmac(secret, payload);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
