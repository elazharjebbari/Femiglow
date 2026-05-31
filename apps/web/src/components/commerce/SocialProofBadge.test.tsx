import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialProofBadge } from './SocialProofBadge';

describe('SocialProofBadge', () => {
  it('formate la note en FR avec virgule', () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={287} />);
    expect(screen.getByText(/4,8\/5/)).toBeInTheDocument();
  });

  it('affiche le compte au pluriel par défaut', () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={287} />);
    expect(screen.getByText(/287 avis/)).toBeInTheDocument();
  });

  it("affiche '1 avis' au singulier", () => {
    render(<SocialProofBadge rating={5} reviewsCount={1} />);
    expect(screen.getByText(/1 avis/)).toBeInTheDocument();
  });

  it("aria-label inclut note et compte", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={287} />);
    expect(
      screen.getByLabelText(/note 4,8 sur 5 basée sur 287 avis/i),
    ).toBeInTheDocument();
  });

  it('rend 5 étoiles dont 4 pleines + 1 demie pour rating=4.5', () => {
    render(<SocialProofBadge rating={4.5} reviewsCount={10} />);
    const stars = screen.getAllByTestId('proof-star');
    expect(stars).toHaveLength(5);
    expect(stars.filter((s) => s.dataset.fill === 'full')).toHaveLength(4);
    expect(stars.filter((s) => s.dataset.fill === 'half')).toHaveLength(1);
  });

  it('rend 4 pleines + 1 demie pour rating=4.8 (arrondi au quart)', () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={10} />);
    const stars = screen.getAllByTestId('proof-star');
    // 4.8 : étoiles 1-4 pleines (diff >= 0.75), étoile 5 = diff 0.8 ≥ 0.75 → full
    expect(stars.filter((s) => s.dataset.fill === 'full').length).toBeGreaterThanOrEqual(4);
  });

  it("est un <span> non-cliquable par défaut", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={10} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it("devient un <a> si href fourni", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={10} href="#reviews" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '#reviews');
  });

  it('clamp les notes hors borne', () => {
    const { rerender } = render(<SocialProofBadge rating={6} reviewsCount={1} />);
    expect(screen.getByText(/5\/5/)).toBeInTheDocument();
    rerender(<SocialProofBadge rating={-1} reviewsCount={1} />);
    expect(screen.getByText(/0\/5/)).toBeInTheDocument();
  });
});
