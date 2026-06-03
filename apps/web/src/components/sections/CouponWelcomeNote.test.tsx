/**
 * Tests CouponWelcomeNote — CPN-14 (rendu, charte, i18n, disclosure).
 * Orienté UI (Testing Library), oracles sur textes exacts + absence
 * d'éléments interdits par la charte.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CouponWelcomeNote } from './CouponWelcomeNote';

describe('CPN-14 CouponWelcomeNote', () => {
  it('I001 affiche la copie « geste d’accueil » + prix final', () => {
    render(
      <CouponWelcomeNote
        finalPriceLabel="199 MAD"
        savingsLabel="90 MAD offerts sur votre première commande du pack"
        endsAtLabel="Valable jusqu'au 30 juin 2026"
      />,
    );
    expect(screen.getByText('Votre geste d’accueil est appliqué.')).toBeInTheDocument();
    expect(screen.getByTestId('coupon-welcome-final-price')).toHaveTextContent('199 MAD');
    expect(screen.getByText(/Valable jusqu'au 30 juin 2026/)).toBeInTheDocument();
  });

  it('I002 charte : aucun emoji, point d’exclamation, ni « countdown »', () => {
    const { container } = render(
      <CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />,
    );
    const txt = container.textContent ?? '';
    expect(txt).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u); // pas d'emoji
    expect(txt).not.toContain('!');
    expect(txt.toLowerCase()).not.toContain('countdown');
    expect(txt.toLowerCase()).not.toContain('compte à rebours');
  });

  it('I003 disclosure code repliée par défaut (anti-friction)', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    const summary = screen.getByTestId('coupon-invitation-disclosure');
    expect(summary).toHaveTextContent('J’ai un code d’invitation');
    // <details> sans attribut `open` → replié
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
  });

  it('I004 i18n arabe : RTL + copie arabe', () => {
    render(
      <CouponWelcomeNote
        isArabic
        finalPriceLabel="199 درهم"
        savingsLabel="90 درهم هدية"
      />,
    );
    const note = screen.getByTestId('coupon-welcome-note');
    expect(note).toHaveAttribute('dir', 'rtl');
    expect(screen.getByTestId('coupon-welcome-final-price')).toHaveTextContent('199 درهم');
  });

  it('I005 mention « Hors cumul » toujours présente', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    expect(screen.getByText(/Hors cumul\./)).toBeInTheDocument();
  });
});
