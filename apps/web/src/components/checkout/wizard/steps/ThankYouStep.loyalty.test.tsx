/**
 * F11 — ThankYouStep ↔ store loyalty wiring + LoyaltyCodeCard.
 *
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/11-thankyou-loyalty.
 *
 * Extension, pas duplication : LoyaltyCodeCard.test.tsx couvre déjà la carte isolée
 * (U001-U005). Ici on teste le CÂBLAGE ThankYouStep ↔ store : présence/absence
 * conditionnelle selon `loyalty?.code`, propagation des props depuis le store, et
 * l'invariant INV-PII (aucun téléphone sur l'écran merci).
 *
 * Setup réaliste (cf. spec + ThankYouStep.test.tsx) :
 *   1. mock `useOrderEmailConfirmationMutation` (idle, execute no-op) ;
 *   2. sème le store (orderId, loyalty, formContext.language), reset en afterEach ;
 *   3. `navigator.clipboard.writeText` mocké pour le bouton copier.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';

// ─────────────────────────────────────────────────────────────────────────────
// Mock : useOrderEmailConfirmationMutation (isole le wiring loyalty du form email)
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

type Loyalty = { code: string; valueCents: number; activatesAt: string | null } | null;

function seedStore(opts: {
  orderId?: string | null;
  loyalty?: Loyalty;
  language?: 'fr' | 'ar';
} = {}) {
  const { reset, setFormContext, setOrderId, setLoyalty } = useWizardStore.getState();
  reset();
  setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
    language: opts.language ?? 'fr',
  });
  // orderId fixture : purement alphanumérique, pas de 6 chiffres consécutifs (INV-PII).
  if (opts.orderId !== null) setOrderId(opts.orderId ?? 'o_test_abc');
  if (opts.loyalty !== undefined) setLoyalty(opts.loyalty);
}

const WITH_LOYALTY: Loyalty = {
  code: 'FG-SAUGE-7212',
  valueCents: 2000,
  activatesAt: '2026-06-10T00:00:00.000Z',
};

beforeEach(() => {
  executeMock.mockReset();
  mutationState = { status: 'idle', error: null };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useWizardStore.getState().reset();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('F11 — ThankYouStep loyalty wiring', () => {
  it('F11-C001 code de fidélité présent → LoyaltyCodeCard rendue avec le code', () => {
    seedStore({ loyalty: WITH_LOYALTY });
    render(<ThankYouStep />);
    expect(screen.getByTestId('loyalty-code-card')).toBeInTheDocument();
    expect(screen.getByTestId('loyalty-code-value')).toHaveTextContent('FG-SAUGE-7212');
    expect(screen.getByTestId('loyalty-code-copy')).toBeInTheDocument();
  });

  it('F11-C002 pas de loyalty → pas de carte, écran intact', () => {
    seedStore({ loyalty: null });
    render(<ThankYouStep />);
    expect(screen.queryByTestId('loyalty-code-card')).toBeNull();
    expect(screen.getByTestId('wizard-step-thankyou')).toBeInTheDocument();
  });

  it('F11-C003 loyalty.code falsy → pas de carte', () => {
    seedStore({ loyalty: { code: '', valueCents: 2000, activatesAt: null } });
    render(<ThankYouStep />);
    expect(screen.queryByTestId('loyalty-code-card')).toBeNull();
  });

  it('F11-C004 valeur propagée affichée en terracotta', () => {
    seedStore({ loyalty: WITH_LOYALTY });
    render(<ThankYouStep />);
    const card = screen.getByTestId('loyalty-code-card');
    const terracotta = card.querySelector('.text-\\[\\#C28A6E\\]');
    expect(terracotta).not.toBeNull();
    expect(terracotta?.textContent ?? '').toContain('20');
  });

  it('F11-C005 bouton copier appelle clipboard et bascule en « Copié »', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    seedStore({ loyalty: WITH_LOYALTY });
    render(<ThankYouStep />);
    fireEvent.click(screen.getByTestId('loyalty-code-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('FG-SAUGE-7212'));
    expect(await screen.findByText('Copié')).toBeInTheDocument();
  });

  it('F11-C006 date d’activation civile affichée (mois en lettres, pas de countdown)', () => {
    seedStore({ loyalty: { ...WITH_LOYALTY, activatesAt: '2026-06-10T00:00:00.000Z' } });
    render(<ThankYouStep />);
    const card = screen.getByTestId('loyalty-code-card');
    expect(card.textContent ?? '').toMatch(/à partir du 10 juin/);
    expect(card.textContent ?? '').not.toMatch(/[%]/);
  });

  it('F11-C007 activatesAt null → pas de ligne activation, carte présente', () => {
    seedStore({ loyalty: { ...WITH_LOYALTY, activatesAt: null } });
    render(<ThankYouStep />);
    expect(screen.getByTestId('loyalty-code-card')).toBeInTheDocument();
    expect(screen.getByTestId('loyalty-code-card').textContent ?? '').not.toMatch(/à partir du/);
  });

  it('F11-C008 activatesAt invalide → ignoré sans crash', () => {
    seedStore({ loyalty: { ...WITH_LOYALTY, activatesAt: 'not-a-date' } });
    render(<ThankYouStep />);
    expect(screen.getByTestId('loyalty-code-card')).toBeInTheDocument();
    expect(screen.getByTestId('loyalty-code-card').textContent ?? '').not.toMatch(/à partir du/);
  });

  it('F11-C009 clipboard indisponible → catch silencieux, pas de bascule', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('no clipboard'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    seedStore({ loyalty: WITH_LOYALTY });
    render(<ThankYouStep />);
    fireEvent.click(screen.getByTestId('loyalty-code-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    // Pas de bascule « Copié » ; le libellé reste « Copier ».
    expect(screen.queryByText('Copié')).toBeNull();
    expect(screen.getByTestId('loyalty-code-copy').textContent ?? '').toContain('Copier');
  });

  it('F11-C010 i18n arabe : RTL + bouton « نسخ » + درهم', () => {
    seedStore({ loyalty: WITH_LOYALTY, language: 'ar' });
    render(<ThankYouStep />);
    const card = screen.getByTestId('loyalty-code-card');
    expect(card).toHaveAttribute('dir', 'rtl');
    expect(screen.getByTestId('loyalty-code-copy').textContent ?? '').toContain('نسخ');
    expect(card).toHaveTextContent('درهم');
  });

  it('F11-C011 INV-PII : aucun téléphone (6+ chiffres) sur l’écran merci', () => {
    seedStore({ loyalty: WITH_LOYALTY });
    render(<ThankYouStep />);
    const txt = screen.getByTestId('wizard-step-thankyou').textContent ?? '';
    expect(txt).not.toMatch(/\d{6,}/);
  });

  it('F11-V012 charte : aucun caractère interdit dans la carte', () => {
    seedStore({ loyalty: WITH_LOYALTY });
    render(<ThankYouStep />);
    const txt = screen.getByTestId('loyalty-code-card').textContent ?? '';
    expect(txt).not.toMatch(/[%!]|🎉|⏰/);
  });
});
