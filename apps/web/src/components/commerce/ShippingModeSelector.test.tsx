import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShippingModeSelector } from './ShippingModeSelector';
import { expectNoAxeViolations } from '@/test/axe';

const options = [
  {
    value: 'standard' as const,
    title: 'Standard',
    hint: '3 à 5 jours.',
    price: '40-60 MAD',
  },
  {
    value: 'express' as const,
    title: 'Express',
    hint: '24-48 h Casablanca.',
    price: '80 MAD',
  },
];

describe('ShippingModeSelector', () => {
  it('rend deux options radio', () => {
    render(
      <ShippingModeSelector
        options={options}
        name="shippingMode"
        value="standard"
        onChange={() => {}}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('désactive Express quand disabledExpress=true', () => {
    render(
      <ShippingModeSelector
        options={options}
        name="shippingMode"
        value="standard"
        onChange={() => {}}
        disabledExpress
      />,
    );
    const expressRadio = screen.getByRole('radio', { name: /express/i });
    expect(expressRadio).toBeDisabled();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <ShippingModeSelector
        options={options}
        name="shippingMode"
        value="standard"
        onChange={() => {}}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
