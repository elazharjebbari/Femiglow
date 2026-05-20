/**
 * Tests `ValueBreakdownList` — composant Server pur (aucun hook).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ValueBreakdownList } from './ValueBreakdownList';

afterEach(() => cleanup());

describe('ValueBreakdownList', () => {
  it('retourne null si items vide', () => {
    const { container } = render(<ValueBreakdownList items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('rend un <ul> avec aria-label par défaut', () => {
    render(<ValueBreakdownList items={[{ label: 'A', valueLabel: '1 €' }]} />);
    const ul = screen.getByRole('list');
    expect(ul.getAttribute('aria-label')).toContain('valeur');
  });

  it('rend chaque item avec label + valueLabel', () => {
    render(
      <ValueBreakdownList
        items={[
          { label: '1 Paste · 30 ml', valueLabel: '19 €' },
          { label: '2 Powder · 30 g', valueLabel: '14 €' },
        ]}
      />,
    );
    expect(screen.getByText('1 Paste · 30 ml')).toBeDefined();
    expect(screen.getByText('19 €')).toBeDefined();
    expect(screen.getByText('2 Powder · 30 g')).toBeDefined();
    expect(screen.getByText('14 €')).toBeDefined();
  });

  it('items muted reçoivent les classes italique + opacity', () => {
    render(
      <ValueBreakdownList
        items={[
          { label: 'Bonus', valueLabel: 'offert', muted: true },
        ]}
      />,
    );
    const item = screen.getByTestId('pack-value-item-0');
    expect(item.className).toContain('italic');
    expect(item.className).toContain('opacity-60');
  });

  it('items non-muted sont en font-medium', () => {
    render(
      <ValueBreakdownList items={[{ label: 'X', valueLabel: '9 €' }]} />,
    );
    const valueSpan = screen.getByText('9 €');
    expect(valueSpan.className).toContain('font-medium');
  });

  it('override ariaLabel via prop', () => {
    render(
      <ValueBreakdownList
        items={[{ label: 'A', valueLabel: '1 €' }]}
        ariaLabel="Custom aria label"
      />,
    );
    expect(screen.getByLabelText('Custom aria label')).toBeDefined();
  });
});
