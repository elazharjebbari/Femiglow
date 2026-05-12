/**
 * CHA-231 — Tests de ThankYouStep (confirmation transactionnelle email).
 *
 * Couvre :
 *  - Le bloc d'opt-in parle de « confirmation de commande » (pas newsletter).
 *  - Affichage de l'order ref si présent dans le store.
 *  - Submit déclenche `useOrderEmailConfirmationMutation.execute()`.
 *  - Bouton désactivé tant que email + consent invalides.
 *  - État de succès : message « Confirmation envoyée à <email> » et formulaire
 *    remplacé par un status role="status".
 *  - Tracking event `order_confirmation_optin` (vérifié indirectement via le
 *    mock du hook).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks : useOrderEmailConfirmationMutation
// ─────────────────────────────────────────────────────────────────────────────

const executeMock = vi.fn();
let mutationState: {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: { code: string; message: string; httpStatus: number } | null;
} = { status: 'idle', error: null };

vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useOrderEmailConfirmationMutation: () => ({
    status: mutationState.status,
    error: mutationState.error,
    execute: executeMock,
    reset: vi.fn(),
  }),
}));

import { ThankYouStep } from './ThankYouStep';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function seedStore(opts: { orderId?: string | null } = {}) {
  const { reset, setFormContext, setOrderId } = useWizardStore.getState();
  reset();
  setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
  });
  if (opts.orderId !== undefined && opts.orderId !== null) {
    setOrderId(opts.orderId);
  }
}

beforeEach(() => {
  executeMock.mockReset();
  mutationState = { status: 'idle', error: null };
  seedStore({ orderId: 'o_test_abc' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ThankYouStep — copy transactionnel (pas newsletter)', () => {
  it('le bloc opt-in parle de « confirmation » et non de « newsletter »', () => {
    render(<ThankYouStep />);
    // Heading bloc opt-in
    expect(
      screen.getByText(/recevoir la confirmation par email/i),
    ).toBeInTheDocument();
    // Pas de mention de « newsletter » dans le DOM.
    expect(screen.queryByText(/newsletter/i)).toBeNull();
  });

  it("le consent label parle de « confirmation » et « notifications liées à cette commande »", () => {
    render(<ThankYouStep />);
    expect(
      screen.getByText(/confirmation et les notifications liées à cette commande/i),
    ).toBeInTheDocument();
  });

  it("le CTA submit est « Envoyer la confirmation » (pas « S'inscrire »)", () => {
    render(<ThankYouStep />);
    const btn = screen.getByTestId('wizard-email-confirmation-submit');
    expect(btn.textContent ?? '').toMatch(/envoyer la confirmation/i);
  });
});

describe('ThankYouStep — affichage order ref', () => {
  it('affiche le bloc order ref quand orderId est présent', () => {
    render(<ThankYouStep />);
    expect(screen.getByTestId('wizard-thankyou-orderref')).toBeInTheDocument();
    expect(screen.getByText('o_test_abc')).toBeInTheDocument();
  });

  it('omet le bloc order ref quand orderId est absent', () => {
    seedStore({ orderId: null });
    render(<ThankYouStep />);
    expect(screen.queryByTestId('wizard-thankyou-orderref')).toBeNull();
  });
});

describe('ThankYouStep — état initial du formulaire', () => {
  it('rend les champs email + consent + submit', () => {
    render(<ThankYouStep />);
    expect(
      screen.getByTestId('wizard-email-confirmation-email'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('wizard-email-confirmation-consent'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('wizard-email-confirmation-submit'),
    ).toBeInTheDocument();
  });

  it('le bouton submit est désactivé sans email ni consent', () => {
    render(<ThankYouStep />);
    expect(screen.getByTestId('wizard-email-confirmation-submit')).toBeDisabled();
  });

  it('le bouton reste désactivé avec email valide mais sans consent', async () => {
    const user = userEvent.setup();
    render(<ThankYouStep />);
    await user.type(
      screen.getByTestId('wizard-email-confirmation-email'),
      'amal@example.ma',
    );
    expect(screen.getByTestId('wizard-email-confirmation-submit')).toBeDisabled();
  });

  it("le bouton s'active avec email valide ET consent coché", async () => {
    const user = userEvent.setup();
    render(<ThankYouStep />);
    await user.type(
      screen.getByTestId('wizard-email-confirmation-email'),
      'amal@example.ma',
    );
    await user.click(screen.getByTestId('wizard-email-confirmation-consent'));
    await waitFor(() =>
      expect(screen.getByTestId('wizard-email-confirmation-submit')).not.toBeDisabled(),
    );
  });
});

describe('ThankYouStep — submit', () => {
  it("appelle execute avec { email, emailConsent: true } à la soumission", async () => {
    const user = userEvent.setup();
    executeMock.mockResolvedValue(undefined);
    render(<ThankYouStep />);

    await user.type(
      screen.getByTestId('wizard-email-confirmation-email'),
      'amal@example.ma',
    );
    await user.click(screen.getByTestId('wizard-email-confirmation-consent'));

    const btn = screen.getByTestId('wizard-email-confirmation-submit');
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);

    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(1));
    expect(executeMock).toHaveBeenCalledWith({
      email: 'amal@example.ma',
      emailConsent: true,
    });
  });
});

describe('ThankYouStep — état de succès', () => {
  it('affiche le message « Confirmation envoyée à <email> » + role="status"', () => {
    mutationState = { status: 'success', error: null };
    render(<ThankYouStep />);
    const success = screen.getByTestId('wizard-email-confirmation-success');
    expect(success).toBeInTheDocument();
    expect(success).toHaveAttribute('role', 'status');
    // L'email est vide par défaut (`email` state local non hydraté en mode mock) ;
    // on vérifie juste la présence du préfixe.
    expect(success.textContent ?? '').toMatch(/confirmation envoyée à/i);
  });

  it('le formulaire d\'opt-in est retiré en cas de succès', () => {
    mutationState = { status: 'success', error: null };
    render(<ThankYouStep />);
    expect(
      screen.queryByTestId('wizard-email-confirmation-submit'),
    ).toBeNull();
  });
});

describe('ThankYouStep — état d\'erreur', () => {
  it('affiche un bandeau d\'erreur si la mutation échoue (rate_limited)', () => {
    mutationState = {
      status: 'error',
      error: { code: 'rate_limited', message: '', httpStatus: 429 },
    };
    render(<ThankYouStep />);
    const banner = screen.getByTestId('wizard-email-confirmation-error');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner.textContent ?? '').toMatch(/trop de tentatives/i);
  });
});
