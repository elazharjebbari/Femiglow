/**
 * ValueBreakdownList — prop `creditLine` (ligne de réduction crédit fidélité).
 * Unit pur : rendu, accent terracotta, absence si null, rendu même sans items.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValueBreakdownList } from './ValueBreakdownList';
import type { ProductFeedValueItem } from '@/lib/products/feed/types';

const items: ProductFeedValueItem[] = [
  { label: '1 Paste', valueLabel: '116 MAD' },
  { label: 'Livraison', valueLabel: 'offert', muted: true },
];

describe('ValueBreakdownList — creditLine', () => {
  it('VBL-C001 sans creditLine : pas de ligne de réduction', () => {
    render(<ValueBreakdownList items={items} />);
    expect(screen.queryByTestId('pack-value-credit-line')).toBeNull();
  });

  it('VBL-C002 avec creditLine : ligne rendue (label + valeur)', () => {
    render(
      <ValueBreakdownList items={items} creditLine={{ label: 'Crédit de fidélité', valueLabel: '−20 MAD' }} />,
    );
    const line = screen.getByTestId('pack-value-credit-line');
    expect(line).toHaveTextContent('Crédit de fidélité');
    expect(line).toHaveTextContent('−20 MAD');
  });

  it('VBL-C003 valeur de la réduction en accent terracotta #C28A6E', () => {
    render(
      <ValueBreakdownList items={items} creditLine={{ label: 'Crédit', valueLabel: '−20 MAD' }} />,
    );
    const valueSpan = screen.getByText('−20 MAD');
    expect(valueSpan.className).toContain('#C28A6E');
  });

  it('VBL-C004 rendu même si items vide (crédit seul)', () => {
    render(<ValueBreakdownList items={[]} creditLine={{ label: 'Crédit', valueLabel: '−20 MAD' }} />);
    expect(screen.getByTestId('pack-value-credit-line')).toBeInTheDocument();
  });

  it('VBL-C005 null si ni items ni creditLine', () => {
    const { container } = render(<ValueBreakdownList items={[]} creditLine={null} />);
    expect(container.firstChild).toBeNull();
  });
});
