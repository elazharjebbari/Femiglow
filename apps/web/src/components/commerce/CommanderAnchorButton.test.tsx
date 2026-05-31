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
