import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RitualCard } from './RitualCard';
import type { RitualTestimonialPublic } from '@/lib/schemas/rituals';

const baseFixture: RitualTestimonialPublic = {
  publicSlug: 'amal-001',
  body: 'Trois mois et l’ongle a retrouvé sa nervure. J’ai cessé de le forcer.',
  wouldRecommend: 'oui',
  ritualTags: ['ongles-plus-lisses', 'plus-de-casse'],
  signature: {
    firstName: 'Amal',
    city: 'Rabat',
    initiatedSince: '2026-02',
    isAnonymous: false,
    verifiedPurchase: true,
  },
  language: 'fr',
  photos: [],
  publishedAt: '2026-05-01T10:00:00Z',
};

describe('RitualCard', () => {
  it('affiche la citation entre guillemets français', () => {
    render(<RitualCard data={baseFixture} variant="default" />);
    expect(screen.getByText(/Trois mois et l’ongle/)).toBeInTheDocument();
  });

  it('affiche la signature avec prénom et ville', () => {
    render(<RitualCard data={baseFixture} variant="default" />);
    expect(screen.getByText(/Amal, Rabat/)).toBeInTheDocument();
  });

  it('affiche la date d’initiation formatée', () => {
    render(<RitualCard data={baseFixture} variant="default" />);
    expect(screen.getByText(/Initiée depuis février 2026/)).toBeInTheDocument();
  });

  it('affiche le badge Reviendrait si wouldRecommend = oui', () => {
    render(<RitualCard data={baseFixture} variant="default" />);
    expect(screen.getByTestId('ritual-card-badge-recommend')).toBeInTheDocument();
  });

  it('masque le badge si wouldRecommend = hesite', () => {
    render(
      <RitualCard data={{ ...baseFixture, wouldRecommend: 'hesite' }} variant="default" />,
    );
    expect(screen.queryByTestId('ritual-card-badge-recommend')).not.toBeInTheDocument();
  });

  it('affiche signature anonyme si isAnonymous', () => {
    render(
      <RitualCard
        data={{
          ...baseFixture,
          signature: { ...baseFixture.signature, isAnonymous: true, firstName: null },
        }}
        variant="default"
      />,
    );
    expect(screen.getByText(/Une initiée, Rabat/)).toBeInTheDocument();
  });

  it('affiche les tags choisis séparés par ·', () => {
    render(<RitualCard data={baseFixture} variant="default" />);
    expect(screen.getByText(/ongles plus lisses · plus de casse/)).toBeInTheDocument();
  });

  it('pas de photo cliquable si aucune photo', () => {
    render(<RitualCard data={baseFixture} variant="default" />);
    expect(
      screen.queryByRole('button', { name: /Voir la photo/ }),
    ).not.toBeInTheDocument();
  });

  it('photo cliquable appelle onPhotoClick', async () => {
    const onPhotoClick = vi.fn();
    render(
      <RitualCard
        data={{
          ...baseFixture,
          photos: [
            {
              url: 'https://x/p.jpg',
              thumbUrl: 'https://x/p-thumb.jpg',
              width: 800,
              height: 1000,
              focalX: 0.5,
              focalY: 0.5,
              position: 0,
              alt: null,
            },
          ],
        }}
        variant="default"
        onPhotoClick={onPhotoClick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Voir la photo/ }));
    expect(onPhotoClick).toHaveBeenCalledWith(0);
  });

  it('variant compact rend la photo en pleine largeur', () => {
    render(
      <RitualCard
        data={{
          ...baseFixture,
          photos: [
            {
              url: 'https://x/p.jpg',
              thumbUrl: 'https://x/p-thumb.jpg',
              width: 800,
              height: 1000,
              focalX: 0.5,
              focalY: 0.5,
              position: 0,
              alt: null,
            },
          ],
        }}
        variant="compact"
      />,
    );
    expect(screen.getByTestId('ritual-card')).toBeInTheDocument();
  });
});
