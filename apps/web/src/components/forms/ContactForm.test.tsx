import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from './ContactForm';
import { expectNoAxeViolations } from '@/test/axe';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ContactForm', () => {
  it('respecte axe à l\u2019état initial', async () => {
    const { container } = render(<ContactForm />);
    await expectNoAxeViolations(container);
  });

  it('affiche les champs question par défaut, sans numéro de commande', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/votre prénom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/votre email/i)).toBeInTheDocument();
    const orderField = screen.queryByLabelText(/numéro de commande/i);
    expect(orderField?.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('expose les champs commande quand defaultType = order', () => {
    render(<ContactForm defaultType="order" />);
    const orderField = screen.getByLabelText(/numéro de commande/i);
    expect(orderField).toBeInTheDocument();
    expect(orderField.closest('[aria-hidden="true"]')).toBeFalsy();
  });

  it('expose phone, raison sociale et fonction quand defaultType = professional', () => {
    render(<ContactForm defaultType="professional" />);
    expect(screen.getByLabelText(/téléphone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/raison sociale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/votre fonction/i)).toBeInTheDocument();
  });

  it('inclut un honeypot website caché', () => {
    render(<ContactForm />);
    const honeypot = document.getElementById('contact-website') as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot?.tabIndex).toBe(-1);
    expect(honeypot?.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('soumet une demande question valide et appelle /api/contact', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.type(screen.getByLabelText(/votre prénom/i), 'Léa');
    await user.type(screen.getByLabelText(/votre email/i), 'lea@example.com');
    await user.type(
      screen.getByLabelText(/votre message/i),
      'Bonjour, j\u2019ai une question sur le rituel.',
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await user.click(screen.getByRole('button', { name: /envoyer mon message/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/contact',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.type).toBe('question');
    expect(body.gdprConsent).toBe(true);
  });

  it('affiche un message succès après soumission OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.type(screen.getByLabelText(/votre prénom/i), 'Léa');
    await user.type(screen.getByLabelText(/votre email/i), 'lea@example.com');
    await user.type(
      screen.getByLabelText(/votre message/i),
      'Bonjour, j\u2019ai une question sur le rituel.',
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await user.click(screen.getByRole('button', { name: /envoyer mon message/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /bien reçu/i })).toBeInTheDocument();
    });
  });

  it('affiche un ErrorState si le serveur répond 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.type(screen.getByLabelText(/votre prénom/i), 'Léa');
    await user.type(screen.getByLabelText(/votre email/i), 'lea@example.com');
    await user.type(
      screen.getByLabelText(/votre message/i),
      'Bonjour, j\u2019ai une question sur le rituel.',
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    await user.click(screen.getByRole('button', { name: /envoyer mon message/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/info@femiglow-maroc\.com/);
  });
});
