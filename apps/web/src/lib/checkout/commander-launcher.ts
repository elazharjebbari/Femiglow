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
 * Le mode est résolu à partir du réglage CMS `kit-checkout` que la section
 * déclare (`configure`), de `?cta=` et du `fg_aid` (attribution A/B). La
 * résolution est mémorisée (`assignment`) et peut avoir lieu À LA DEMANDE,
 * de façon synchrone : un clic arrivé avant l'effet de synchronisation de la
 * section applique déjà la variante attribuée (et non un `scroll` par défaut
 * qui fausserait le test A/B). Le panneau n'est utilisé que si la section
 * l'a déclaré (`registerSheetHost`) : sur une page sans formulaire embarqué,
 * on retombe toujours sur le défilement.
 *
 * Store Zustand plutôt que Context : les boutons vivent dans des arbres
 * distincts (layout `/kit` pour la sticky, page pour le hero, portail des
 * stories) — un store module évite d'ajouter un provider dans les layouts.
 */

import { create } from 'zustand';

import { arriveAtCommander, type ArriveOptions } from '@/lib/checkout/wizard-arrival';
import {
  COMMANDER_MODE_QUERY_PARAM,
  commanderModeNeedsVisitor,
  parseCommanderOverride,
  resolveCommanderAssignment,
  type CommanderAssignment,
  type CommanderCmsMode,
  type CommanderMode,
} from '@/lib/checkout/commander-mode';
import { getAnonymousId } from '@/lib/tracking/identity';

/** Ancre de la section commande embarquée sur /kit. */
export const COMMANDER_ANCHOR_ID = 'commander-femiglow';

export interface OpenCommanderOptions extends ArriveOptions {
  /** Origine du clic (tracking/debug) : `hero`, `sticky`, `pack_section`… */
  source: string;
  /** Ancre cible (sans `#`). Seule l'ancre du formulaire ouvre le panneau. */
  anchorId?: string;
}

/** Réglage admin déclaré par la section (`kit-checkout`). */
export interface CommanderModeConfig {
  cmsMode: CommanderCmsMode;
  sharePct: number;
}

/** Variante attribuée + entrées qui l'ont produite (cache). */
export interface ResolvedCommanderAssignment extends CommanderAssignment {
  cmsMode: CommanderCmsMode;
  sharePct: number;
  /** Override normalisé (`?cta=`), `null` si absent ou invalide. */
  override: CommanderMode | null;
}

/** `?cta=` lu directement dans l'URL courante (clic hors cycle React). */
function readOverrideFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(COMMANDER_MODE_QUERY_PARAM);
  } catch {
    return null;
  }
}

interface CommanderLauncherState {
  /** Mode effectif (après override `?cta=` et attribution A/B). */
  mode: CommanderMode;
  /** Réglage déclaré par la section ; `null` hors /kit. */
  config: CommanderModeConfig | null;
  /** Variante attribuée pour ce chargement de page ; `null` tant que non résolue. */
  assignment: ResolvedCommanderAssignment | null;
  /** Le panneau est-il ouvert ? */
  isSheetOpen: boolean;
  /** Nombre de sections capables d'afficher le panneau (0 ou 1 en pratique). */
  sheetHosts: number;
  /** Origine de la dernière ouverture du panneau. */
  lastSource: string | null;
  setMode: (mode: CommanderMode) => void;
  /**
   * Déclare (ou retire, `null`) le réglage admin. Un réglage différent
   * invalide l'attribution mémorisée ; le retrait remet le défilement.
   */
  configure: (config: CommanderModeConfig | null) => void;
  /**
   * Résout la variante de façon SYNCHRONE à partir du réglage déclaré, de
   * `?cta=` (argument, sinon URL courante) et du `fg_aid`. Mémorisée tant que
   * ses entrées ne changent pas. `null` si aucun réglage n'est déclaré.
   */
  resolveMode: (overrideRaw?: string | null) => ResolvedCommanderAssignment | null;
  /** Déclare un hôte de panneau ; renvoie la fonction de retrait. */
  registerSheetHost: () => () => void;
  /** Ouvre le formulaire ; renvoie le mode réellement appliqué. */
  openCommander: (options: OpenCommanderOptions) => CommanderMode;
  closeCommander: () => void;
}

export const useCommanderLauncherStore = create<CommanderLauncherState>()((set, get) => ({
  mode: 'scroll',
  config: null,
  assignment: null,
  isSheetOpen: false,
  sheetHosts: 0,
  lastSource: null,

  setMode: (mode) => {
    // Retour en `scroll` (réglage modifié, override) : on ne laisse pas un
    // panneau orphelin ouvert.
    set(mode === 'scroll' ? { mode, isSheetOpen: false } : { mode });
  },

  configure: (config) => {
    const current = get().config;
    if (!config) {
      if (current || get().assignment) {
        set({ config: null, assignment: null, mode: 'scroll', isSheetOpen: false });
      }
      return;
    }
    if (current && current.cmsMode === config.cmsMode && current.sharePct === config.sharePct) {
      return;
    }
    set({ config: { cmsMode: config.cmsMode, sharePct: config.sharePct }, assignment: null });
  },

  resolveMode: (overrideRaw) => {
    const { config, assignment } = get();
    if (!config) return null;
    const raw = overrideRaw === undefined ? readOverrideFromLocation() : overrideRaw;
    const override = parseCommanderOverride(raw);
    if (
      assignment &&
      assignment.cmsMode === config.cmsMode &&
      assignment.sharePct === config.sharePct &&
      assignment.override === override
    ) {
      return assignment;
    }
    const resolved: ResolvedCommanderAssignment = {
      ...resolveCommanderAssignment({
        cmsMode: config.cmsMode,
        sharePct: config.sharePct,
        override,
        // Le `fg_aid` n'est lu (et créé) que si l'attribution en dépend.
        visitorId: commanderModeNeedsVisitor(config.cmsMode, override) ? getAnonymousId() : null,
      }),
      cmsMode: config.cmsMode,
      sharePct: config.sharePct,
      override,
    };
    set({ assignment: resolved });
    get().setMode(resolved.mode);
    return resolved;
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
    // Clic avant la synchronisation de la section : résolution immédiate,
    // pour que le comportement vécu soit celui de la variante attribuée.
    if (!get().assignment) get().resolveMode();
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
  const store = useCommanderLauncherStore.getState();
  if (!store.assignment) store.resolveMode();
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
