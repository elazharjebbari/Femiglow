/**
 * `PromoCodeAutoApply` — application automatique d'un code de réduction
 * depuis l'URL de campagne, et reprise du code après rechargement.
 *
 * Deux cas, un seul effet :
 *  1. `/kit?code=GLOW99` (ou `?promo=`, `?coupon=`) — la publicité Meta porte
 *     le code dans son lien ; la cliente ne doit RIEN taper (chaque champ en
 *     plus perd des commandes en COD). On valide le code via
 *     /api/coupons/redeem puis on l'applique au wizard-store → tous les prix
 *     de la page (XXL, récap, sticky CTA, total attendu) passent à 199 → 99.
 *  2. Reprise : `couponCode` est persisté mais pas `creditCents` (le serveur
 *     reste autoritaire). Au rechargement on re-valide le code mémorisé pour
 *     ré-afficher la réduction ; s'il n'est plus valide, on le retire.
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

async function redeem(code: string): Promise<RedeemResponse | null> {
  try {
    const res = await fetch('/api/coupons/redeem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
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
  const creditCents = useWizardStore((s) => s.creditCents);
  const setCoupon = useWizardStore((s) => s.setCoupon);
  const clearCoupon = useWizardStore((s) => s.clearCoupon);
  // Un seul essai par combinaison de codes et par montage (évite les boucles
  // si l'API répond invalide : on ne re-tente pas les mêmes codes en rafale).
  const attempted = useRef<string | null>(null);

  const urlCode = readUrlCode(searchParams);

  useEffect(() => {
    if (!hydrated) return;
    // Candidats dans l'ordre : code de l'URL (campagne), puis code mémorisé
    // dont le montant n'est pas encore re-validé (reprise après rechargement).
    const candidates: string[] = [];
    if (urlCode && !(urlCode === couponCode && creditCents > 0)) candidates.push(urlCode);
    if (couponCode && creditCents <= 0 && couponCode !== urlCode) candidates.push(couponCode);
    if (candidates.length === 0) return;
    const signature = candidates.join('|');
    if (attempted.current === signature) return;
    attempted.current = signature;

    let cancelled = false;
    void (async () => {
      for (const candidate of candidates) {
        const json = await redeem(candidate);
        if (cancelled) return;
        if (json?.valid && typeof json.valueCents === 'number' && json.valueCents > 0) {
          setCoupon(candidate, json.valueCents, json.kind === 'promo' ? 'promo' : 'credit');
          return;
        }
        // Code mémorisé devenu invalide (expiré, plafond atteint) : on le retire
        // pour ne pas afficher une réduction fantôme. Un code d'URL invalide
        // est simplement ignoré (on ne touche pas au reste).
        if (candidate === couponCode && creditCents <= 0) clearCoupon();
      }
    })();
    return () => {
      cancelled = true;
    };
    // `creditCents`/`couponCode` volontairement inclus : après `setCoupon` la
    // garde « déjà appliqué » court-circuite l'effet.
  }, [hydrated, urlCode, couponCode, creditCents, setCoupon, clearCoupon]);

  return null;
}
