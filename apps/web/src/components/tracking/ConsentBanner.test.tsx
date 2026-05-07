import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentBanner } from './ConsentBanner';
import { expectNoAxeViolations } from '@/test/axe';

describe('ConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('rend trois boutons d\u2019action principaux', () => {
    render(<ConsentBanner />);
    expect(screen.getByRole('button', { name: /tout refuser/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /personnaliser/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tout accepter/i })).toBeInTheDocument();
  });

  it('respecte axe — vue par défaut', async () => {
    const { container } = render(<ConsentBanner />);
    await expectNoAxeViolations(container);
  });

  it('respecte axe — vue personnalisée ouverte', async () => {
    const { container } = render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: /personnaliser/i }));
    await expectNoAxeViolations(container);
  });

  it('un clic « Tout accepter » referme le bandeau', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: /tout accepter/i }));
    expect(screen.queryByRole('button', { name: /tout accepter/i })).not.toBeInTheDocument();
  });
});
