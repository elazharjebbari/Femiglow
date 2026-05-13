import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncIndicator } from './SyncIndicator';

describe('SyncIndicator (T24)', () => {
  it("ne rend rien si providerValue est vide (aucune comparaison possible)", () => {
    const { container } = render(
      <SyncIndicator current="G-XXX" providerValue="" label="GA4" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche la pastille "synchronisé" quand match exact', () => {
    render(<SyncIndicator current="G-PROD" providerValue="G-PROD" label="GA4" />);
    expect(screen.getByLabelText(/synchronisé/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/désynchronisé/i)).not.toBeInTheDocument();
  });

  it('affiche la pastille "désynchronisé" quand divergence', () => {
    render(<SyncIndicator current="G-PROD" providerValue="G-OTHER" label="GA4" />);
    expect(screen.getByLabelText(/désynchronisé/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^GA4 synchronisé$/i)).not.toBeInTheDocument();
  });

  it("considère current vide comme une divergence (provider présent)", () => {
    render(<SyncIndicator current="" providerValue="G-PROVIDER" label="GA4" />);
    expect(screen.getByLabelText(/désynchronisé/i)).toBeInTheDocument();
  });

  it('tolère current/providerValue null ou undefined', () => {
    const { container: c1 } = render(
      <SyncIndicator current={null} providerValue={null} />,
    );
    expect(c1).toBeEmptyDOMElement();
    const { container: c2 } = render(
      <SyncIndicator current={undefined} providerValue={undefined} />,
    );
    expect(c2).toBeEmptyDOMElement();
  });
});
