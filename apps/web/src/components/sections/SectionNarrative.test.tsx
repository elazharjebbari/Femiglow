import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionNarrative } from './SectionNarrative';
import { mockRituel } from '@/data/mock/rituel';
import { expectNoAxeViolations } from '@/test/axe';

describe('SectionNarrative', () => {
  const props = {
    kicker: mockRituel.origine.kicker,
    titre: mockRituel.origine.titre,
    paragraphes: mockRituel.origine.paragraphes,
    image: mockRituel.origine.photoSepia,
  };

  it('rend un titre h2 et tous les paragraphes', () => {
    const { container } = render(<SectionNarrative {...props} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(props.titre);
    const ps = container.querySelectorAll('p');
    expect(ps.length).toBeGreaterThanOrEqual(props.paragraphes.length);
    props.paragraphes.forEach((p) => {
      const firstWords = p.split(' ').slice(0, 3).join(' ');
      expect(container.textContent).toContain(firstWords);
    });
  });

  it('rend l\u2019image sépia avec alt', () => {
    render(<SectionNarrative {...props} />);
    expect(screen.getByAltText(props.image.alt)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<SectionNarrative {...props} />);
    await expectNoAxeViolations(container);
  });
});
