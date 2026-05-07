import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MediaTile } from './MediaTile';
import { makeImageMedia } from '@/lib/media/components/__fixtures__/media';

describe('MediaTile', () => {
  it('rend slug, badge statut et lien', () => {
    const m = makeImageMedia({ id: 'me_t1', slug: 'hero', status: 'ready', isHero: true });
    render(<MediaTile media={m} />);
    expect(screen.getByText('hero')).toBeInTheDocument();
    expect(screen.getByText('Prêt')).toBeInTheDocument();
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/admin/media/me_t1');
  });

  it('zéro violation a11y', async () => {
    const m = makeImageMedia({ id: 'me_t2', slug: 'inline', status: 'pending' });
    const { container } = render(<MediaTile media={m} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
