/**
 * RTL — AnimationProfileSelector.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { AnimationProfileSelector } from './AnimationProfileSelector';
import type {
  ComponentAnimation,
  ComponentAnimationBindingWithAnimation,
} from '@/lib/db/types';

function makeAnimation(partial: Partial<ComponentAnimation>): ComponentAnimation {
  return {
    id: 'anm_1',
    key: 'fade-in',
    name: 'Fade-in',
    kind: 'framer-motion',
    description: 'Opacity 0→1.',
    config: {},
    respectsReducedMotion: true,
    previewSnippet: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  };
}

const FADE = makeAnimation({ id: 'anm_fade', key: 'fade-in', name: 'Fade-in' });
const REVEAL = makeAnimation({
  id: 'anm_reveal',
  key: 'reveal-up',
  name: 'Reveal-up',
});
const NONE = makeAnimation({
  id: 'anm_none',
  key: 'none',
  name: 'Aucune',
  kind: 'none',
  description: null,
});

function bindingFor(
  anim: ComponentAnimation,
  isDefault: boolean,
): ComponentAnimationBindingWithAnimation {
  return {
    id: `b_${anim.id}`,
    componentId: 'cmp_1',
    animationId: anim.id,
    isDefault,
    params: {},
    createdAt: new Date(0),
    animation: anim,
  };
}

describe('AnimationProfileSelector', () => {
  it('affiche tous les profils dans un radiogroup', () => {
    render(
      <AnimationProfileSelector
        allAnimations={[NONE, FADE, REVEAL]}
        bindings={[]}
        busy={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: /profil d’animation/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('marque comme aria-checked le profil par défaut', () => {
    render(
      <AnimationProfileSelector
        allAnimations={[NONE, FADE]}
        bindings={[bindingFor(FADE, true)]}
        busy={false}
        onSelect={() => {}}
      />,
    );
    const fade = screen.getByRole('radio', { name: /fade-in/i });
    expect(fade).toHaveAttribute('aria-checked', 'true');
    expect(fade).toBeDisabled(); // déjà actif → ne peut pas re-cliquer
    const none = screen.getByRole('radio', { name: /aucune/i });
    expect(none).toHaveAttribute('aria-checked', 'false');
  });

  it('clic sur un profil non-actif appelle onSelect(key)', () => {
    const onSelect = vi.fn();
    render(
      <AnimationProfileSelector
        allAnimations={[NONE, FADE, REVEAL]}
        bindings={[bindingFor(FADE, true)]}
        busy={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /reveal-up/i }));
    expect(onSelect).toHaveBeenCalledWith('reveal-up');
  });

  it('busy=true désactive les boutons non actifs aussi', () => {
    render(
      <AnimationProfileSelector
        allAnimations={[NONE, FADE]}
        bindings={[bindingFor(FADE, true)]}
        busy
        onSelect={() => {}}
      />,
    );
    for (const r of screen.getAllByRole('radio')) {
      expect(r).toBeDisabled();
    }
  });

  it('affiche un état vide si allAnimations=[]', () => {
    render(
      <AnimationProfileSelector
        allAnimations={[]}
        bindings={[]}
        busy={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/aucun profil d’animation disponible/i)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <AnimationProfileSelector
        allAnimations={[NONE, FADE]}
        bindings={[bindingFor(FADE, true)]}
        busy={false}
        onSelect={() => {}}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
