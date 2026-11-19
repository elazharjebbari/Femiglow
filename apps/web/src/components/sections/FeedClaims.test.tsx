import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { FeedClaims } from './FeedClaims';
import type { ProductFeedClaim } from '@/lib/products/feed/types';

const claims: ProductFeedClaim[] = [
  { icon: 'leaf', label: 'Origine naturelle', detail: 'Cire, jojoba.' },
  { icon: 'drop', label: 'Sans agressifs', detail: 'Ni acétone.' },
  { icon: 'sparkle', label: 'Ongles éclatants', detail: 'Brillance.' },
];

describe('FeedClaims', () => {
  it('rend une liste nommée de trois promesses, libellé et détail', () => {
    render(<FeedClaims claims={claims} />);
    const list = screen.getByRole('list', { name: 'Promesses produit' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('Origine naturelle')).toBeDefined();
    expect(within(list).getByText('Ni acétone.')).toBeDefined();
  });

  it('pictogrammes décoratifs : aucun nom accessible en double', () => {
    render(<FeedClaims claims={claims} />);
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('aligne au début et n’utilise aucune couleur à transparence', () => {
    render(<FeedClaims claims={claims} />);
    const item = screen.getByTestId('feed-claim-leaf');
    expect(item.className).toContain('text-start');
    const html = screen.getByTestId('feed-claims').outerHTML;
    expect(html).not.toMatch(/(?:encre|sauge|petale|champagne|ciel)(?:-\w+)?\/\d/);
  });
});
