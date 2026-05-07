import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AtelierGallery } from './AtelierGallery';
import { mockMaison } from '@/data/mock/maison';
import { expectNoAxeViolations } from '@/test/axe';

beforeAll(() => {
  // jsdom : <dialog> non implémenté
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
});

describe('AtelierGallery', () => {
  it('rend l’adresse, le quartier et 3 boutons de galerie', () => {
    render(<AtelierGallery data={mockMaison.atelier} />);
    expect(screen.getByText(/14 rue des Acacias/i)).toBeInTheDocument();
    expect(screen.getByText(/Bourgogne/i)).toBeInTheDocument();
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => /voir la photo/i.test(b.getAttribute('aria-label') ?? ''));
    expect(buttons).toHaveLength(3);
  });

  it('ouvre le dialog au clic sur une photo', () => {
    render(<AtelierGallery data={mockMaison.atelier} />);
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => /voir la photo/i.test(b.getAttribute('aria-label') ?? ''));
    fireEvent.click(buttons[0]!);
    const dialog = document.querySelector('dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  it('respecte axe', async () => {
    const { container } = render(<AtelierGallery data={mockMaison.atelier} />);
    await expectNoAxeViolations(container);
  });
});
