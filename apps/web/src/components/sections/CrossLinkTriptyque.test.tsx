import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrossLinkTriptyque } from './CrossLinkTriptyque';
import { mockMaison } from '@/data/mock/maison';
import { expectNoAxeViolations } from '@/test/axe';

describe('CrossLinkTriptyque', () => {
  it('rend 3 liens vers /rituel, /journal, /kit', () => {
    render(<CrossLinkTriptyque links={mockMaison.crossLinks} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/rituel', '/journal', '/kit']));
  });

  it('rend chaque carte avec un kicker et un h3 cliquables', () => {
    render(<CrossLinkTriptyque links={mockMaison.crossLinks} />);
    expect(screen.getByRole('heading', { level: 3, name: /lire le rituel/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /^Le journal/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /voir le kit/i })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <CrossLinkTriptyque links={mockMaison.crossLinks} />,
    );
    await expectNoAxeViolations(container);
  });
});
