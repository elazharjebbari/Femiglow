/**
 * Kit CRO v2 §2 — `KitCommanderSection` en mode défilement et en mode panneau.
 *
 * Le WizardShell est remplacé par un double minimal BRANCHÉ sur le vrai store
 * persistant (`useWizardStore`) : on vérifie l'orchestration (une seule
 * instance, état conservé, focus/défilement du panneau, variantKey), pas le
 * formulaire lui-même (couvert par les tests des steps).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { search, arriveAtCommander, emit, shellMounts } = vi.hoisted(() => ({
  search: { value: '', suspend: false },
  arriveAtCommander: vi.fn(),
  emit: vi.fn(),
  shellMounts: { count: 0 },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    // Simule une synchronisation pas encore faite (Suspense en attente).
    if (search.suspend) throw new Promise(() => undefined);
    return new URLSearchParams(search.value);
  },
}));
vi.mock('@/lib/checkout/wizard-arrival', () => ({ arriveAtCommander }));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit, consent: {}, isReady: true }),
}));
vi.mock('@/lib/tracking/identity', () => ({ getAnonymousId: () => 'aid_test' }));

vi.mock('@/components/checkout/wizard/WizardShell', async () => {
  const { useEffect } = await import('react');
  const { useWizardStore } = await import('@/lib/checkout/state/wizard-store');
  const { useScrollWizardToTop } =
    await import('@/components/checkout/wizard/wizard-scroll-container');
  function WizardShellStub({ formContext }: { formContext: { variantKey: string } }) {
    const step = useWizardStore((s) => s.currentStep);
    const firstName = useWizardStore((s) => s.leadDraft.firstName);
    const mergeLeadDraft = useWizardStore((s) => s.mergeLeadDraft);
    const scrollToTop = useScrollWizardToTop();
    useEffect(() => {
      shellMounts.count += 1;
    }, []);
    return (
      <div data-testid="wizard-shell" data-variant-key={formContext.variantKey}>
        <section data-testid={`wizard-step-${step}`}>
          <h2>Étape {step}</h2>
          <label>
            Prénom
            <input
              value={firstName}
              onChange={(e) => mergeLeadDraft({ firstName: e.target.value })}
            />
          </label>
          <button type="button" onClick={scrollToTop}>
            Nouvelle commande
          </button>
        </section>
      </div>
    );
  }
  return { WizardShell: WizardShellStub };
});

import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { useCommanderLauncherStore } from '@/lib/checkout/commander-launcher';
import { __resetKitCheckoutExposureForTests } from '@/lib/checkout/kit-checkout-exposure';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';
import type { KitCheckoutConfig } from '@/lib/checkout/kit-checkout-config';

import { KitCommanderSection } from './KitCommanderSection';

const CART: CartSnapshot = {
  items: [{ variantId: 'pv', sku: 'K', name: 'Kit', quantity: 1, unitPriceCents: 32000 }],
  totalCents: 32000,
  currency: 'MAD',
};

function renderPage(config?: KitCheckoutConfig) {
  return render(
    <>
      <CommanderAnchorButton productId="kit" productName="Kit" priceCents={32000}>
        Commander
      </CommanderAnchorButton>
      <KitCommanderSection initialCart={CART} checkoutConfig={config} wizardLanguage="fr" />
    </>,
  );
}

const cta = () => screen.getByTestId('kit-commander-anchor-button');
const section = () => screen.getByTestId('kit-commander-section');

let backSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  search.value = '';
  search.suspend = false;
  __resetKitCheckoutExposureForTests();
  shellMounts.count = 0;
  arriveAtCommander.mockClear();
  emit.mockClear();
  backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  useWizardStore.getState().reset();
  useWizardStore.setState({ hydrated: true });
});

afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 5));
  backSpy.mockRestore();
  window.history.replaceState(null, '', '/');
  useCommanderLauncherStore.setState({
    mode: 'scroll',
    config: null,
    assignment: null,
    isSheetOpen: false,
    sheetHosts: 0,
    lastSource: null,
  });
});

describe('KitCommanderSection — mode défilement (défaut)', () => {
  it('wizard en ligne, variantKey A, le CTA défile (arriveAtCommander), pas de dialogue', async () => {
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'scroll'));
    expect(within(section()).getByTestId('wizard-shell')).toHaveAttribute('data-variant-key', 'A');
    fireEvent.click(cta());
    expect(arriveAtCommander).toHaveBeenCalledWith('commander-femiglow', {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(emit).toHaveBeenCalledWith(
      'add_to_cart',
      expect.objectContaining({ kit_cta_mode: 'scroll' }),
    );
  });

  it('?cta=scroll force le défilement même si l’admin a choisi le panneau', async () => {
    search.value = 'cta=scroll';
    renderPage({ ctaMode: 'sheet', sheetSharePct: 50 });
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'scroll'));
    fireEvent.click(cta());
    expect(arriveAtCommander).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('KitCommanderSection — mode panneau', () => {
  async function openSheet() {
    fireEvent.click(cta());
    return screen.findByRole('dialog', { name: 'Commander le rituel' });
  }

  it('?cta=sheet : variantKey B, le CTA ouvre le panneau sans défiler', async () => {
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    expect(within(section()).getByTestId('wizard-shell')).toHaveAttribute('data-variant-key', 'B');
    const dialog = await openSheet();
    expect(arriveAtCommander).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId('wizard-shell')).toBeInTheDocument();
    expect(emit).toHaveBeenCalledWith(
      'add_to_cart',
      expect.objectContaining({ kit_cta_mode: 'sheet' }),
    );
  });

  it('réglage admin ctaMode=sheet (sans override)', async () => {
    renderPage({ ctaMode: 'sheet', sheetSharePct: 50 });
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
  });

  it('une seule instance du wizard : placeholder en ligne pendant l’ouverture', async () => {
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    const dialog = await openSheet();
    expect(screen.getAllByTestId('wizard-shell')).toHaveLength(1);
    expect(within(dialog).getByTestId('wizard-shell')).toBeInTheDocument();
    expect(within(section()).getByTestId('kit-commander-sheet-placeholder')).toBeInTheDocument();
    expect(
      within(section()).getByRole('button', { name: 'Reprendre ma commande', hidden: true }),
    ).toBeInTheDocument();
  });

  it('état conservé entre fermeture et réouverture (store persistant)', async () => {
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    let dialog = await openSheet();
    fireEvent.change(within(dialog).getByLabelText('Prénom'), { target: { value: 'Salma' } });

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Fermer le formulaire de commande' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Retour en ligne : même saisie, une seule instance.
    expect(screen.getAllByTestId('wizard-shell')).toHaveLength(1);
    expect(within(section()).getByLabelText('Prénom')).toHaveValue('Salma');

    dialog = await openSheet();
    expect(within(dialog).getByLabelText('Prénom')).toHaveValue('Salma');
    expect(screen.getAllByTestId('wizard-shell')).toHaveLength(1);
  });

  it('Échap et bouton retour ferment le panneau', async () => {
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    let dialog = await openSheet();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useCommanderLauncherStore.getState().isSheetOpen).toBe(false);

    dialog = await openSheet();
    expect(dialog).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('changement d’étape : haut du panneau + focus sur le titre du step', async () => {
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    const dialog = await openSheet();
    const body = within(dialog).getByTestId('kit-commander-sheet-body');
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Étape lead'));

    body.scrollTop = 400;
    act(() => {
      useWizardStore.setState({ currentStep: 'address' });
    });
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Étape address'));
    expect(body.scrollTop).toBe(0);
    expect(document.activeElement).toHaveAttribute('tabindex', '-1');
  });

  it('« Nouvelle commande » remonte le panneau, pas la fenêtre', async () => {
    search.value = 'cta=sheet';
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    const dialog = await openSheet();
    const body = within(dialog).getByTestId('kit-commander-sheet-body');
    const bodyScroll = vi.fn();
    body.scrollTo = bodyScroll as unknown as typeof body.scrollTo;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nouvelle commande' }));
    expect(bodyScroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(windowScroll).not.toHaveBeenCalled();
    windowScroll.mockRestore();
  });

  it('arrivée avec #commander-femiglow : le panneau s’ouvre', async () => {
    search.value = 'cta=sheet';
    window.history.replaceState(null, '', '/kit#commander-femiglow');
    renderPage();
    expect(await screen.findByRole('dialog', { name: 'Commander le rituel' })).toBeInTheDocument();
    expect(useCommanderLauncherStore.getState().lastSource).toBe('hash');
  });

  it('arrivée avec #commander-femiglow en mode défilement : pas de panneau', async () => {
    window.history.replaceState(null, '', '/kit#commander-femiglow');
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'scroll'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('le bouton du placeholder rouvre le panneau', async () => {
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    await openSheet();
    act(() => {
      useCommanderLauncherStore.getState().closeCommander();
    });
    // Pendant l'ouverture, le placeholder est inerte (aria-hidden par Radix) ;
    // on le teste via le lanceur une fois le panneau refermé et rouvert.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByTestId('kit-commander-sheet-placeholder')).toBeNull();
    act(() => {
      useCommanderLauncherStore.getState().openCommander({ source: 'test' });
    });
    fireEvent.click(screen.getByTestId('kit-commander-sheet-reopen'));
    expect(useCommanderLauncherStore.getState().lastSource).toBe('inline_placeholder');
  });

  it('démontage de la section : le lanceur retombe en défilement', async () => {
    search.value = 'cta=sheet';
    const { unmount } = renderPage();
    await waitFor(() => expect(useCommanderLauncherStore.getState().mode).toBe('sheet'));
    unmount();
    expect(useCommanderLauncherStore.getState().mode).toBe('scroll');
    expect(useCommanderLauncherStore.getState().sheetHosts).toBe(0);
  });
});

const exposureCalls = () => emit.mock.calls.filter(([name]) => name === 'kit_checkout_exposure');

describe('KitCommanderSection — exposition A/B (kit_checkout_exposure)', () => {
  it('une seule exposition par page vue, avec variante, origine et réglage', async () => {
    search.value = 'cta=sheet';
    const { unmount } = renderPage({ ctaMode: 'ab', sheetSharePct: 30 });
    await waitFor(() => expect(exposureCalls()).toHaveLength(1));
    expect(exposureCalls()[0]![1]).toEqual({
      assigned_mode: 'sheet',
      mode_source: 'override',
      cms_mode: 'ab',
      share_pct: 30,
    });
    // Remontage de la section dans le même chargement de page : pas de doublon.
    unmount();
    renderPage({ ctaMode: 'ab', sheetSharePct: 30 });
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    expect(exposureCalls()).toHaveLength(1);
  });

  it('réglage fixe : origine cms ; angle publicitaire lu sur data-kit-angle', async () => {
    const hero = document.createElement('section');
    hero.setAttribute('data-kit-angle', 'e');
    document.body.appendChild(hero);
    renderPage({ ctaMode: 'scroll', sheetSharePct: 50 });
    await waitFor(() => expect(exposureCalls()).toHaveLength(1));
    expect(exposureCalls()[0]![1]).toEqual({
      assigned_mode: 'scroll',
      mode_source: 'cms',
      cms_mode: 'scroll',
      share_pct: 50,
      kit_angle: 'e',
    });
    hero.remove();
  });

  it('images par audience : hero_media_variant/level lus sur le hero', async () => {
    const hero = document.createElement('section');
    hero.setAttribute('data-kit-angle', 'e');
    hero.setAttribute('data-hero-media-variant', 'angle-e.ar.v3');
    hero.setAttribute('data-hero-media-level', '1');
    document.body.appendChild(hero);
    renderPage({ ctaMode: 'scroll', sheetSharePct: 50 });
    await waitFor(() => expect(exposureCalls()).toHaveLength(1));
    expect(exposureCalls()[0]![1]).toEqual({
      assigned_mode: 'scroll',
      mode_source: 'cms',
      cms_mode: 'scroll',
      share_pct: 50,
      kit_angle: 'e',
      hero_media_variant: 'angle-e.ar.v3',
      hero_media_level: 1,
    });
    hero.remove();
  });
});

describe('KitCommanderSection — clic avant la synchronisation du mode', () => {
  it('A/B à 100 % : le clic ouvre le panneau (variante attribuée), variantKey B', async () => {
    search.suspend = true;
    renderPage({ ctaMode: 'ab', sheetSharePct: 100 });
    // La synchronisation (sous Suspense) n'a pas eu lieu : rien n'est résolu.
    expect(useCommanderLauncherStore.getState().assignment).toBeNull();
    fireEvent.click(cta());
    const dialog = await screen.findByRole('dialog', { name: 'Commander le rituel' });
    expect(arriveAtCommander).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'add_to_cart',
      expect.objectContaining({ kit_cta_mode: 'sheet' }),
    );
    expect(useCommanderLauncherStore.getState().assignment).toMatchObject({
      mode: 'sheet',
      source: 'ab',
    });
    expect(within(dialog).getByTestId('wizard-shell')).toHaveAttribute('data-variant-key', 'B');
  });

  it('?cta=scroll dans l’URL : le clic défile, variantKey A', () => {
    search.suspend = true;
    window.history.replaceState(null, '', '/kit?cta=scroll');
    renderPage({ ctaMode: 'sheet', sheetSharePct: 50 });
    fireEvent.click(cta());
    expect(arriveAtCommander).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(section()).getByTestId('wizard-shell')).toHaveAttribute('data-variant-key', 'A');
  });
});

describe('KitCommanderSection — emplacement réservé (hauteur)', () => {
  it('reprend la hauteur réelle mesurée de la carte en ligne', async () => {
    const original = Element.prototype.getBoundingClientRect;
    const rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (this.getAttribute('data-testid') === 'kit-commander-card') {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 600,
            bottom: 712.4,
            width: 600,
            height: 712.4,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return original.call(this);
      });
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    fireEvent.click(cta());
    await screen.findByRole('dialog');
    const card = within(section()).getByTestId('kit-commander-card');
    expect(card.style.minHeight).toBe('712px');
    expect(within(card).getByTestId('kit-commander-sheet-placeholder')).toBeInTheDocument();
    rectSpy.mockRestore();
  });

  it('carte non mesurable : hauteur minimale de repli, aucun style figé', async () => {
    search.value = 'cta=sheet';
    renderPage();
    await waitFor(() => expect(section()).toHaveAttribute('data-commander-mode', 'sheet'));
    fireEvent.click(cta());
    await screen.findByRole('dialog');
    const card = within(section()).getByTestId('kit-commander-card');
    expect(card.style.minHeight).toBe('');
    expect(within(card).getByTestId('kit-commander-sheet-placeholder').className).toContain(
      'min-h-[16rem]',
    );
  });
});
