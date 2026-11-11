/**
 * Limite de débit des routes publiques du tunnel de commande.
 *
 * Avant (audit /kit du 10/11/2026) : seule `/api/checkout/lead/sync` était
 * limitée. Un script pouvait créer des fiches à volonté (une carte Trello
 * 15 min plus tard pour chacune), passer des commandes ou énumérer les codes
 * de fidélité.
 *
 * Choix :
 *  - clé = scope + IP hachée. Les plafonds sont larges, car les opérateurs
 *    mobiles marocains partagent des IP (CGNAT) : une vraie cliente ne fait
 *    que quelques appels par étape.
 *  - IP inconnue, de bouclage ou privée (cf. `isUnroutableIp`) : on NE limite PAS. Sans
 *    IP, tout le trafic tomberait dans le même compteur et le site entier
 *    serait bloqué au premier pic.
 *  - compteur en mémoire du processus (`checkRateLimit`) : suffisant pour le
 *    serveur unique de prod ; à déplacer sur Redis si plusieurs processus.
 *  - IP : la DERNIÈRE entrée de `x-forwarded-for`, ajoutée par notre proxy
 *    LiteSpeed et que le client ne peut pas forger (la première est fournie
 *    par le client et permettait de contourner la limite), sinon `x-real-ip`.
 *    Pas de `cf-connecting-ip` : la prod n'est pas derrière Cloudflare, cet
 *    en-tête serait donc fourni par le client.
 *  - `CHECKOUT_RATE_LIMIT_OFF=1` coupe la limite (tests de bout en bout en
 *    local, où tout vient de 127.0.0.1 ; ou urgence en prod).
 */
import { NextResponse } from 'next/server';

import { hashIp } from '@/lib/http/client-ip';
import { checkRateLimit } from '@/lib/rate-limit/check';

const WINDOW_MS = 10 * 60 * 1000;

/** Appels autorisés par IP et par fenêtre de 10 minutes. */
export const CHECKOUT_RATE_LIMITS = {
  lead_create: 30,
  address_update: 60,
  address_draft: 200,
  payment_select: 60,
  order_create: 20,
  email_optin: 20,
  coupon_redeem: 30,
  stock_notify: 10,
} as const;

export type CheckoutRateScope = keyof typeof CHECKOUT_RATE_LIMITS;

/** IP de la cliente vue par notre proxy (cf. en-tête du module). */
export function trustedClientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  const real = req.headers.get('x-real-ip')?.trim();
  return real || null;
}

/**
 * Adresse inconnue, de bouclage ou privée : c'est celle du proxy, pas de la
 * cliente. Si LiteSpeed ne transmettait pas l'IP, Next poserait 127.0.0.1 pour
 * tout le monde : un compteur unique bloquerait le site entier en campagne.
 */
export function isUnroutableIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, '');
  return (
    v === '0.0.0.0' ||
    v === '::1' ||
    v === 'unknown' ||
    /^127\./.test(v) ||
    /^10\./.test(v) ||
    /^192\.168\./.test(v) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v) ||
    /^169\.254\./.test(v) ||
    /^f[cd][0-9a-f]{2}:/.test(v) ||
    /^fe80:/.test(v)
  );
}

/**
 * Renvoie une réponse 429 si la limite est atteinte, sinon `null` (la route
 * continue). À appeler en tête de route, avant toute lecture en base.
 */
export async function checkoutRateLimit(
  req: Request,
  scope: CheckoutRateScope,
  now: number = Date.now(),
): Promise<NextResponse | null> {
  if (process.env.CHECKOUT_RATE_LIMIT_OFF === '1') return null;
  const ip = trustedClientIp(req);
  if (!ip || isUnroutableIp(ip)) return null;
  const rl = await checkRateLimit({
    key: `checkout:${scope}:${hashIp(ip)}`,
    limit: CHECKOUT_RATE_LIMITS[scope],
    windowMs: WINDOW_MS,
    now,
  });
  if (rl.ok) return null;
  const retryAfter = Math.max(1, Math.ceil((rl.resetAt - now) / 1000));
  return NextResponse.json(
    {
      error: {
        code: 'rate_limited',
        message: 'Trop de tentatives. Réessayez dans quelques minutes.',
      },
    },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
