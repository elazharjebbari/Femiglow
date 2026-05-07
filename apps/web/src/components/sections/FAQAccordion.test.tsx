import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FAQAccordion } from './FAQAccordion';
import { expectNoAxeViolations } from '@/test/axe';

const items = [
  { id: 'q1', question: 'Combien de temps dure le rituel\u202F?', answer: 'Quatre à six minutes.' },
  { id: 'q2', question: 'Mes ongles sont fragiles\u202F?', answer: 'Oui, les matières sont douces.' },
  { id: 'q3', question: 'Délais de livraison\u202F?', answer: '48 à 72 heures à Casablanca.' },
  { id: 'q4', question: 'Échantillon avant achat\u202F?', answer: 'Pas de pochette d\u2019essai en Phase 1.' },
];

describe('FAQAccordion', () => {
  it('rend 4 entrées avec leur question', () => {
    render(<FAQAccordion items={items} />);
    expect(screen.getByText(/Combien de temps dure le rituel/)).toBeInTheDocument();
    expect(screen.getByText(/ongles sont fragiles/)).toBeInTheDocument();
    expect(screen.getByText(/Délais de livraison/)).toBeInTheDocument();
    expect(screen.getByText(/Échantillon avant achat/)).toBeInTheDocument();
  });

  it('aucune entrée n\u2019est ouverte par défaut', () => {
    render(<FAQAccordion items={items} />);
    const detailsList = document.querySelectorAll('details');
    detailsList.forEach((details) => {
      expect((details as HTMLDetailsElement).open).toBe(false);
    });
  });

  it('respecte axe', async () => {
    const { container } = render(<FAQAccordion items={items} />);
    await expectNoAxeViolations(container);
  });
});
