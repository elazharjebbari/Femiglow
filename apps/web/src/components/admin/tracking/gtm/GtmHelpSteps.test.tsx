import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GtmHelpSteps } from './GtmHelpSteps';

describe('GtmHelpSteps', () => {
  it('affiche les 6 étapes numérotées', () => {
    render(<GtmHelpSteps />);
    expect(screen.getByRole('heading', { name: /comment importer/i })).toBeInTheDocument();
    // Les 6 numéros 1..6 doivent être présents
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it('contient le titre "Ouvre GTM" en première étape', () => {
    render(<GtmHelpSteps />);
    expect(screen.getByText('Ouvre GTM')).toBeInTheDocument();
  });

  it('liste les 6 étapes dans une <ol>', () => {
    render(<GtmHelpSteps />);
    const list = screen.getByRole('list');
    expect(list.tagName.toLowerCase()).toBe('ol');
    expect(list.querySelectorAll('li')).toHaveLength(6);
  });
});
