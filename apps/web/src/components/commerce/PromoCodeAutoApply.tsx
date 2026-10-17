/**
 * `PromoCodeAutoApply` — application automatique d'un code de réduction
 * depuis l'URL de campagne, et reprise du code après rechargement.
 *
 *  1. `/kit?code=GLOW99` (ou `?promo=`, `?coupon=`) — la publicité Meta porte
 *     le code dans son lien ; la cliente ne doit RIEN taper (chaque champ en
 *     plus perd des commandes en COD). On valide le code via
 *     /api/coupons/redeem puis on l'applique au wizard-store → tous les prix
 *     de la page (XXL, hero, récap, sticky CTA, total attendu) passent à 99.
 *  2. Reprise : le code ET son montant sont persistés, mais on RE-VALIDE
 *     systématiquement au montage — un code expiré ou arrivé à son plafond
 *     doit disparaître de l'affichage, sinon la commande partirait avec un
 *     total attendu que le serveur refuse (422 price_mismatch).
 *
 * Le serveur reste la seule autorité sur le montant : il re-valide le code à
 * la création de la commande.
 *
 * Ne rend rien. Doit être monté sous <Suspense> (useSearchParams, ISR).
 */
'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

import { useWizardStore, type CouponKind } from '@/lib/checkout/state/wizard-store';

/** Paramètres d'URL acceptés (le premier renseigné gagne). */
const URL_PARAMS = ['code', 'promo', 'coupon'] as const;

interface RedeemResponse {
  valid?: boolean;
  valueCents?: number;
  kind?: CouponKind;
  reason?: string;
}

/**
 * `null` = la réponse du serveur n'a PAS pu être obtenue (panne réseau, JSON
 * illisible). À distinguer d'un `{valid:false}` explicite : dans le premier
 * cas on ne touche pas à la remise déjà affichée.
 */
async function redeem(code: string): Promise<RedeemResponse | null> {
  try {
    const res = await fetch('/api/coupons/redeem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    // 5xx / 4xx = panne côté serveur, PAS un verdict sur le code. La route
    // répond 200 même pour un code refusé (`{valid:false, reason}`), donc un
    // statut non-OK ne doit jamais faire disparaître une remise appliquée.
    if (!res.ok) return null;
    return (await res.json()) as RedeemResponse;
  } catch {
    return null;
  }
}

export function readUrlCode(params: URLSearchParams | null): string | null {
  if (!params) return null;
  for (const key of URL_PARAMS) {
    const raw = params.get(key);
    if (raw && raw.trim().length >= 3) return raw.trim().toUpperCase().slice(0, 40);
  }
  return null;
}

export function PromoCodeAutoApply(): null {
  const searchParams = useSearchParams();
  const hydrated = useWizardStore((s) => s.hydrated);
  const couponCode = useWizardStore((s) => s.couponCode);
  const setCoupon = useWizardStore((s) => s.setCoupon);
  const clearCoupon = useWizardStore((s) => s.clearCoupon);
  // Une seule validation par code et par montage (pas de rafale d'appels).
  const attempted = useRef<string | null>(null);

  const urlCode = readUrlCode(searchParams);
  // Code candidat : celui de l'URL de campagne, sinon celui mémorisé.
  const target = urlCode ?? couponCode;

  useEffect(() => {
    if (!hydrated || !target) return;
    // `creditCents` n'entre PAS dans la garde : un code déjà porteur d'un
    // montant est re-validé quand même, car il a pu expirer entre deux visites.
    if (attempted.current === target) return;
    attempted.current = target;

    let cancelled = false;
    let settled = false;
    void redeem(target).then((json) => {
      settled = true;
      if (cancelled) return;
      if (json === null) {
        // Panne réseau : on ne touche à RIEN. Effacer ici ferait perdre sa
        // remise à une cliente qui l'a pourtant vue s'appliquer.
        return;
      }
      if (json.valid && typeof json.valueCents === 'number' && json.valueCents > 0) {
        setCoupon(target, json.valueCents, json.kind === 'promo' ? 'promo' : 'credit');
        return;
      }
      // On ne retire la remise QUE sur un verdict explicite `valid:false`.
      // Une réponse inattendue (corps illisible, champ manquant) est traitée
      // comme une panne : on laisse la remise en place, le serveur tranchera
      // de toute façon à la création de la commande.
      if (json.valid === false && target === couponCode) clearCoupon();
    });
    return () => {
      cancelled = true;
      // Démontage AVANT la réponse (React StrictMode monte/démonte/remonte en
      // développement) : sans ce reset, la seconde exécution voyait `target`
      // déjà tenté, abandonnait, et la remise n'était JAMAIS appliquée.
      if (!settled) attempted.current = null;
    };
  }, [hydrated, target, couponCode, setCoupon, clearCoupon]);

  return null;
}
