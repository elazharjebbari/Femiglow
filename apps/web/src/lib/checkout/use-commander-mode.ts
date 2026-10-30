'use client';

/**
 * Kit CRO v2 §2 — Hook client du mode « Commander » (`scroll` | `sheet`).
 * Logique pure dans `commander-mode.ts` ; ici on ne fait que brancher
 * `?cta=` (useSearchParams) et l'identifiant anonyme `fg_aid`.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { getAnonymousId } from '@/lib/tracking/identity';
import {
  COMMANDER_MODE_QUERY_PARAM,
  parseCommanderOverride,
  resolveCommanderMode,
  type CommanderCmsMode,
  type CommanderMode,
} from '@/lib/checkout/commander-mode';

export interface UseCommanderModeOptions {
  cmsMode: CommanderCmsMode;
  sharePct: number;
}

/**
 * Résout le mode côté client, APRÈS le montage : le `fg_aid` vit dans le
 * `localStorage`, le résoudre au rendu serveur provoquerait un écart
 * d'hydratation. `null` tant que la résolution n'a pas eu lieu (les boutons
 * se comportent alors en `scroll`, le comportement historique).
 *
 * À rendre sous un `<Suspense>` (exigence de `useSearchParams` en Next 14
 * pour ne pas basculer toute la page en rendu client).
 */
export function useCommanderMode({
  cmsMode,
  sharePct,
}: UseCommanderModeOptions): CommanderMode | null {
  const searchParams = useSearchParams();
  const override = searchParams?.get(COMMANDER_MODE_QUERY_PARAM) ?? null;
  const [mode, setMode] = useState<CommanderMode | null>(null);

  useEffect(() => {
    // Le `fg_aid` n'est lu (et créé) que si l'attribution en dépend.
    const needsVisitor = !parseCommanderOverride(override) && cmsMode === 'ab';
    setMode(
      resolveCommanderMode({
        cmsMode,
        sharePct,
        override,
        visitorId: needsVisitor ? getAnonymousId() : null,
      }),
    );
  }, [cmsMode, sharePct, override]);

  return mode;
}
