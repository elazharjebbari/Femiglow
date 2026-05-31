/**
 * Tests `InciTooltip` — popover textuel sur bouton ⓘ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));

import { InciTooltip } from './InciTooltip';

beforeEach(() => emitMock.mockReset());
afterEach(() => cleanup());

describe('InciTooltip — rendu', () => {
  it('rend un bouton avec aria-label « Définition de … »', () => {
    render(
      <InciTooltip
        inciTerm="Cera Alba"
        definition="Cire d'abeille pure."
        subProductId="1-paste"
      />,
    );
    const btn = screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-label')).toBe('Définition de Cera Alba');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('ne rend pas le popover par défaut', () => {
    render(
      <InciTooltip
        inciTerm="Cera Alba"
        definition="Cire d'abeille pure."
        subProductId="1-paste"
      />,
    );
    expect(
      screen.queryByTestId('inci-tooltip-popover-1-paste-Cera Alba'),
    ).toBeNull();
  });
});

describe('InciTooltip — ouverture', () => {
  it('click bouton ouvre le popover et passe aria-expanded à true', () => {
    render(
      <InciTooltip
        inciTerm="Cera Alba"
        definition="Cire d'abeille pure."
        subProductId="1-paste"
      />,
    );
    fireEvent.click(screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba'));
    const popover = screen.getByTestId('inci-tooltip-popover-1-paste-Cera Alba');
    expect(popover).toBeDefined();
    expect(popover.getAttribute('role')).toBe('tooltip');
    expect(
      screen
        .getByTestId('inci-tooltip-trigger-1-paste-Cera Alba')
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('popover contient terme INCI + définition', () => {
    render(
      <InciTooltip
        inciTerm="Cera Alba"
        definition="Cire d'abeille pure. Filme l'ongle."
        subProductId="1-paste"
      />,
    );
    fireEvent.click(screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba'));
    const popover = screen.getByTestId('inci-tooltip-popover-1-paste-Cera Alba');
    expect(popover.textContent).toContain('Cera Alba');
    expect(popover.textContent).toContain('Cire d\'abeille pure');
  });

  it('click émet composition_inci_tooltip_open avec les bons params', () => {
    render(
      <InciTooltip
        inciTerm="Cera Alba"
        definition="…"
        subProductId="1-paste"
      />,
    );
    fireEvent.click(screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba'));
    expect(emitMock).toHaveBeenCalledWith('composition_inci_tooltip_open', {
      sub_product_id: '1-paste',
      inci_term: 'Cera Alba',
    });
  });

  it('n\'émet PAS l\'event à la fermeture (toggle)', () => {
    render(
      <InciTooltip
        inciTerm="Cera Alba"
        definition="…"
        subProductId="1-paste"
      />,
    );
    fireEvent.click(screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba'));
    fireEvent.click(screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba'));
    expect(emitMock).toHaveBeenCalledTimes(1);
  });
});

describe('InciTooltip — fermeture', () => {
  it('Escape ferme le popover', () => {
    render(
      <InciTooltip
        inciTerm="Cera Alba"
        definition="…"
        subProductId="1-paste"
      />,
    );
    fireEvent.click(screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba'));
    expect(
      screen.getByTestId('inci-tooltip-popover-1-paste-Cera Alba'),
    ).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByTestId('inci-tooltip-popover-1-paste-Cera Alba'),
    ).toBeNull();
  });

  it('click hors zone ferme le popover', () => {
    render(
      <div>
        <InciTooltip
          inciTerm="Cera Alba"
          definition="…"
          subProductId="1-paste"
        />
        <div data-testid="outside" style={{ height: 100, width: 100 }} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('inci-tooltip-trigger-1-paste-Cera Alba'));
    expect(
      screen.getByTestId('inci-tooltip-popover-1-paste-Cera Alba'),
    ).toBeDefined();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(
      screen.queryByTestId('inci-tooltip-popover-1-paste-Cera Alba'),
    ).toBeNull();
  });
});
