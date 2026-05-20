import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebhookSecretField } from './WebhookSecretField';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('WebhookSecretField', () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ secret: 'custom-secret-2026' })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche le secret et permet de sauvegarder une valeur custom', async () => {
    const user = userEvent.setup();
    render(<WebhookSecretField endpointId="we_1" initialSecret="old-secret-2026" />);

    const input = screen.getByDisplayValue('old-secret-2026');
    await user.clear(input);
    await user.type(input, 'custom-secret-2026');
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/webhooks/we_1/secret',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ secret: 'custom-secret-2026' }),
        }),
      ),
    );
    expect(await screen.findByText(/Secret mis à jour/i)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('masque puis réaffiche le secret sans perdre la valeur', async () => {
    const user = userEvent.setup();
    render(<WebhookSecretField endpointId="we_1" initialSecret="visible-secret" />);
    const toggle = screen.getByRole('button', { name: /Masquer le secret/i });
    await user.click(toggle);
    expect(screen.getByDisplayValue('visible-secret')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: /Afficher le secret/i }));
    expect(screen.getByDisplayValue('visible-secret')).toHaveAttribute('type', 'text');
  });
});
