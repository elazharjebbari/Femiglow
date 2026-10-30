/**
 * Kit CRO v2 §2 — `BottomSheet` : accessibilité (Radix Dialog), fermetures
 * (Échap, fond, croix, bouton retour), historique, animation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { BOTTOM_SHEET_HISTORY_FLAG, BottomSheet, type BottomSheetProps } from './BottomSheet';

type HarnessProps = Partial<Omit<BottomSheetProps, 'open' | 'onOpenChange'>> & {
  initialOpen?: boolean;
  onOpenChangeSpy?: (open: boolean) => void;
};

/** Panneau contrôlé + bouton déclencheur (retour du focus). */
function Harness({ initialOpen = false, onOpenChangeSpy, ...props }: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <button type="button" onClick={() => setOpen(false)} data-testid="external-close">
        Fermer depuis l’extérieur
      </button>
      <BottomSheet
        title="Commander le rituel"
        closeLabel="Fermer le formulaire de commande"
        {...props}
        open={open}
        onOpenChange={(next) => {
          onOpenChangeSpy?.(next);
          setOpen(next);
        }}
      >
        {props.children ?? (
          <form>
            <label>
              Prénom
              <input name="firstName" />
            </label>
          </form>
        )}
      </BottomSheet>
    </>
  );
}

/** Radix n'écoute les clics extérieurs qu'après un tick. */
async function flushRadix() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

let backSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
});

afterEach(async () => {
  // Démontage panneau ouvert → `back()` différé d'une tâche : on le laisse
  // partir ici pour qu'il ne fuie pas dans le test suivant.
  cleanup();
  await new Promise((r) => setTimeout(r, 5));
  backSpy.mockRestore();
  window.history.replaceState(null, '');
});

describe('BottomSheet — rendu et accessibilité', () => {
  it('fermé : rien dans le DOM', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ouvert : role=dialog nommé par le titre, aria-modal, focus à l’intérieur', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Commander le rituel' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // Pas de clavier virtuel ouvert d'office : le focus n'est pas dans un champ.
    expect(document.activeElement?.tagName).not.toBe('INPUT');
  });

  it('bouton de fermeture visible avec aria-label localisé', async () => {
    render(<Harness initialOpen closeLabel="إغلاق نموذج الطلب" dir="rtl" />);
    const close = await screen.findByRole('button', { name: 'إغلاق نموذج الطلب' });
    expect(close).toBeVisible();
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'rtl');
  });

  it('description optionnelle reliée par aria-describedby', async () => {
    render(<Harness initialOpen description="Paiement à la livraison" />);
    const dialog = await screen.findByRole('dialog');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe('Paiement à la livraison');
  });

  it('z-index du token modal + conteneur de défilement exposé', async () => {
    const bodyRef = { current: null as HTMLDivElement | null };
    render(
      <BottomSheet ref={bodyRef} open onOpenChange={() => undefined} title="T" closeLabel="Fermer">
        <p>contenu</p>
      </BottomSheet>,
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.style.zIndex).toBe('var(--z-modal)');
    expect(bodyRef.current).toBe(screen.getByTestId('bottom-sheet-body'));
    expect(bodyRef.current?.className).toContain('overflow-y-auto');
  });

  it('animation désactivée sous prefers-reduced-motion', async () => {
    render(<Harness initialOpen />);
    await screen.findByRole('dialog');
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    expect(css).toMatch(/@keyframes fg-sheet-up/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation: none/);
  });
});

describe('BottomSheet — fermetures', () => {
  it('Échap ferme le panneau et rend le focus au déclencheur', async () => {
    const spy = vi.fn();
    render(<Harness onOpenChangeSpy={spy} />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(spy).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('clic sur le fond ferme le panneau', async () => {
    const spy = vi.fn();
    render(<Harness initialOpen onOpenChangeSpy={spy} />);
    await screen.findByRole('dialog');
    await flushRadix();
    fireEvent.pointerDown(screen.getByTestId('bottom-sheet-overlay'));
    expect(spy).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('clic sur un toast (au-dessus du panneau) ne ferme pas', async () => {
    const spy = vi.fn();
    const region = document.createElement('div');
    region.setAttribute('data-toast-region', '');
    const toast = document.createElement('div');
    region.appendChild(toast);
    document.body.appendChild(region);
    render(<Harness initialOpen onOpenChangeSpy={spy} />);
    await screen.findByRole('dialog');
    await flushRadix();
    fireEvent.pointerDown(toast);
    expect(spy).not.toHaveBeenCalled();
    region.remove();
  });

  it('bouton de fermeture', async () => {
    const spy = vi.fn();
    render(<Harness initialOpen onOpenChangeSpy={spy} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Fermer le formulaire de commande' }),
    );
    expect(spy).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('onExitComplete après le démontage du contenu', async () => {
    const onExitComplete = vi.fn();
    render(<Harness initialOpen onExitComplete={onExitComplete} />);
    await screen.findByRole('dialog');
    expect(onExitComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le formulaire de commande' }));
    await waitFor(() => expect(onExitComplete).toHaveBeenCalledTimes(1));
  });
});

describe('BottomSheet — historique (bouton retour)', () => {
  it('ouverture : pushState d’une entrée marquée, en conservant l’état existant (Next)', async () => {
    window.history.replaceState({ __NA: true, tree: 'x' }, '');
    const pushSpy = vi.spyOn(window.history, 'pushState');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    await screen.findByRole('dialog');
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]![0]).toEqual({
      __NA: true,
      tree: 'x',
      [BOTTOM_SHEET_HISTORY_FLAG]: true,
    });
    // Pas d'URL : l'adresse (hash compris) ne change pas.
    expect(pushSpy.mock.calls[0]).toHaveLength(2);
    pushSpy.mockRestore();
  });

  it('popstate (bouton retour) ferme sans rappeler history.back()', async () => {
    const spy = vi.fn();
    render(<Harness initialOpen onOpenChangeSpy={spy} />);
    await screen.findByRole('dialog');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(spy).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('fermeture par l’interface : history.back() une seule fois', async () => {
    render(<Harness initialOpen />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Fermer le formulaire de commande' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backSpy).toHaveBeenCalledTimes(1);
    // Un popstate ultérieur (celui de notre back()) n'a plus d'effet.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('fermeture pilotée par le parent (open=false) : history.back()', async () => {
    render(<Harness initialOpen />);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByTestId('external-close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('popstate sans entrée poussée par nous : ignoré', () => {
    const spy = vi.fn();
    render(<Harness onOpenChangeSpy={spy} />);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('syncHistory=false : aucune écriture d’historique', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    render(<Harness initialOpen syncHistory={false} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Fermer le formulaire de commande' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(pushSpy).not.toHaveBeenCalled();
    expect(backSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });

  it('démontage panneau ouvert : retire l’entrée poussée', async () => {
    const { unmount } = render(<Harness initialOpen />);
    await screen.findByRole('dialog');
    unmount();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
