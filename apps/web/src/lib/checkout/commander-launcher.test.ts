/**
 * Kit CRO v2 §2 — `openCommander` : défilement (historique) ou panneau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { arriveAtCommander } = vi.hoisted(() => ({ arriveAtCommander: vi.fn() }));
vi.mock('@/lib/checkout/wizard-arrival', () => ({ arriveAtCommander }));

import {
  closeCommander,
  getEffectiveCommanderMode,
  openCommander,
  useCommanderLauncherStore,
} from './commander-launcher';

function reset() {
  useCommanderLauncherStore.setState({
    mode: 'scroll',
    isSheetOpen: false,
    sheetHosts: 0,
    lastSource: null,
  });
}

beforeEach(() => {
  reset();
  arriveAtCommander.mockClear();
});

afterEach(reset);

describe('openCommander — mode scroll', () => {
  it('délègue à arriveAtCommander avec l’ancre par défaut', () => {
    expect(openCommander({ source: 'hero' })).toBe('scroll');
    expect(arriveAtCommander).toHaveBeenCalledWith('commander-femiglow', {});
    expect(useCommanderLauncherStore.getState().isSheetOpen).toBe(false);
  });

  it('conserve les options d’arrivée (extraBottomInset) et l’ancre', () => {
    openCommander({ source: 'sticky_promo_flag', anchorId: 'autre-ancre', extraBottomInset: 96 });
    expect(arriveAtCommander).toHaveBeenCalledWith('autre-ancre', { extraBottomInset: 96 });
  });

  it('mode sheet SANS hôte de panneau (page sans formulaire) → défilement', () => {
    useCommanderLauncherStore.getState().setMode('sheet');
    expect(openCommander({ source: 'hero' })).toBe('scroll');
    expect(arriveAtCommander).toHaveBeenCalledTimes(1);
    expect(getEffectiveCommanderMode()).toBe('scroll');
  });
});

describe('openCommander — mode sheet', () => {
  beforeEach(() => {
    useCommanderLauncherStore.getState().setMode('sheet');
    useCommanderLauncherStore.getState().registerSheetHost();
  });

  it('ouvre le panneau, ne défile pas, mémorise la source', () => {
    expect(openCommander({ source: 'sticky' })).toBe('sheet');
    expect(arriveAtCommander).not.toHaveBeenCalled();
    const state = useCommanderLauncherStore.getState();
    expect(state.isSheetOpen).toBe(true);
    expect(state.lastSource).toBe('sticky');
    expect(getEffectiveCommanderMode()).toBe('sheet');
  });

  it('une autre ancre que le formulaire défile toujours', () => {
    expect(openCommander({ source: 'x', anchorId: 'composition' })).toBe('scroll');
    expect(arriveAtCommander).toHaveBeenCalledWith('composition', {});
    expect(useCommanderLauncherStore.getState().isSheetOpen).toBe(false);
  });

  it('closeCommander ferme le panneau', () => {
    openCommander({ source: 'hero' });
    closeCommander();
    expect(useCommanderLauncherStore.getState().isSheetOpen).toBe(false);
  });

  it('retour en scroll ferme un panneau ouvert', () => {
    openCommander({ source: 'hero' });
    useCommanderLauncherStore.getState().setMode('scroll');
    expect(useCommanderLauncherStore.getState().isSheetOpen).toBe(false);
  });
});

describe('registerSheetHost', () => {
  it('le retrait du dernier hôte ferme le panneau ; désinscription idempotente', () => {
    const { registerSheetHost, setMode } = useCommanderLauncherStore.getState();
    setMode('sheet');
    const unregisterA = registerSheetHost();
    const unregisterB = registerSheetHost();
    openCommander({ source: 'hero' });
    unregisterA();
    unregisterA();
    expect(useCommanderLauncherStore.getState().sheetHosts).toBe(1);
    expect(useCommanderLauncherStore.getState().isSheetOpen).toBe(true);
    unregisterB();
    expect(useCommanderLauncherStore.getState().sheetHosts).toBe(0);
    expect(useCommanderLauncherStore.getState().isSheetOpen).toBe(false);
  });
});
