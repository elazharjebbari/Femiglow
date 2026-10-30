'use client';

/**
 * Kit CRO v2 §2 — Point d'entrée UNIQUE des boutons « Commander ».
 *
 * Tous les CTA (hero, sticky, flag promo, bloc pack, bandeau promo, liens
 * éditoriaux, stories) appellent `openCommander({ source })` :
 *  - mode `scroll` (défaut) → `arriveAtCommander` (défilement centré +
 *    accueil doux, options conservées : `extraBottomInset`…) ;
 *  - mode `sheet` → ouvre le panneau qui contient le formulaire.
 *
 * Le mode est posé par `KitCommanderSection` (réglage CMS `kit-checkout` +
 * attribution A/B). Le panneau n'est utilisé que si la section l'a déclaré
 * (`registerSheetHost`) : sur une page sans formulaire embarqué, ou avant
 * l'hydratation de la section, on retombe toujours sur le défilement.
 *
 * Store Zustand plutôt que Context : les boutons vivent dans des arbres
 * distincts (layout `/kit` pour la sticky, page pour le hero, portail des
 * stories) — un store module évite d'ajouter un provider dans les layouts.
 */

import { create } from 'zustand';

import { arriveAtCommander, type ArriveOptions } from '@/lib/checkout/wizard-arrival';
import type { CommanderMode } from '@/lib/checkout/commander-mode';

/** Ancre de la section commande embarquée sur /kit. */
export const COMMANDER_ANCHOR_ID = 'commander-femiglow';

export interface OpenCommanderOptions extends ArriveOptions {
  /** Origine du clic (tracking/debug) : `hero`, `sticky`, `pack_section`… */
  source: string;
  /** Ancre cible (sans `#`). Seule l'ancre du formulaire ouvre le panneau. */
  anchorId?: string;
}

interface CommanderLauncherState {
  /** Mode effectif (après override `?cta=` et attribution A/B). */
  mode: CommanderMode;
  /** Le panneau est-il ouvert ? */
  isSheetOpen: boolean;
  /** Nombre de sections capables d'afficher le panneau (0 ou 1 en pratique). */
  sheetHosts: number;
  /** Origine de la dernière ouverture du panneau. */
  lastSource: string | null;
  setMode: (mode: CommanderMode) => void;
  /** Déclare un hôte de panneau ; renvoie la fonction de retrait. */
  registerSheetHost: () => () => void;
  /** Ouvre le formulaire ; renvoie le mode réellement appliqué. */
  openCommander: (options: OpenCommanderOptions) => CommanderMode;
  closeCommander: () => void;
}

export const useCommanderLauncherStore = create<CommanderLauncherState>()((set, get) => ({
  mode: 'scroll',
  isSheetOpen: false,
  sheetHosts: 0,
  lastSource: null,

  setMode: (mode) => {
    // Retour en `scroll` (réglage modifié, override) : on ne laisse pas un
    // panneau orphelin ouvert.
    set(mode === 'scroll' ? { mode, isSheetOpen: false } : { mode });
  },

  registerSheetHost: () => {
    set((s) => ({ sheetHosts: s.sheetHosts + 1 }));
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      set((s) => {
        const sheetHosts = Math.max(0, s.sheetHosts - 1);
        return sheetHosts === 0 ? { sheetHosts, isSheetOpen: false } : { sheetHosts };
      });
    };
  },

  openCommander: ({ source, anchorId = COMMANDER_ANCHOR_ID, ...arriveOptions }) => {
    const { mode, sheetHosts } = get();
    if (mode === 'sheet' && sheetHosts > 0 && anchorId === COMMANDER_ANCHOR_ID) {
      set({ isSheetOpen: true, lastSource: source });
      return 'sheet';
    }
    arriveAtCommander(anchorId, arriveOptions);
    return 'scroll';
  },

  closeCommander: () => set({ isSheetOpen: false }),
}));

/** Mode qu'appliquerait un clic maintenant (pour le tracking `kit_cta_mode`). */
export function getEffectiveCommanderMode(): CommanderMode {
  const { mode, sheetHosts } = useCommanderLauncherStore.getState();
  return mode === 'sheet' && sheetHosts > 0 ? 'sheet' : 'scroll';
}

/** Raccourci non réactif, utilisable hors composant (handlers). */
export function openCommander(options: OpenCommanderOptions): CommanderMode {
  return useCommanderLauncherStore.getState().openCommander(options);
}

export function closeCommander(): void {
  useCommanderLauncherStore.getState().closeCommander();
}

/**
 * Hook React : `openCommander`, `closeCommander`, `isSheetOpen`, `mode`.
 * Les actions sont stables (référence du store), seuls `isSheetOpen` et
 * `mode` provoquent un rendu.
 */
export function useCommanderLauncher(): {
  openCommander: (options: OpenCommanderOptions) => CommanderMode;
  closeCommander: () => void;
  isSheetOpen: boolean;
  mode: CommanderMode;
} {
  const isSheetOpen = useCommanderLauncherStore((s) => s.isSheetOpen);
  const mode = useCommanderLauncherStore((s) => s.mode);
  return { openCommander, closeCommander, isSheetOpen, mode };
}
