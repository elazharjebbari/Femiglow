import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationProof, recommendationPct } from './RecommendationProof';

const STRINGS = {
  recommend: '82 % recommandent le Pack',
  reviews: '51 avis',
  verified: '36 achats vérifiés',
  readReviews: 'Lire les avis',
  ariaLabel: '82 % des clientes recommandent le Pack, sur 51 avis. Lire les avis.',
};

describe('recommendationPct', () => {
  it('arrondit la part réelle de « oui »', () => {
    expect(recommendationPct(42, 51)).toBe(82);
    expect(recommendationPct(0, 0)).toBe(0);
    expect(recommendationPct(60, 51)).toBe(100);
  });
});

describe('RecommendationProof', () => {
  it('affiche le taux, le nombre d’avis, les achats vérifiés et le lien vers les avis', () => {
    render(<RecommendationProof recommendCount={42} reviewsCount={51} verifiedCount={36} href="#avis" strings={STRINGS} />);
    const link = screen.getByTestId('recommendation-proof');
    expect(link).toHaveAttribute('href', '#avis');
    expect(link).toHaveAccessibleName(STRINGS.ariaLabel);
    expect(link).toHaveTextContent('82 % recommandent le Pack');
    expect(link).toHaveTextContent('51 avis');
    expect(link).toHaveTextContent('36 achats vérifiés');
    expect(link).toHaveTextContent('Lire les avis');
  });

  it('la jauge reflète le pourcentage (82 % du cercle)', () => {
    render(<RecommendationProof recommendCount={42} reviewsCount={51} href="#avis" strings={STRINGS} />);
    const [dash, total] = screen.getByTestId('recommendation-gauge').getAttribute('stroke-dasharray')!.split(' ').map(Number);
    expect(dash! / total!).toBeCloseTo(0.82, 2);
  });

  it('n’affiche pas d’étoiles ni les achats vérifiés quand il n’y en a pas', () => {
    render(<RecommendationProof recommendCount={42} reviewsCount={51} verifiedCount={0} href="#avis" strings={STRINGS} />);
    expect(screen.queryByText('36 achats vérifiés')).toBeNull();
    expect(screen.queryByTestId('proof-star')).toBeNull();
  });
});
