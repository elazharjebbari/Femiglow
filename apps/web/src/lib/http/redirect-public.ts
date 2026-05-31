/**
 * Redirect helpers qui respectent le reverse-proxy (LiteSpeed → next-server
 * tournant sur 127.0.0.1:8011).
 *
 * `req.url` côté Next contient l'URL interne (`http://127.0.0.1:8011/...`).
 * Construire `new URL(path, req.url)` envoie donc une Location header avec
 * `http://localhost` — le navigateur la suit littéralement et se retrouve
 * sur localhost (chez l'utilisateur final → erreur connexion refusée).
 *
 * Fix : composer l'URL externe à partir de `X-Forwarded-Host` +
 * `X-Forwarded-Proto` (envoyés par LiteSpeed). Fallback gracieux sur la
 * valeur de `req.url` si les headers sont absents (mode dev local).
 */
import { NextResponse } from 'next/server';

/**
 * Compose l'URL externe à partir des headers reverse-proxy.
 *
 * Priorité :
 *   1. PUBLIC_BASE_URL env var (override absolue, pour les cas tricky)
 *   2. X-Forwarded-Host + X-Forwarded-Proto (LiteSpeed standard)
 *   3. Host header s'il ne pointe pas vers localhost/127.0.0.1
 *   4. Fallback req.url (dev mode local)
 *
 * Les hosts internes `localhost:*` / `127.0.0.1:*` / `0.0.0.0:*` sont
 * **explicitement rejetés** : on préfère retomber sur req.url plutôt que
 * de générer une Location qui pointe le navigateur de l'utilisateur final
 * sur sa propre machine.
 */
const INTERNAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:\d+)?$/i;

export function publicBaseUrl(req: Request): string {
  const envOverride = process.env.PUBLIC_BASE_URL;
  if (envOverride) return envOverride.replace(/\/$/, '');

  const h = req.headers;
  const xfHost = h.get('x-forwarded-host');
  const xfProto = h.get('x-forwarded-proto');
  if (xfHost && !INTERNAL_HOST_RE.test(xfHost)) {
    return `${xfProto ?? 'https'}://${xfHost}`;
  }
  const hostHeader = h.get('host');
  if (hostHeader && !INTERNAL_HOST_RE.test(hostHeader)) {
    return `${xfProto ?? 'https'}://${hostHeader}`;
  }
  // Last resort : derive from req.url (only safe in dev).
  try {
    const url = new URL(req.url);
    if (!INTERNAL_HOST_RE.test(url.host)) {
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    /* noop */
  }
  // Absolute fallback : never pretend it's localhost in production.
  return process.env.NODE_ENV === 'production'
    ? 'https://femiglow-maroc.com'
    : 'http://localhost:3000';
}

export function redirectToPublic(
  req: Request,
  path: string,
  status: 303 | 302 | 301 = 303,
): NextResponse {
  const base = publicBaseUrl(req);
  return NextResponse.redirect(new URL(path, base), status);
}
