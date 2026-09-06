/** Tests InvitationCodeField (Phase 3) — validation code via endpoint. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { InvitationCodeField } from './InvitationCodeField';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubFetch(payload: object) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload }) as unknown as Response));
}

describe('P3 InvitationCodeField', () => {
  it('U001 code valide → affiche le crédit + notifie onValid', async () => {
    stubFetch({ valid: true, valueCents: 2000 });
    const onValid = vi.fn();
    render(<InvitationCodeField onValid={onValid} />);
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'fg-abc234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(screen.getByTestId('invitation-code-ok')).toBeInTheDocument());
    expect(screen.getByTestId('invitation-code-ok')).toHaveTextContent('20 MAD');
    expect(onValid).toHaveBeenCalledWith('FG-ABC234', 2000, 'credit');
  });

  it('U002 code invalide → message d’erreur sobre, pas de onValid', async () => {
    stubFetch({ valid: false, reason: 'not_found' });
    const onValid = vi.fn();
    render(<InvitationCodeField onValid={onValid} />);
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'FG-NOPE99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(screen.getByTestId('invitation-code-ko')).toBeInTheDocument());
    expect(onValid).not.toHaveBeenCalled();
  });

  it('U004 anti-stale : éditer après validation → onClear (crédit invalidé)', async () => {
    stubFetch({ valid: true, valueCents: 2000 });
    const onClear = vi.fn();
    render(<InvitationCodeField onClear={onClear} />);
    const input = screen.getByLabelText('Votre code');
    fireEvent.change(input, { target: { value: 'FG-ABC234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(screen.getByTestId('invitation-code-ok')).toBeInTheDocument());
    // Édition après validation → onClear + retour à l'état neutre
    fireEvent.change(input, { target: { value: 'FG-ABC235' } });
    expect(onClear).toHaveBeenCalled();
    expect(screen.queryByTestId('invitation-code-ok')).toBeNull();
  });

  it('U003 code trop court → aucun appel réseau', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<InvitationCodeField />);
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(f).not.toHaveBeenCalled();
  });
});
