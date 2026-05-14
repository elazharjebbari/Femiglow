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

export function publicBaseUrl(req: Request): string {
  const headers = req.headers;
  const forwardedHost = headers.get('x-forwarded-host') ?? headers.get('host');
  const forwardedProto = headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  // Last resort : derive from req.url (dev mode).
  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:3000';
  }
}

export function redirectToPublic(
  req: Request,
  path: string,
  status: 303 | 302 | 301 = 303,
): NextResponse {
  const base = publicBaseUrl(req);
  return NextResponse.redirect(new URL(path, base), status);
}
