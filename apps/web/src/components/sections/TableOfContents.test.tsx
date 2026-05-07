import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableOfContents } from './TableOfContents';
import type { ArticleHeading } from '@/lib/markdown/render';
import { expectNoAxeViolations } from '@/test/axe';

class MockObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeAll(() => {
  // jsdom n\u2019implémente pas IntersectionObserver
  vi.stubGlobal('IntersectionObserver', MockObserver as unknown);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const headings: ArticleHeading[] = [
  { depth: 2, id: 'la-saison', text: 'La saison sèche, vraiment' },
  { depth: 2, id: 'le-rituel', text: 'Le rituel ralenti' },
  { depth: 3, id: 'sous-section', text: 'Sous-section' },
];

describe('TableOfContents', () => {
  it('rend les ancres avec href #id et aria-label Sommaire', () => {
    render(<TableOfContents headings={headings} />);
    const nav = screen.getByRole('navigation', { name: /sommaire/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /la saison/i })).toHaveAttribute(
      'href',
      '#la-saison',
    );
    expect(screen.getByRole('link', { name: /sous-section/i })).toHaveAttribute(
      'href',
      '#sous-section',
    );
  });

  it('ne rend rien si moins de 2 headings', () => {
    const { container } = render(
      <TableOfContents headings={[headings[0]!]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('respecte axe', async () => {
    const { container } = render(<TableOfContents headings={headings} />);
    await expectNoAxeViolations(container);
  });
});
