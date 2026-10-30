/**
 * Tests `CommanderAnchorButton` — variantes accent + source pack.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import { CommanderAnchorButton } from './CommanderAnchorButton';

const emitMock = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: { analytics: 'granted' } }),
}));

beforeEach(() => {
  emitMock.mockReset();
  // Ancre cible présente dans le DOM pour éviter scrollIntoView no-op.
  const target = document.createElement('div');
  target.id = 'commander-femiglow';
  document.body.appendChild(target);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('CommanderAnchorButton — accent', () => {
  it('rend sans accent → pas de data-cta-accent', () => {
    render(<CommanderAnchorButton>Commander</CommanderAnchorButton>);
    const btn = screen.getByTestId('kit-commander-anchor-button');
    expect(btn.getAttribute('data-cta-accent')).toBeNull();
    // Pas de classe override accent
    expect(btn.className).not.toContain('bg-sauge-dark');
  });

  it('accent=sauge-dark → data-cta-accent + classes bg-sauge-dark + animate-soft-pulse', () => {
    render(
      <CommanderAnchorButton accent="sauge-dark">
        Commander le rituel
      </CommanderAnchorButton>,
    );
    const btn = screen.getByTestId('kit-commander-anchor-button');
    expect(btn.getAttribute('data-cta-accent')).toBe('sauge-dark');
    expect(btn.className).toContain('!bg-sauge-dark');
    expect(btn.className).toContain('motion-safe:animate-soft-pulse');
  });

  it('accent=terracotta → bg-[#C28A6E]', () => {
    render(
      <CommanderAnchorButton accent="terracotta">Soutien</CommanderAnchorButton>,
    );
    expect(
      screen.getByTestId('kit-commander-anchor-button').className,
    ).toContain('!bg-[#C28A6E]');
  });
});

describe('CommanderAnchorButton — source tracking', () => {
  it('sans source → seul add_to_cart émis (cas legacy)', () => {
    render(
      <CommanderAnchorButton
        productId="p1"
        productName="Kit"
        priceCents={3500}
        currency="EUR"
      >
        Commander
      </CommanderAnchorButton>,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    const events = emitMock.mock.calls.map((c) => c[0]);
    expect(events).toContain('add_to_cart');
    expect(events).not.toContain('pack_cta_click');
  });

  it('source=pack_section → émet aussi pack_cta_click', () => {
    render(
      <CommanderAnchorButton
        productId="p1"
        productName="Kit"
        priceCents={3500}
        currency="EUR"
        source="pack_section"
        accent="sauge-dark"
        trackingLabel="Commander le rituel"
      >
        Commander le rituel
      </CommanderAnchorButton>,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    const events = emitMock.mock.calls.map((c) => c[0]);
    expect(events).toContain('add_to_cart');
    expect(events).toContain('pack_cta_click');
    const packCall = emitMock.mock.calls.find(
      (c) => c[0] === 'pack_cta_click',
    );
    expect(packCall?.[1]).toMatchObject({
      source: 'pack_section',
      cta_label: 'Commander le rituel',
      cta_accent: 'sauge-dark',
    });
  });

  it('source=pack_section sans accent → cta_accent=default', () => {
    render(
      <CommanderAnchorButton source="pack_section">CTA</CommanderAnchorButton>,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    const packCall = emitMock.mock.calls.find(
      (c) => c[0] === 'pack_cta_click',
    );
    expect(packCall?.[1]).toMatchObject({ cta_accent: 'default' });
  });
});

describe('CommanderAnchorButton — Kit CRO v2 §4 : gabarit du libellé', () => {
  it('remplit {price} avec le prix net passé (FR : DH)', () => {
    render(
      <CommanderAnchorButton
        priceCents={9900}
        currency="MAD"
        labelTemplate="Je commande — {price}"
      />,
    );
    expect(screen.getByTestId('kit-commander-anchor-button').textContent).toBe(
      'Je commande — 99 DH',
    );
  });

  it('EN : MAD ; AR : درهم', () => {
    const { unmount } = render(
      <CommanderAnchorButton
        priceCents={19900}
        currency="MAD"
        priceLocale="en"
        labelTemplate="Order now — {price}"
      />,
    );
    expect(screen.getByTestId('kit-commander-anchor-button').textContent).toBe(
      'Order now — 199 MAD',
    );
    unmount();
    render(
      <CommanderAnchorButton
        priceCents={9900}
        currency="MAD"
        priceLocale="ar"
        labelTemplate="اطلبي الآن — {price}"
      />,
    );
    expect(screen.getByTestId('kit-commander-anchor-button').textContent).toBe(
      'اطلبي الآن — 99 درهم',
    );
  });

  it('sans prix : le segment « — {price} » disparaît proprement', () => {
    render(<CommanderAnchorButton labelTemplate="Je commande — {price}" />);
    expect(screen.getByTestId('kit-commander-anchor-button').textContent).toBe('Je commande');
  });

  it('le gabarit prime sur children et label', () => {
    render(
      <CommanderAnchorButton labelTemplate="Je commande" label="Commander">
        Ancien libellé
      </CommanderAnchorButton>,
    );
    expect(screen.getByTestId('kit-commander-anchor-button').textContent).toBe('Je commande');
  });

  it('pack_cta_click : cta_label = gabarit quand trackingLabel est absent', () => {
    render(
      <CommanderAnchorButton
        productId="p1"
        productName="Kit"
        priceCents={9900}
        currency="MAD"
        source="pack_section"
        labelTemplate="Je commande — {price}"
      />,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    const pack = emitMock.mock.calls.find((c) => c[0] === 'pack_cta_click');
    expect(pack?.[1]).toMatchObject({ cta_label: 'Je commande — {price}' });
  });
});

describe('CommanderAnchorButton — Kit CRO v2 §3 : kit_angle', () => {
  function clickWithAngle(angle: string | null): unknown[][] {
    if (angle !== null) {
      const hero = document.createElement('section');
      hero.setAttribute('data-kit-angle', angle);
      document.body.appendChild(hero);
    }
    render(
      <CommanderAnchorButton
        productId="p1"
        productName="Kit"
        priceCents={9900}
        currency="MAD"
        source="pack_section"
      >
        Je commande
      </CommanderAnchorButton>,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    return emitMock.mock.calls;
  }

  it('ajoute kit_angle à add_to_cart et pack_cta_click (angle posé par le hero)', () => {
    const calls = clickWithAngle('e');
    const addToCart = calls.find((c) => c[0] === 'add_to_cart');
    const pack = calls.find((c) => c[0] === 'pack_cta_click');
    expect(addToCart?.[1]).toMatchObject({ kit_angle: 'e' });
    expect(pack?.[1]).toMatchObject({ kit_angle: 'e' });
  });

  it('kit_angle=none sur /kit sans angle', () => {
    const calls = clickWithAngle('none');
    expect(calls.find((c) => c[0] === 'add_to_cart')?.[1]).toMatchObject({ kit_angle: 'none' });
  });

  it('hors /kit (aucun attribut) : pas de kit_angle', () => {
    const calls = clickWithAngle(null);
    expect(calls.find((c) => c[0] === 'add_to_cart')?.[1]).not.toHaveProperty('kit_angle');
  });
});

describe('CommanderAnchorButton — images par audience : hero_media_variant', () => {
  function clickWithHero(attrs: Record<string, string> | null): unknown[][] {
    const hero = document.createElement('section');
    hero.setAttribute('data-kit-angle', 'e');
    for (const [k, v] of Object.entries(attrs ?? {})) hero.setAttribute(k, v);
    document.body.appendChild(hero);
    render(
      <CommanderAnchorButton
        productId="p1"
        productName="Kit"
        priceCents={9900}
        currency="MAD"
        source="pack_section"
      >
        Je commande
      </CommanderAnchorButton>,
    );
    fireEvent.click(screen.getByTestId('kit-commander-anchor-button'));
    hero.remove();
    return emitMock.mock.calls;
  }

  it('ajoute hero_media_variant/level à add_to_cart et pack_cta_click', () => {
    const calls = clickWithHero({
      'data-hero-media-variant': 'angle-e.fr.v2',
      'data-hero-media-level': '1',
    });
    const expected = { kit_angle: 'e', hero_media_variant: 'angle-e.fr.v2', hero_media_level: 1 };
    expect(calls.find((c) => c[0] === 'add_to_cart')?.[1]).toMatchObject(expected);
    expect(calls.find((c) => c[0] === 'pack_cta_click')?.[1]).toMatchObject(expected);
  });

  it('drapeau coupé (aucun attribut) : paramètres absents', () => {
    const calls = clickWithHero(null);
    for (const name of ['add_to_cart', 'pack_cta_click']) {
      const params = calls.find((c) => c[0] === name)?.[1];
      expect(params).not.toHaveProperty('hero_media_variant');
      expect(params).not.toHaveProperty('hero_media_level');
    }
  });
});
