/** LOY-G5 — LoyaltyCodeCard (code mémorable en fin de commande). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LoyaltyCodeCard } from './LoyaltyCodeCard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LOY-G5 LoyaltyCodeCard', () => {
  it('U001 affiche le code, la valeur (terracotta) et l’activation civile', () => {
    render(
      <LoyaltyCodeCard code="FG-ATLAS-2048" valueCents={2000} activatesAt="2026-06-12T00:00:00Z" />,
    );
    expect(screen.getByTestId('loyalty-code-value')).toHaveTextContent('FG-ATLAS-2048');
    const card = screen.getByTestId('loyalty-code-card');
    expect(card).toHaveTextContent('20 MAD');
    expect(card).toHaveTextContent(/à partir du 12 juin/);
    expect(card.querySelector('.text-\\[\\#C28A6E\\]')).not.toBeNull();
  });

  it('U002 bouton copier → navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<LoyaltyCodeCard code="FG-SAUGE-0007" valueCents={2000} />);
    fireEvent.click(screen.getByTestId('loyalty-code-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('FG-SAUGE-0007'));
    expect(await screen.findByText('Copié')).toBeInTheDocument();
  });

  it('U003 charte : pas de %, pas de !, pas d’emoji, pas de countdown', () => {
    render(<LoyaltyCodeCard code="FG-ECLAT-1234" valueCents={2000} activatesAt="2026-06-12T00:00:00Z" />);
    const txt = screen.getByTestId('loyalty-code-card').textContent ?? '';
    expect(txt).not.toContain('%');
    expect(txt).not.toContain('!');
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt)).toBe(false);
    expect(txt.toLowerCase()).not.toMatch(/\d+\s*:\s*\d+|countdown|expire/);
  });

  it('U004 sans activatesAt → pas de ligne activation, le reste reste lisible', () => {
    render(<LoyaltyCodeCard code="FG-MAISON-0042" valueCents={2000} />);
    expect(screen.getByTestId('loyalty-code-value')).toHaveTextContent('FG-MAISON-0042');
    expect(screen.getByTestId('loyalty-code-card').textContent).not.toMatch(/à partir du/);
  });

  it('U005 i18n arabe : RTL + درهم', () => {
    render(<LoyaltyCodeCard code="FG-ATLAS-2048" valueCents={2000} isArabic />);
    const card = screen.getByTestId('loyalty-code-card');
    expect(card).toHaveAttribute('dir', 'rtl');
    expect(card).toHaveTextContent('درهم');
  });
});
