/**
 * VAGUE 4 — COCKPIT : RetryButton (UX-COCKPIT-005).
 *
 * Oracle UX4-COCKPIT-006 (RTL) :
 *  - confirmation avant renvoi (annuler = pas d'action) ;
 *  - état pending : bouton disabled + « Renvoi… » pendant l'action ;
 *  - feedback succès/erreur role=alert ;
 *  - double-clic = UN SEUL appel (anti double-enqueue via useFormStatus).
 *
 * On mocke l'action serveur (`retryOutboxActionState`) avec une promesse
 * différée pour observer l'état pending.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// L'action serveur réelle dépend de requireAdmin/DB : on la remplace par un
// double contrôlable. RETRY_INITIAL_STATE reste le vrai (objet simple).
const actionMock = vi.fn();
vi.mock('@/lib/admin/emails/actions', () => ({
  RETRY_INITIAL_STATE: { ok: null, message: '' },
  retryOutboxActionState: (...args: unknown[]) => actionMock(...args),
}));

import { RetryButton } from '@/components/admin/emails/cockpit/RetryButton';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  actionMock.mockReset();
});

describe('RetryButton — renvoi unitaire (UX4-COCKPIT-006)', () => {
  it('UX4-COCKPIT-006 : pending (bouton disabled « Renvoi… ») puis succès role=alert', async () => {
    const d = deferred<{ ok: boolean; message: string }>();
    actionMock.mockReturnValue(d.promise);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<RetryButton outboxId="out_1" />);

    const btn = screen.getByTestId('retry-submit');
    expect(btn).not.toBeDisabled();
    await user.click(btn);

    // Pendant l'action : bouton disabled + libellé « Renvoi… ».
    await waitFor(() => expect(screen.getByTestId('retry-submit')).toBeDisabled());
    expect(screen.getByTestId('retry-submit')).toHaveTextContent(/Renvoi/i);

    // Résolution succès → role=alert visible.
    d.resolve({ ok: true, message: 'Email remis en file' });
    expect(await screen.findByTestId('retry-feedback-ok')).toHaveTextContent(/remis en file/i);
    expect(screen.getByTestId('retry-submit')).not.toBeDisabled();
    confirmSpy.mockRestore();
  });

  it('UX4-COCKPIT-006b : échec → role=alert d’erreur', async () => {
    actionMock.mockResolvedValue({ ok: false, message: 'Le renvoi a échoué : boom' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<RetryButton outboxId="out_2" />);
    await user.click(screen.getByTestId('retry-submit'));
    expect(await screen.findByTestId('retry-feedback-error')).toHaveTextContent(/échoué/i);
    confirmSpy.mockRestore();
  });

  it('UX4-COCKPIT-006c : confirmation annulée → AUCUN appel d’action', async () => {
    actionMock.mockResolvedValue({ ok: true, message: 'ok' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<RetryButton outboxId="out_3" />);
    await user.click(screen.getByTestId('retry-submit'));
    await new Promise((r) => setTimeout(r, 50));
    expect(actionMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('UX4-COCKPIT-006d : double-clic pendant l’action = UN SEUL appel', async () => {
    const d = deferred<{ ok: boolean; message: string }>();
    actionMock.mockReturnValue(d.promise);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<RetryButton outboxId="out_4" />);
    const btn = screen.getByTestId('retry-submit');
    await user.click(btn);
    await waitFor(() => expect(screen.getByTestId('retry-submit')).toBeDisabled());
    // 2e clic pendant le pending : le bouton est disabled → ignoré.
    await user.click(screen.getByTestId('retry-submit'));
    d.resolve({ ok: true, message: 'Email remis en file' });
    await screen.findByTestId('retry-feedback-ok');
    expect(actionMock).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });
});
