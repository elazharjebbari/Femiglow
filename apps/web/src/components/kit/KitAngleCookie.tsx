'use client';

/**
 * Kit CRO v2 §3 — garde l'angle publicitaire pour les visites suivantes.
 *
 * La page résout l'angle côté serveur (`?angle=` > `utm_content` > cookie).
 * Quand il vient de l'URL, on le pose dans le cookie `fg_angle` (7 jours) :
 * une visiteuse qui revient sans UTM retrouve le même titre. Quand il vient
 * déjà du cookie, on ne le réécrit pas (la durée n'est pas prolongée).
 * Aucun rendu.
 */

import { useEffect } from 'react';

import {
  KIT_ANGLE_COOKIE,
  KIT_ANGLE_COOKIE_MAX_AGE,
  isKitAngle,
  type KitAngle,
} from '@/lib/kit/angle';

export interface KitAngleCookieProps {
  angle: KitAngle | null;
  /** `true` si l'angle a été lu dans l'URL (`?angle=` ou `utm_content`). */
  fromUrl: boolean;
}

/** Chaîne du cookie (exportée pour les tests). */
export function buildKitAngleCookie(angle: KitAngle): string {
  return `${KIT_ANGLE_COOKIE}=${angle}; Max-Age=${KIT_ANGLE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function KitAngleCookie({ angle, fromUrl }: KitAngleCookieProps): null {
  useEffect(() => {
    if (!fromUrl || !isKitAngle(angle) || typeof document === 'undefined') return;
    try {
      document.cookie = buildKitAngleCookie(angle);
    } catch {
      // Cookies bloqués : l'angle reste lu depuis l'URL, rien d'autre à faire.
    }
  }, [angle, fromUrl]);
  return null;
}
