/**
 * Tests `NumberBadge` — pastille numérotée de la section « La composition ».
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { NumberBadge } from './NumberBadge';

describe('NumberBadge', () => {
  it('rend le label', () => {
    render(<NumberBadge label="01" hex="#A8B89E" />);
    expect(screen.getByText('01')).toBeDefined();
  });

  it('applique aria-hidden (décoratif)', () => {
    render(<NumberBadge label="01" hex="#A8B89E" />);
    expect(screen.getByTestId('composition-number-badge').getAttribute('aria-hidden')).toBe('true');
  });

  it('applique la couleur via style inline (text + ring shadow)', () => {
    render(<NumberBadge label="02" hex="#F2CECC" />);
    const el = screen.getByTestId('composition-number-badge') as HTMLElement;
    expect(el.style.color).toBe('rgb(242, 206, 204)');
    // jsdom préserve le format hex 8-digit (`#F2CECC40` = couleur + alpha 25 %)
    // tel quel dans `style.boxShadow`. On vérifie la présence du token hex
    // sans préjuger du format CSS (rgba vs hex8).
    expect(el.style.boxShadow.toLowerCase()).toContain('#f2cecc');
  });

  it('accepte un className additionnel', () => {
    render(<NumberBadge label="03" hex="#C5DBE5" className="extra-cls" />);
    expect(screen.getByTestId('composition-number-badge').className).toContain('extra-cls');
  });
});
