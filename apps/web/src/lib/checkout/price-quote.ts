/**
 * Devis de prix signé — le prix affiché dans le formulaire est celui facturé.
 *
 * Problème corrigé (audit /kit du 10/11/2026) : le panier du formulaire
 * était calculé au rendu de la page, et la commande repricée par le moteur de
 * coupons avec un AUTRE contexte (referer = page /kit au lieu de la pub,
 * session parfois absente au premier rendu). Un coupon automatique actif sur
 * le prix pouvait donc donner deux montants différents : 422 `price_mismatch`
 * sur la commande, alors que la cliente n'avait rien fait de mal.
 *
 * Solution : le serveur signe (HMAC) le prix unitaire qu'il affiche, avec une
 * durée de validité. La commande facture le prix signé s'il est valide pour ce
 * SKU et cette devise, si les prix catalogue n'ont pas bougé depuis et si le
 * coupon signé est toujours actif ; sinon elle reprice comme avant. Le client
 * ne peut pas forger un prix : sans le secret, la signature ne vérifie pas.
 *
 * Secret : `PRICE_QUOTE_SECRET` (au moins 32 caractères), dédié, sans repli
 * sur d'autres secrets (partagés avec des services tiers). Absent → aucun
 * devis émis ni accepté, la commande reprice comme avant.
 *
 * Module serveur uniquement (secret).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { ResolvedCouponRef } from '@/lib/coupons/types';

/**
 * Durée de validité d'un devis : 6 h. Le panier est re-signé à chaque
 * chargement de /kit ; une erreur de prix corrigée en admin cesse d'être
 * honorée au plus 6 h après.
 */
export const PRICE_QUOTE_TTL_MS = 6 * 60 * 60 * 1000;

export interface PriceQuote {
  v: 1;
  sku: string;
  /** Prix unitaire facturé, en centimes. */
  unit: number;
  cur: string;
  /** Économie unitaire due au coupon (centimes), pour la journalisation. */
  save: number;
  /** Coupon résolu à l'affichage (traçage d'incrémentalité), ou null. */
  cpn: ResolvedCouponRef | null;
  /** Prix catalogue de la variante au moment du devis (centimes). */
  base: number;
  /** Prix promo de la variante au moment du devis (centimes), ou null. */
  promo: number | null;
  /** Expiration, en millisecondes epoch. */
  exp: number;
}

/**
 * Clé HMAC dérivée de `PRICE_QUOTE_SECRET`. `null` si absent : le devis est
 * désactivé et la commande reprice comme avant, sans casser.
 */
function signingKey(): Buffer | null {
  const secret = process.env.PRICE_QUOTE_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac('sha256', secret).update('femiglow:price-quote:v1').digest();
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function mac(key: Buffer, payload: string): Buffer {
  return createHmac('sha256', key).update(payload).digest();
}

export function signPriceQuote(
  input: Omit<PriceQuote, 'v' | 'exp'>,
  now: number = Date.now(),
): string | null {
  const key = signingKey();
  if (!key) return null;
  const quote: PriceQuote = { v: 1, ...input, exp: now + PRICE_QUOTE_TTL_MS };
  const payload = b64url(JSON.stringify(quote));
  return `${payload}.${b64url(mac(key, payload))}`;
}

/**
 * Vérifie un devis pour un SKU et une devise donnés. Renvoie `null` si la
 * signature est fausse, le devis expiré, mal formé, ou pour un autre article.
 */
export function verifyPriceQuote(
  token: string | null | undefined,
  expected: { sku: string; currency: string },
  now: number = Date.now(),
): PriceQuote | null {
  if (!token || token.length > 1000) return null;
  const key = signingKey();
  if (!key) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return null;
  const payload = token.slice(0, dot);
  let given: Buffer;
  try {
    given = Buffer.from(token.slice(dot + 1), 'base64url');
  } catch {
    return null;
  }
  const good = mac(key, payload);
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  let quote: PriceQuote;
  try {
    quote = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PriceQuote;
  } catch {
    return null;
  }
  if (
    quote?.v !== 1 ||
    typeof quote.unit !== 'number' ||
    !Number.isInteger(quote.unit) ||
    quote.unit <= 0 ||
    typeof quote.exp !== 'number' ||
    quote.exp <= now ||
    quote.sku !== expected.sku ||
    quote.cur !== expected.currency
  ) {
    return null;
  }
  return quote;
}
