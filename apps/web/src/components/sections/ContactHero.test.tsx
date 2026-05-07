import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactHero } from './ContactHero';
import { expectNoAxeViolations } from '@/test/axe';

describe('ContactHero', () => {
  it('rend un h1 « Contact. » et un mailto cliquable', () => {
    render(<ContactHero email="contact@femiglow.ma" />);
    expect(screen.getByRole('heading', { level: 1, name: /^Contact\.$/i })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /contact@femiglow\.ma/i });
    expect(link).toHaveAttribute('href', 'mailto:contact@femiglow.ma');
  });

  it('respecte axe', async () => {
    const { container } = render(<ContactHero email="contact@femiglow.ma" />);
    await expectNoAxeViolations(container);
  });
});
