/**
 * Helper CSRF — defense-in-depth contre les requêtes cross-site sur les
 * routes admin. SameSite=Lax (cf. session.ts) bloque déjà la majorité,
 * mais cette vérification couvre les cas tordus :
 *  - <form method="POST"> top-level (Lax laisse passer)
 *  - clients HTTP custom qui ne respectent pas Lax
 *
 * Stratégie : si la requête a un body (POST/PUT/PATCH/DELETE), on vérifie
 * que `Origin` ou `Referer` matche `NEXT_PUBLIC_SITE_URL`. Sinon 403.
 *
 * Cas particuliers :
 *  - Pas de header Origin/Referer : on REJETTE par défaut (un browser
 *    moderne envoie au moins l'un des deux sur cross-origin mutations).
 *  - Origin = null (sandbox, certaines redirects) : accepté seulement si
 *    Referer matche.
 */
import { env } from '@/lib/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfCheckResult {
  ok: boolean;
  reason?: 'missing_origin' | 'origin_mismatch';
}

export function checkSameOrigin(request: Request): CsrfCheckResult {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return { ok: true };
  }

  const expected = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!expected) {
    // En dev (pas de NEXT_PUBLIC_SITE_URL), on laisse passer plutôt que
    // bloquer toutes les mutations.
    return { ok: true };
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (!origin && !referer) {
    return { ok: false, reason: 'missing_origin' };
  }

  // Origin a priorité (plus précis, ne contient pas le path).
  if (origin && origin !== 'null') {
    if (origin === expected) return { ok: true };
    return { ok: false, reason: 'origin_mismatch' };
  }

  // Fallback Referer : on compare le prefix (host + scheme).
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const refOrigin = `${refUrl.protocol}//${refUrl.host}`;
      if (refOrigin === expected) return { ok: true };
    } catch {
      // Referer malformé
    }
  }

  return { ok: false, reason: 'origin_mismatch' };
}

import { HttpError } from '@/lib/errors/http-error';

/**
 * Variante throw : lance HttpError('forbidden') si la vérif échoue.
 * À placer en début de handler admin mutation.
 */
export function requireSameOrigin(request: Request): void {
  const r = checkSameOrigin(request);
  if (!r.ok) {
    throw new HttpError('forbidden', `CSRF check failed: ${r.reason ?? 'unknown'}`);
  }
}
