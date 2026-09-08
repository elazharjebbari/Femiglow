/**
 * `useAppliedCoupon` — prédicat UNIQUE « cette visiteuse a-t-elle un code
 * appliqué ? », et arithmétique unique de la remise.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * La contrainte dure du client est : « garde la page sans code promo
 * intacte ». Aujourd'hui le prédicat est recopié à l'identique dans
 * `PriceBlock.tsx:138` et `HeroProduit.tsx:130` :
 *
 *     const isPromoApplied = couponKind === 'promo' && creditCents > 0 && !!couponCode;
 *
 * …et l'arithmétique de la remise (`Math.max(0, Math.min(credit, base))`)
 * est recopiée SIX fois : `PriceBlock`, `HeroProduit`, `StickyCartCTA`,
 * `MiniCartSlideOver`, `CheckoutFlow`, `WizardCartRecap`. Chaque copie est
 * une occasion de diverger — et une divergence ici ne casse pas seulement
 * l'affichage promo : elle peut faire APPARAÎTRE quelque chose sur la page
 * sans code (un « −0 MAD », une ligne vide, un total à 199 ailleurs qu'à
 * 199). Un seul prédicat, un seul calcul, un seul objet neutre.
 *
 * L'INVARIANT QUE CE MODULE GARANTIT
 * ----------------------------------
 *  1. Sans code, le hook renvoie TOUJOURS la MÊME référence gelée
 *     `NO_COUPON`. Identité référentielle stable ⇒ aucun `useMemo` /
 *     `useEffect` en aval ne se ré-exécute, aucun re-render n'est déclenché
 *     par ce hook pour une visiteuse normale.
 *  2. `applyCouponToPrice(p, NO_COUPON)` renvoie `{ netCents: p,
 *     discountCents: 0 }` — l'identité, prouvable par un test de propriété.
 *  3. Parité SSR ↔ première peinture client (voir `hydrationSafe` ci-dessous).
 *
 * RÈGLE D'USAGE EN AVAL — la seule qui compte
 * -------------------------------------------
 * Tout ce qui dépend du coupon doit être rendu SOUS un `if (coupon.hasDiscount)`
 * qui renvoie `null` (jamais un fragment vide, jamais un `<span>` vide, jamais
 * une classe conditionnelle, jamais un `data-*` conditionnel) et tout prix doit
 * passer par `applyCouponToPrice`. Ce qui n'est pas gardé par ce prédicat n'a
 * pas le droit de changer.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';

import { useWizardStore, type CouponKind, type WizardState } from './wizard-store';

/** Vue en lecture seule du coupon appliqué. Toujours gelée. */
export interface AppliedCoupon {
  /**
   * LE prédicat. `false` ⇒ la page doit être BIT-À-BIT identique à la page
   * d'une visiteuse qui n'a jamais vu de code.
   */
  readonly hasDiscount: boolean;
  /**
   * `true` uniquement pour un code marketing partagé (GLOW99). Un crédit de
   * fidélité (`FG-…`) réduit le prix mais n'affiche PAS la mention
   * « Code X appliqué » : ce sont deux surfaces éditoriales distinctes.
   */
  readonly isPromo: boolean;
  /** Code normalisé (majuscules, trimé), ou `null`. */
  readonly code: string | null;
  /** Remise en centimes, entier ≥ 0. `0` quand `hasDiscount === false`. */
  readonly creditCents: number;
  readonly kind: CouponKind | null;
}

/**
 * Objet neutre — SINGLETON GELÉ. C'est la valeur de référence de la « page
 * sans code ». Toute comparaison `coupon === NO_COUPON` est valide et O(1).
 */
export const NO_COUPON: AppliedCoupon = Object.freeze({
  hasDiscount: false,
  isPromo: false,
  code: null,
  creditCents: 0,
  kind: null,
});

/** Champs du store dont dépend le coupon — rien d'autre. */
export type CouponSlice = Pick<WizardState, 'couponCode' | 'creditCents' | 'couponKind'>;

/**
 * Sélecteur PUR — sans React, sans DOM, testable en `.ts` pur. C'est ici
 * (et nulle part ailleurs) que vit la définition de « visiteuse promo ».
 *
 * Un code sans montant (mémorisé mais pas encore re-validé) N'EST PAS un
 * coupon appliqué : c'est exactement la garde anti-422 côté commande, et
 * c'est aussi ce qui évite d'afficher « Code GLOW99 appliqué · −0 MAD ».
 */
export function selectAppliedCoupon(state: CouponSlice): AppliedCoupon {
  const raw = state.creditCents;
  const creditCents = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
  const code = state.couponCode ? state.couponCode.trim().toUpperCase() : '';
  if (creditCents <= 0 || code.length === 0) return NO_COUPON;
  return Object.freeze({
    hasDiscount: true,
    isPromo: state.couponKind === 'promo',
    code,
    creditCents,
    kind: state.couponKind,
  });
}

/**
 * Applique la remise à un prix brut. Unique implémentation de la règle :
 * plafonnée au prix, jamais négative, jamais appliquée à la livraison.
 *
 * `discountCents` est le montant RÉELLEMENT déduit (≤ `coupon.creditCents`)
 * — c'est lui qu'il faut afficher sur la ligne « Code X −… » et lui qui doit
 * être déduit du total attendu envoyé au serveur.
 */
export function applyCouponToPrice(
  grossCents: number,
  coupon: AppliedCoupon,
): { netCents: number; discountCents: number } {
  const gross = Number.isFinite(grossCents) ? Math.max(0, Math.round(grossCents)) : 0;
  // Chemin « sans code » : identité stricte, aucune arithmétique flottante.
  if (!coupon.hasDiscount) return { netCents: gross, discountCents: 0 };
  const discountCents = Math.min(coupon.creditCents, gross);
  return { netCents: gross - discountCents, discountCents };
}

/**
 * Graine résolue CÔTÉ SERVEUR depuis `?code=` sur /kit. Elle permet au HTML
 * envoyé par le serveur de porter DÉJÀ le prix remisé : sans elle, la page se
 * peint à 199 puis saute à 99 après hydratation et appel réseau — exactement
 * le moment où une visiteuse venue d'une publicité doute.
 */
export interface AppliedCouponSeed {
  code: string;
  valueCents: number;
  kind: CouponKind;
}

/** Égalité par valeur — sert à savoir s'il y a quelque chose à faire basculer. */
function sameCoupon(a: AppliedCoupon, b: AppliedCoupon): boolean {
  return (
    a.hasDiscount === b.hasDiscount &&
    a.isPromo === b.isPromo &&
    a.code === b.code &&
    a.creditCents === b.creditCents &&
    a.kind === b.kind
  );
}

export interface UseAppliedCouponOptions {
  /**
   * Parité SSR ↔ hydratation (défaut `true`).
   *
   * Le store zustand est persisté dans `localStorage` avec un storage
   * SYNCHRONE : à l'initialisation du module côté client, `creditCents` porte
   * déjà 10000 pour une visiteuse revenue avec GLOW99 — AVANT le premier
   * rendu React. Le HTML servi (ISR, `revalidate = 1800`) affiche lui 199 :
   * lire le store directement au premier rendu produit un mismatch
   * d'hydratation React sur la surface prix.
   *
   * Avec `hydrationSafe`, le PREMIER rendu client renvoie `NO_COUPON`
   * (identique au HTML serveur), puis un effet bascule sur la valeur réelle.
   *
   * Coût pour la visiteuse SANS code : ZÉRO. L'état initial est calculé par
   * un initialiseur paresseux qui lit le store : s'il est neutre, le hook est
   * déjà « prêt » au premier rendu et l'effet ne programme aucun setState —
   * pas de second passage de rendu, pas de re-peinture. Seule la visiteuse
   * promo paie une passe de rendu supplémentaire.
   *
   * Passer `false` UNIQUEMENT pour une surface jamais rendue côté serveur
   * (`next/dynamic` avec `ssr: false`, ex. `MiniCartSlideOver`) : il n'y a
   * alors pas d'hydratation à faire correspondre, et la garde ne ferait
   * qu'introduire un clignotement 199 → 99.
   */
  hydrationSafe?: boolean;
  /**
   * Valeur résolue côté serveur (SSR) pour cette requête. Rendue au premier
   * paint — serveur ET client — puis le store prend le relais dès qu'il porte
   * un code. `undefined` pour toute visiteuse sans `?code=` : le hook se
   * comporte alors exactement comme avant.
   */
  initial?: AppliedCouponSeed;
}

/**
 * Hook partagé. Trois abonnements primitifs (jamais un sélecteur objet :
 * zustand comparerait par référence et re-rendrait à chaque mutation du
 * store, y compris les frappes clavier du wizard).
 */
export function useAppliedCoupon(options: UseAppliedCouponOptions = {}): AppliedCoupon {
  const { hydrationSafe = true, initial } = options;

  const creditCents = useWizardStore((s) => s.creditCents);
  const couponCode = useWizardStore((s) => s.couponCode);
  const couponKind = useWizardStore((s) => s.couponKind);

  const seedCode = initial?.code;
  const seedValue = initial?.valueCents;
  const seedKind = initial?.kind;
  const seed = useMemo(
    () =>
      seedCode !== undefined && seedValue !== undefined
        ? selectAppliedCoupon({
            couponCode: seedCode,
            creditCents: seedValue,
            couponKind: seedKind ?? 'promo',
          })
        : NO_COUPON,
    [seedCode, seedValue, seedKind],
  );

  // `true` dès le premier rendu quand la bascule ne changerait RIEN : la
  // visiteuse sans code — et celle qui arrive avec un code jamais encore
  // mémorisé — ne déclenche aucun setState, donc aucun rendu supplémentaire.
  const [pastFirstPaint, setPastFirstPaint] = useState(() => {
    if (!hydrationSafe) return true;
    const now = selectAppliedCoupon(useWizardStore.getState());
    return sameCoupon(seed, now.hasDiscount ? now : seed);
  });

  useEffect(() => {
    if (!pastFirstPaint) setPastFirstPaint(true);
  }, [pastFirstPaint]);

  return useMemo(() => {
    // Avant la première peinture : exactement ce qu'a rendu le serveur.
    if (!pastFirstPaint) return seed;
    const fromStore = selectAppliedCoupon({ couponCode, creditCents, couponKind });
    // Le store fait autorité dès qu'il porte un code (il a été re-validé) ;
    // sinon on garde la graine serveur, déjà validée pour cette requête.
    return fromStore.hasDiscount ? fromStore : seed;
  }, [pastFirstPaint, couponCode, creditCents, couponKind, seed]);
}
