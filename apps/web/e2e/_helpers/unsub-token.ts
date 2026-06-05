/**
 * unsub-token (e2e) — génère un token de désinscription one-click signé
 * IDENTIQUE à `src/lib/mail/unsub-token.ts` (HMAC-SHA256, RFC 8058).
 *
 * On réimplémente la signature côté spec (process Playwright) pour produire un
 * token RÉEL que la route `/api/mail/unsubscribe?t=` du serveur e2e vérifiera —
 * sans importer le module applicatif `server-only`. Le secret est lu depuis
 * `MAIL_UNSUB_TOKEN_SECRET` (.env, chargé par playwright.config.ts). Il n'est
 * JAMAIS journalisé ni renvoyé en clair.
 *
 * Format (cf. lib) : base64url(hmac).base64url(`${email}|${exp}`), exp = +90j.
 */
import { createHmac } from 'node:crypto';

const VALIDITY_SECONDS = 90 * 24 * 60 * 60;

function base64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Renvoie le secret HMAC (jette si absent — la spec doit alors échouer net). */
function secret(): string {
  const s = process.env.MAIL_UNSUB_TOKEN_SECRET;
  if (!s) {
    throw new Error(
      'MAIL_UNSUB_TOKEN_SECRET absent — requis pour signer un token e2e (cf. .env).',
    );
  }
  return s;
}

/** Génère un token signé valide pour `email` (exp +90j par défaut). */
export function generateUnsubTokenE2e(email: string, now: number = Date.now()): string {
  const exp = Math.floor(now / 1000) + VALIDITY_SECONDS;
  const payload = `${email.toLowerCase().trim()}|${exp}`;
  const sig = createHmac('sha256', secret()).update(payload).digest();
  return `${base64url(sig)}.${base64url(Buffer.from(payload))}`;
}
