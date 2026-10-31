import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MediaSetUsagesList } from './MediaSetUsagesList';
import type { MediaSetUsageLike } from '@/lib/media/media-set-usage';

afterEach(cleanup);

const u = (p: Partial<MediaSetUsageLike>): MediaSetUsageLike => ({
  setId: 's1',
  componentId: 'sc',
  componentKey: 'kit-hero-produit',
  slot: 'secondary',
  variantDim: 'angle',
  variantKey: 'e',
  locale: 'ar',
  status: 'published',
  version: 3,
  ...p,
});

describe('MediaSetUsagesList', () => {
  it('liste les usages vivants avec lien, archivés comptés à part', () => {
    render(
      <MediaSetUsagesList
        usages={[u({}), u({ setId: 's2', status: 'draft', version: 4 }), u({ setId: 's3', status: 'archived', version: 2 })]}
      />,
    );
    const link = screen.getByRole('link', { name: 'kit-hero-produit · secondary · angle e · ar (publié v3)' });
    expect(link).toHaveAttribute('href', '/admin/components/kit-hero-produit#medias-par-audience');
    expect(screen.getByText(/brouillon v4/)).toBeInTheDocument();
    expect(screen.getByText(/\+ 1 version archivée/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Médias par audience (2)' })).toBeInTheDocument();
  });

  it('aucun usage', () => {
    render(<MediaSetUsagesList usages={[]} />);
    expect(screen.getByText('Utilisé par aucun ensemble de médias par audience.')).toBeInTheDocument();
  });

  it('échec de lecture : « usages indisponibles », jamais « aucun »', () => {
    render(<MediaSetUsagesList usages={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('Usages indisponibles');
    expect(screen.queryByText(/aucun ensemble/)).toBeNull();
  });
});
