import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCommanderLauncherStore } from '@/lib/checkout/commander-launcher';

import { StepActionBar } from './StepActionBar';
import { WizardScrollContainerProvider } from './wizard-scroll-container';

let keyboardInset = 0;
let onScreen = true;
vi.mock('@/components/chat/hooks/use-visual-viewport', () => ({
  useVisualViewportKeyboardInset: () => keyboardInset,
}));
vi.mock('@/lib/checkout/use-commander-on-screen', () => ({
  useCommanderOnScreen: () => onScreen,
}));

const bar = () => screen.getByTestId('wizard-action-bar');

beforeEach(() => {
  keyboardInset = 0;
  onScreen = true;
  useCommanderLauncherStore.setState({ actionBarActive: false });
});
afterEach(() => useCommanderLauncherStore.setState({ actionBarActive: false }));

describe('StepActionBar', () => {
  it('formulaire à l’écran : visible et fixée, le bouton de chat s’efface', () => {
    render(<StepActionBar>{() => <button>Ok</button>}</StepActionBar>);
    expect(bar()).toHaveAttribute('data-visible', 'true');
    expect(bar().className).toContain('fixed');
    expect(useCommanderLauncherStore.getState().actionBarActive).toBe(true);
  });

  it('cliente remontée dans la page : pas de seconde barre', () => {
    onScreen = false;
    render(<StepActionBar>{() => <button>Ok</button>}</StepActionBar>);
    expect(bar()).toHaveAttribute('data-visible', 'false');
    expect(useCommanderLauncherStore.getState().actionBarActive).toBe(false);
  });

  it('quittée : rend sa place au bouton de chat', () => {
    const { unmount } = render(<StepActionBar>{() => <button>Ok</button>}</StepActionBar>);
    act(() => unmount());
    expect(useCommanderLauncherStore.getState().actionBarActive).toBe(false);
  });

  it('clavier ouvert : remonte de sa hauteur et le signale au contenu', () => {
    keyboardInset = 300;
    render(
      <StepActionBar>
        {({ keyboardOpen }) => <span>{keyboardOpen ? 'clavier' : 'libre'}</span>}
      </StepActionBar>,
    );
    expect(bar().style.transform).toBe('translateY(-300px)');
    expect(screen.getByText('clavier')).toBeInTheDocument();
  });

  it('variation de barre d’adresse : ce n’est pas un clavier', () => {
    keyboardInset = 56;
    render(
      <StepActionBar>
        {({ keyboardOpen }) => <span>{keyboardOpen ? 'clavier' : 'libre'}</span>}
      </StepActionBar>,
    );
    expect(screen.getByText('libre')).toBeInTheDocument();
  });

  it('recherche de ville au clavier : barre masquée', () => {
    keyboardInset = 300;
    render(<StepActionBar hideWithKeyboard>{() => <button>Ok</button>}</StepActionBar>);
    expect(bar()).toHaveAttribute('data-visible', 'false');
  });

  it('dans le panneau : collée en bas, sans décalage ni effet sur le chat', () => {
    keyboardInset = 300;
    render(
      <WizardScrollContainerProvider getContainer={() => null}>
        <StepActionBar>{() => <button>Ok</button>}</StepActionBar>
      </WizardScrollContainerProvider>,
    );
    expect(bar().className).toContain('sticky');
    expect(bar().style.transform).toBe('');
    expect(useCommanderLauncherStore.getState().actionBarActive).toBe(false);
  });
});
