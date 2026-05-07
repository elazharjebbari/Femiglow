import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DirectContactBlock } from './DirectContactBlock';
import { expectNoAxeViolations } from '@/test/axe';

describe('DirectContactBlock', () => {
  it('rend l\u2019email cliquable, l\u2019adresse et le quartier', () => {
    render(
      <DirectContactBlock
        email="contact@femiglow.ma"
        streetAddress="14 rue des Acacias"
        district="Bourgogne, Casablanca"
      />,
    );
    expect(screen.getByRole('link', { name: /contact@femiglow\.ma/i })).toHaveAttribute(
      'href',
      'mailto:contact@femiglow.ma?subject=Bonjour',
    );
    expect(screen.getByText(/14 rue des Acacias/i)).toBeInTheDocument();
    expect(screen.getByText(/Bourgogne, Casablanca/i)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <DirectContactBlock
        email="contact@femiglow.ma"
        streetAddress="14 rue des Acacias"
        district="Bourgogne, Casablanca"
      />,
    );
    await expectNoAxeViolations(container);
  });
});
