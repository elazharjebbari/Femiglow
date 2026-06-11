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

/**
 * F12 — angles complémentaires (cf. docs/coupon-loyalty-qa-ui-2026-06-03/12-welcome-note).
 * I001-I005 ci-dessus restent la base de non-régression ; on n'y ajoute que des angles
 * manquants : aria-label = titre, prix final tabular-nums, savings verbatim, endsAtLabel
 * présent vs null, disclosure repliée, AR, charte (caractères interdits + filet sauge).
 */
describe('F12 — CouponWelcomeNote (angles complémentaires)', () => {
  it('F12-C001 aria-label égal au titre du geste d’accueil', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    expect(screen.getByTestId('coupon-welcome-note')).toHaveAttribute(
      'aria-label',
      'Votre geste d’accueil est appliqué.',
    );
  });

  it('F12-C002 prix final rendu en tabular-nums', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    const price = screen.getByTestId('coupon-welcome-final-price');
    expect(price).toHaveTextContent('199 MAD');
    expect(price.className).toContain('tabular-nums');
  });

  it('F12-C003 savingsLabel rendu verbatim', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    expect(screen.getByTestId('coupon-welcome-note').textContent ?? '').toContain(
      '90 MAD offerts',
    );
  });

  it('F12-C004 endsAtLabel présent → date + Hors cumul', () => {
    render(
      <CouponWelcomeNote
        finalPriceLabel="199 MAD"
        savingsLabel="90 MAD offerts"
        endsAtLabel="Valable jusqu au 30 juin 2026"
      />,
    );
    expect(screen.getByTestId('coupon-welcome-note').textContent ?? '').toContain(
      'Valable jusqu au 30 juin 2026 · Hors cumul.',
    );
  });

  it('F12-C005 endsAtLabel null → seulement Hors cumul (pas de date)', () => {
    render(
      <CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" endsAtLabel={null} />,
    );
    const txt = screen.getByTestId('coupon-welcome-note').textContent ?? '';
    expect(txt).toContain('Hors cumul.');
    expect(txt).not.toMatch(/Valable/);
  });

  it('F12-C006 disclosure code repliée par défaut (anti-friction)', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    const summary = screen.getByTestId('coupon-invitation-disclosure');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    // Champ interne non visible (replié) — l'input du champ n'est pas exposé.
    expect(screen.queryByTestId('invitation-code-field')?.closest('details')?.open).toBeFalsy();
  });

  it('F12-C007 i18n arabe : RTL + copies arabes', () => {
    render(<CouponWelcomeNote isArabic finalPriceLabel="199 درهم" savingsLabel="90 درهم هدية" />);
    const note = screen.getByTestId('coupon-welcome-note');
    expect(note).toHaveAttribute('dir', 'rtl');
    const txt = note.textContent ?? '';
    expect(txt).toContain('هدية الترحيب');
    expect(txt).toContain('غير قابل للجمع.');
  });

  it('F12-V008 charte : aucun caractère interdit', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    expect(screen.getByTestId('coupon-welcome-note').textContent ?? '').not.toMatch(/[%!]|🎉|⏰/);
  });

  it('F12-V009 charte : filet sauge présent, pas de rouge retail', () => {
    render(<CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" />);
    const cls = screen.getByTestId('coupon-welcome-note').className;
    expect(cls).toContain('border-sauge');
    expect(cls).not.toMatch(/\bbg-red|\btext-red|\bborder-red/);
  });

  it('F12-C010 Hors cumul toujours présent même sans endsAt (INV-NONCUMUL)', () => {
    render(
      <CouponWelcomeNote finalPriceLabel="199 MAD" savingsLabel="90 MAD offerts" endsAtLabel={null} />,
    );
    expect(screen.getByTestId('coupon-welcome-note').textContent ?? '').toContain('Hors cumul.');
  });
});
