import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SciencesDuSoin } from './SciencesDuSoin';
import { mockRituel } from '@/data/mock/rituel';
import { expectNoAxeViolations } from '@/test/axe';

describe('SciencesDuSoin', () => {
  it('rend un h2, trois articles et la liste des sources', () => {
    render(<SciencesDuSoin data={mockRituel.sciences} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      mockRituel.sciences.titre,
    );
    expect(screen.getAllByRole('article')).toHaveLength(3);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(list.querySelectorAll('li')).toHaveLength(
      mockRituel.sciences.sourcesAcademiques.length,
    );
  });

  it('lie les notes de bas de page aux sources via id/href', () => {
    const { container } = render(<SciencesDuSoin data={mockRituel.sciences} />);
    const fnLink = container.querySelector('a[href="#src-1"]');
    expect(fnLink).not.toBeNull();
    expect(container.querySelector('#src-1')).not.toBeNull();
    expect(container.querySelector('a[href="#fn-1"]')).not.toBeNull();
  });

  it('respecte axe', async () => {
    const { container } = render(<SciencesDuSoin data={mockRituel.sciences} />);
    await expectNoAxeViolations(container);
  });
});
