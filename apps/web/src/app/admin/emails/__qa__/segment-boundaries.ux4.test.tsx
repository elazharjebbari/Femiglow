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
  it('F03-C-043 (ex UX4-FONDATION-005) : role=alert, message neutre sans cause présumée', async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('DB down'), { digest: 'abc123' });
    const user = userEvent.setup();
    render(<EmailsError error={error} reset={reset} />);

    const alert = screen.getByRole('alert');
    // DASH-09 (F03) : message NEUTRE — « n'a pas pu être chargé », AUCUNE
    // cause présumée (la mention « base de données » est interdite).
    expect(alert).toHaveTextContent(/n.a pas pu être chargé/i);
    expect(alert).not.toHaveTextContent(/base de données/i);
    // Le digest est exposé pour corréler avec les logs.
    expect(alert).toHaveTextContent('abc123');

    const retry = screen.getByRole('button', { name: /réessayer/i });
    await user.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('F03-C-044 — le digest est affiché avec Réessayer + lien retour admin', () => {
    render(
      <EmailsError
        error={Object.assign(new Error('x'), { digest: 'dig999' })}
        reset={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('dig999');
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /retour/i })).toHaveAttribute('href', '/admin');
  });

  it('UX4-FONDATION-005b : sans digest, pas de ligne « Référence »', () => {
    render(<EmailsError error={new Error('boom')} reset={vi.fn()} />);
    expect(screen.queryByText(/Référence/i)).not.toBeInTheDocument();
  });
});

describe('loading.tsx — UX4-FONDATION-005c', () => {
  it('F03-C-042 (ex UX4-FONDATION-005c) : skeleton role=status', () => {
    render(<EmailsLoading />);
    expect(screen.getByRole('status')).toHaveTextContent(/chargement/i);
    expect(screen.getByTestId('emails-loading')).toBeInTheDocument();
  });
});
