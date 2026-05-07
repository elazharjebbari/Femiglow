import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QuantitySelector } from './QuantitySelector';
import { expectNoAxeViolations } from '@/test/axe';

describe('QuantitySelector', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appelle onChange avec valeur incr\u00e9ment\u00e9e apr\u00e8s debounce', () => {
    const onChange = vi.fn();
    render(
      <QuantitySelector
        value={2}
        onChange={onChange}
        productName="Pot d\u2019or"
        productId="pot-or"
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /augmenter la quantit\u00e9 de pot/i }),
    );
    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('clampe \u00e0 1 minimum (bouton d\u00e9sactiv\u00e9)', () => {
    const onChange = vi.fn();
    render(
      <QuantitySelector
        value={1}
        onChange={onChange}
        productName="Pot"
        productId="pot"
      />,
    );
    const decrement = screen.getByRole('button', { name: /diminuer/i });
    expect(decrement).toBeDisabled();
  });

  it('clampe \u00e0 99 maximum (bouton d\u00e9sactiv\u00e9)', () => {
    const onChange = vi.fn();
    render(
      <QuantitySelector
        value={99}
        onChange={onChange}
        productName="Pot"
        productId="pot"
      />,
    );
    const increment = screen.getByRole('button', { name: /augmenter/i });
    expect(increment).toBeDisabled();
  });

  it('respecte axe', async () => {
    vi.useRealTimers();
    const { container } = render(
      <QuantitySelector
        value={2}
        onChange={() => {}}
        productName="Pot"
        productId="pot"
      />,
    );
    await expectNoAxeViolations(container);
  });
});
