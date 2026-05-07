import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MediaLibraryGrid } from './MediaLibraryGrid';
import { makeImageMedia } from '@/lib/media/components/__fixtures__/media';

describe('MediaLibraryGrid', () => {
  it('rend un message vide si rows=[]', () => {
    render(<MediaLibraryGrid rows={[]} emptyLabel="rien" />);
    expect(screen.getByText('rien')).toBeInTheDocument();
  });

  it('rend une tile par media', () => {
    const a = makeImageMedia({ id: 'me_a', slug: 'a' });
    const b = makeImageMedia({ id: 'me_b', slug: 'b' });
    render(<MediaLibraryGrid rows={[a, b]} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('zéro violation a11y', async () => {
    const a = makeImageMedia({ id: 'me_a', slug: 'a' });
    const { container } = render(<MediaLibraryGrid rows={[a]} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
