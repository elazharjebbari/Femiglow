/**
 * Kit CRO v2 §4 — libellés des boutons de commande /kit (ton direct).
 *
 * Les gabarits viennent du composant CMS `kit-cta` (repli : messages i18n
 * `marketing.kit.cta.*`). Le jeton `{price}` est remplacé CÔTÉ CLIENT par le
 * prix réellement facturé : il dépend du code promo appliqué (99 DH avec
 * GLOW99, sinon le prix catalogue). Module pur, sans I/O.
 */
import type { Locale } from '@/i18n.config';

/** Clé du composant CMS. */
export const KIT_CTA_COMPONENT_KEY = 'kit-cta';

/** Jeton remplacé par le prix. */
export const CTA_PRICE_TOKEN = '{price}';

export interface KitCtaCopy {
  /** Bouton du hero (gabarit, `{price}` accepté). */
  primary: string;
  /** Bouton de la barre en bas d'écran (gabarit, `{price}` accepté). */
  sticky: string;
  /** Micro-texte sous le bouton du hero (texte simple). */
  microcopy: string;
  /**
   * Bouton du bloc pack, UNIQUEMENT s'il est publié dans le CMS. Absent → le
   * bloc garde son libellé (`feed.hero.ctaLabel` : override pack ou copie
   * canonique du feed, localisée en AR/EN).
   */
  pack?: string;
}

/** Repli FR quand ni le CMS ni les messages ne répondent (tests, rendu isolé). */
export const DEFAULT_KIT_CTA_COPY: Readonly<Required<KitCtaCopy>> = Object.freeze({
  primary: 'Je commande — {price}',
  sticky: 'Je commande',
  microcopy: 'Je paie à la livraison',
  pack: 'Je commande — {price}',
});

const PRICE_TOKEN_RE = /\{price\}/g;
// « — {price} », « - {price} », « : {price} » (et l'ordre inverse) : le
// séparateur part avec le prix quand celui-ci est inconnu.
const PRICE_WITH_SEPARATOR_AFTER_TEXT = /\s*[—–\-:·|]\s*\{price\}/g;
const PRICE_WITH_SEPARATOR_BEFORE_TEXT = /\{price\}\s*[—–\-:·|]\s*/g;

/**
 * Remplit le gabarit avec le prix formaté.
 *  - gabarit sans `{price}` → renvoyé tel quel ;
 *  - prix inconnu (`null`, vide) → le segment « — {price} » est retiré
 *    proprement (« Je commande — {price} » → « Je commande »).
 */
export function formatCtaLabel(template: string, priceLabel: string | null | undefined): string {
  if (!template.includes(CTA_PRICE_TOKEN)) return template;
  const price = typeof priceLabel === 'string' ? priceLabel.trim() : '';
  if (price.length > 0) return template.replace(PRICE_TOKEN_RE, price);
  return template
    .replace(PRICE_WITH_SEPARATOR_AFTER_TEXT, '')
    .replace(PRICE_WITH_SEPARATOR_BEFORE_TEXT, '')
    .replace(PRICE_TOKEN_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Prix court pour un bouton : « 99 DH » (FR), « 99 MAD » (EN), « 99 درهم »
 * (AR). Chiffres latins partout (cohérence de marque). Montant non entier →
 * deux décimales (virgule en FR).
 */
export function formatCtaPrice(
  cents: number | null | undefined,
  currency = 'MAD',
  locale: Locale | string = 'fr',
): string | null {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents < 0) return null;
  const rounded = Math.round(cents);
  const amount =
    rounded % 100 === 0
      ? String(rounded / 100)
      : locale === 'fr'
        ? (rounded / 100).toFixed(2).replace('.', ',')
        : (rounded / 100).toFixed(2);
  const unit =
    currency === 'MAD'
      ? locale === 'ar'
        ? 'درهم'
        : locale === 'en'
          ? 'MAD'
          : 'DH'
      : currency;
  // Espace insécable : le montant et l'unité ne se séparent jamais.
  return `${amount} ${unit}`;
}
