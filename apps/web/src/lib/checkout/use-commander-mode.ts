'use client';

/**
 * Kit CRO v2 §2 — Hook client du mode « Commander » (`scroll` | `sheet`).
 * Logique pure dans `commander-mode.ts`, attribution mémorisée dans le
 * lanceur (`commander-launcher.ts`) ; ici on ne fait que brancher `?cta=`
 * (useSearchParams) et le réglage CMS.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { useCommanderLauncherStore } from '@/lib/checkout/commander-launcher';
import {
  COMMANDER_MODE_QUERY_PARAM,
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
 * d'hydratation. `null` tant que la résolution n'a pas eu lieu. Un clic
 * survenu entre-temps n'attend pas ce hook : le lanceur résout la variante
 * à la demande, avec les mêmes entrées (même résultat, mémorisé).
 *
 * Effet de bord voulu : la variante est poussée dans le lanceur (`mode`,
 * `assignment`).
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
    const store = useCommanderLauncherStore.getState();
    store.configure({ cmsMode, sharePct });
    setMode(store.resolveMode(override)?.mode ?? null);
  }, [cmsMode, sharePct, override]);

  return mode;
}
