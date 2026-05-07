import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsletterForm } from './NewsletterForm';
import { expectNoAxeViolations } from '@/test/axe';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('NewsletterForm', () => {
  it('respecte axe à l’état initial', async () => {
    const { container } = render(<NewsletterForm />);
    await expectNoAxeViolations(container);
  });

  it('soumet le formulaire avec email + consent', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const user = userEvent.setup();
    render(<NewsletterForm source="test" />);
    await user.type(screen.getByLabelText(/votre adresse email/i), 'salma@maison.ma');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /recevoir la lettre/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/newsletter',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ email: 'salma@maison.ma', consent: true, source: 'test' });
  });

  it('affiche un message d’erreur si le serveur échoue', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const user = userEvent.setup();
    render(<NewsletterForm />);
    await user.type(screen.getByLabelText(/votre adresse email/i), 'a@b.co');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /recevoir la lettre/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
