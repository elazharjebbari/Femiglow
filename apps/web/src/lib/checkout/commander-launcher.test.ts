/**
 * Kit CRO v2 §2 — `openCommander` : défilement (historique) ou panneau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { arriveAtCommander, getAnonymousId } = vi.hoisted(() => ({
  arriveAtCommander: vi.fn(),
  getAnonymousId: vi.fn(() => 'aid_fixture'),
}));
vi.mock('@/lib/checkout/wizard-arrival', () => ({ arriveAtCommander }));
vi.mock('@/lib/tracking/identity', () => ({ getAnonymousId }));

import {
  closeCommander,
  getEffectiveCommanderMode,
  openCommander,
  useCommanderLauncherStore,
} from './commander-launcher';
import { resolveCommanderMode } from './commander-mode';

function reset() {
  useCommanderLauncherStore.setState({
    mode: 'scroll',
    config: null,
    assignment: null,
    isSheetOpen: false,
    sheetHosts: 0,
    lastSource: null,
  });
  window.history.replaceState(null, '', '/');
}

beforeEach(() => {
  reset();
  arriveAtCommander.mockClear();
  getAnonymousId.mockClear();
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

describe('résolution synchrone à la demande (clic avant la synchronisation)', () => {
  beforeEach(() => {
    useCommanderLauncherStore.getState().registerSheetHost();
  });

  it('sans réglage déclaré (hors /kit) : défilement, aucune lecture du fg_aid', () => {
    expect(openCommander({ source: 'hero' })).toBe('scroll');
    expect(arriveAtCommander).toHaveBeenCalledTimes(1);
    expect(getAnonymousId).not.toHaveBeenCalled();
    expect(useCommanderLauncherStore.getState().assignment).toBeNull();
  });

  it('réglage sheet déclaré mais non encore résolu : le clic ouvre le panneau', () => {
    useCommanderLauncherStore.getState().configure({ cmsMode: 'sheet', sharePct: 50 });
    expect(openCommander({ source: 'hero' })).toBe('sheet');
    expect(arriveAtCommander).not.toHaveBeenCalled();
    expect(useCommanderLauncherStore.getState().assignment).toMatchObject({
      mode: 'sheet',
      source: 'cms',
    });
  });

  it('?cta= lu dans l’URL courante', () => {
    window.history.replaceState(null, '', '/kit?cta=sheet');
    useCommanderLauncherStore.getState().configure({ cmsMode: 'scroll', sharePct: 0 });
    expect(openCommander({ source: 'hero' })).toBe('sheet');
    expect(useCommanderLauncherStore.getState().assignment?.source).toBe('override');
  });

  it('A/B : même variante que l’attribution par fg_aid, tirée une seule fois', () => {
    useCommanderLauncherStore.getState().configure({ cmsMode: 'ab', sharePct: 50 });
    const expected = resolveCommanderMode({
      cmsMode: 'ab',
      sharePct: 50,
      visitorId: 'aid_fixture',
    });
    expect(getEffectiveCommanderMode()).toBe(expected);
    expect(openCommander({ source: 'hero' })).toBe(expected);
    expect(getAnonymousId).toHaveBeenCalledTimes(1);
  });

  it('un réglage modifié invalide l’attribution ; le retrait remet le défilement', () => {
    const store = useCommanderLauncherStore.getState();
    store.configure({ cmsMode: 'sheet', sharePct: 50 });
    expect(store.resolveMode(null)?.mode).toBe('sheet');
    store.configure({ cmsMode: 'sheet', sharePct: 50 });
    expect(useCommanderLauncherStore.getState().assignment).not.toBeNull();
    store.configure({ cmsMode: 'scroll', sharePct: 50 });
    expect(useCommanderLauncherStore.getState().assignment).toBeNull();
    expect(store.resolveMode(null)?.mode).toBe('scroll');
    store.configure(null);
    expect(useCommanderLauncherStore.getState()).toMatchObject({
      config: null,
      assignment: null,
      mode: 'scroll',
    });
  });
});
