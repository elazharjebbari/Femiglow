import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PivotBanner } from './PivotBanner';
import { mockRituel } from '@/data/mock/rituel';
import { expectNoAxeViolations } from '@/test/axe';

describe('PivotBanner', () => {
  it('rend la phrase pivot et un CTA vers le kit', () => {
    render(<PivotBanner data={mockRituel.pivot} />);
    expect(screen.getByText(mockRituel.pivot.phrase)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: mockRituel.pivot.cta.label });
    expect(cta).toHaveAttribute('href', mockRituel.pivot.cta.href);
  });

  it('respecte axe', async () => {
    const { container } = render(<PivotBanner data={mockRituel.pivot} />);
    await expectNoAxeViolations(container);
  });
});
