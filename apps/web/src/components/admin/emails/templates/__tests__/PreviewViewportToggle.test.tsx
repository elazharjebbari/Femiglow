// @vitest-environment jsdom
/**
 * F07 P3.4-k (Lot 3) — contrôle segmenté Bureau/Mobile de l'aperçu.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  PreviewViewportToggle,
  PREVIEW_VIEWPORTS,
  viewportWidth,
} from '../PreviewViewportToggle';

afterEach(() => vi.clearAllMocks());

describe('F07 — PreviewViewportToggle', () => {
  it('F07-U-120 — viewportWidth : Bureau pleine largeur (null), Mobile borné', () => {
    expect(viewportWidth('desktop')).toBeNull();
    expect(viewportWidth('mobile')).toBe(390);
    // La table reste l'unique source (pas de magie dans le composant).
    expect(PREVIEW_VIEWPORTS.map((v) => v.id)).toEqual(['desktop', 'mobile']);
  });

  it('F07-C-028 — rend les 2 options, aria-pressed reflète la valeur', () => {
    render(<PreviewViewportToggle value="desktop" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: /Largeur d’aperçu/ });
    expect(within(group).getByRole('button', { name: 'Bureau' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Mobile' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('F07-C-029 — un clic émet le viewport choisi', () => {
    const onChange = vi.fn();
    render(<PreviewViewportToggle value="desktop" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(onChange).toHaveBeenCalledWith('mobile');
  });
});
