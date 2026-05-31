/**
 * Rate-limit helper for the emailing-related public endpoints.
 *
 * Wraps the shared lib/rate-limit/check.ts module with sane defaults per
 * endpoint, so each route handler is a 2-liner.
 *
 * Strategy : key = "<scope>:<ip>". 1-minute window for all (consistent
 * burst protection, returns Retry-After in seconds).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { logger } from '@/lib/logging/logger';

type Scope =
  | 'contact'
  | 'newsletter'
  | 'newsletter-confirm'
  | 'webhook-stalwart'
  | 'unsubscribe';

const LIMITS: Record<Scope, { limit: number; windowMs: number }> = {
  contact: { limit: 10, windowMs: 60_000 },
  newsletter: { limit: 5, windowMs: 60_000 },
  'newsletter-confirm': { limit: 30, windowMs: 60_000 },
  'webhook-stalwart': { limit: 600, windowMs: 60_000 },
  unsubscribe: { limit: 60, windowMs: 60_000 },
};

function extractIp(req: Request | NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Returns null if request is allowed, or a 429 NextResponse if blocked.
 */
export async function enforceMailRateLimit(
  scope: Scope,
  req: Request | NextRequest,
): Promise<NextResponse | null> {
  const ip = extractIp(req);
  const { limit, windowMs } = LIMITS[scope];
  const result = await checkRateLimit({ key: `mail:${scope}:${ip}`, limit, windowMs });
  if (result.ok) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  logger.warn('mail.rate_limit.blocked', { scope, ip, retryAfter });
  return new NextResponse('Too many requests', {
    status: 429,
    headers: { 'Retry-After': String(retryAfter) },
  });
}
