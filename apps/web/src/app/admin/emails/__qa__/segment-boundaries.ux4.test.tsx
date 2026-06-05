/**
 * Vague 4 — FONDATION — error.tsx + loading.tsx du segment /admin/emails
 * (UX-TRANSVERSE-007 / UX-DASH-003).
 *
 * Oracle UX4-FONDATION-005 : error.tsx rend role=alert + un bouton « Réessayer »
 * câblé sur reset(). loading.tsx rend un feedback de navigation (role=status).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmailsError from '../error';
import EmailsLoading from '../loading';

describe('error.tsx — UX4-FONDATION-005', () => {
  it('UX4-FONDATION-005 : rend role=alert + bouton Réessayer câblé sur reset()', async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('DB down'), { digest: 'abc123' });
    const user = userEvent.setup();
    render(<EmailsError error={error} reset={reset} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/indisponible/i);
    // Message actionnable FR (pas un slug technique brut).
    expect(alert).toHaveTextContent(/base de données|Réessayer/i);
    // Le digest est exposé pour corréler avec les logs.
    expect(alert).toHaveTextContent('abc123');

    const retry = screen.getByRole('button', { name: /réessayer/i });
    await user.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('UX4-FONDATION-005b : sans digest, pas de ligne « Référence »', () => {
    render(<EmailsError error={new Error('boom')} reset={vi.fn()} />);
    expect(screen.queryByText(/Référence/i)).not.toBeInTheDocument();
  });
});

describe('loading.tsx — UX4-FONDATION-005c', () => {
  it('UX4-FONDATION-005c : feedback de navigation (role=status) + skeleton', () => {
    render(<EmailsLoading />);
    expect(screen.getByRole('status')).toHaveTextContent(/chargement/i);
    expect(screen.getByTestId('emails-loading')).toBeInTheDocument();
  });
});
