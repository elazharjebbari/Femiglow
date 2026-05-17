import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformPreview } from './PlatformPreview';

describe('PlatformPreview', () => {
  it('affiche la caption et les hashtags', () => {
    render(
      <PlatformPreview
        caption="Découvrez le rituel FemiGlow."
        hashtags={['femiglow', 'rituel']}
        media={null}
      />,
    );
    expect(screen.getByText('Découvrez le rituel FemiGlow.')).toBeInTheDocument();
    expect(screen.getByText('#femiglow #rituel')).toBeInTheDocument();
  });

  it('affiche le placeholder quand il n’y a pas de média', () => {
    render(
      <PlatformPreview
        caption="Test caption"
        hashtags={[]}
        media={null}
      />,
    );
    expect(screen.getByText(/Sélectionnez un média/i)).toBeInTheDocument();
  });

  it('affiche l’image quand un média est fourni', () => {
    render(
      <PlatformPreview
        caption="Test"
        hashtags={[]}
        media={{ id: 'm1', previewUrl: 'https://example.com/img.jpg', alt: 'Test image' } as any}
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
  });
});