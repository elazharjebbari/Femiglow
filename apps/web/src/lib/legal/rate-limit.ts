/**
 * Helpers de rate-limiting pour le module legal.
 *
 * Stratégie : per-IP pour les routes publiques (anonymes), per-adminId
 * pour les routes admin authentifiées. On utilise `checkRateLimit` qui
 * stocke dans le memoryStore (suffisant pour single-instance ; en
 * multi-instance Vercel il faudra passer sur Redis — out of scope V1).
 */
import { NextResponse } from 'next/server';

import { checkRateLimit } from '@/lib/rate-limit/check';

export interface LegalRateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface LegalRateLimitResult {
  ok: true;
  headers: Record<string, string>;
}

export type LegalRateLimitOutcome =
  | LegalRateLimitResult
  | { ok: false; response: Response };

const DEFAULT_HEADERS = (remaining: number, resetAt: number, limit: number): Record<string, string> => ({
  'X-RateLimit-Limit': String(limit),
  'X-RateLimit-Remaining': String(Math.max(0, remaining)),
  'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
});

export function extractClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/**
 * Vérifie la limite et renvoie soit `{ ok: true, headers }` à attacher à
 * la réponse, soit `{ ok: false, response }` qui est une 429 prête à
 * renvoyer.
 */
export async function enforceLegalRateLimit(
  scope: string,
  identityKey: string,
  opts: LegalRateLimitOptions,
): Promise<LegalRateLimitOutcome> {
  const key = `legal:${scope}:${identityKey}`;
  const result = await checkRateLimit({
    key,
    limit: opts.limit,
    windowMs: opts.windowMs,
  });

  if (!result.ok) {
    const headers = {
      ...DEFAULT_HEADERS(result.remaining, result.resetAt, opts.limit),
      'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
    };
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Trop de requêtes — réessaye dans quelques secondes.',
          },
        },
        { status: 429, headers },
      ),
    };
  }

  return {
    ok: true,
    headers: DEFAULT_HEADERS(result.remaining, result.resetAt, opts.limit),
  };
}

/** Per-IP : routes publiques /api/legal/[slug] et /api/legal/placements/[zone]. */
export const PUBLIC_LIMITS: LegalRateLimitOptions = { limit: 60, windowMs: 60_000 };

/** Per-admin : publish (action lourde, transaction + history insert). */
export const PUBLISH_LIMITS: LegalRateLimitOptions = { limit: 5, windowMs: 60_000 };

/** Per-admin : health recheck (HTTP fan-out lourd). */
export const HEALTH_RECHECK_LIMITS: LegalRateLimitOptions = { limit: 1, windowMs: 60_000 };
