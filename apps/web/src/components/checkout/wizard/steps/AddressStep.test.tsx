/**
 * CHA-231 / CHA-230 — Tests de AddressStep (step adresse simplifié).
 *
 * Couvre :
 *  - Champs supprimés (postal code, addressLine2, shipping mode radio) NE
 *    sont PAS rendus.
 *  - Bloc de réassurance livraison présent (mono-mode), dynamique selon la
 *    ville sélectionnée (CHA-230).
 *  - Combobox CHA-230 : popup listbox piloté par `useDeliveryCities()`, sélection
 *    clavier (Down + Enter) injecte le nom FR canonique dans le form ; l'absence
 *    de matching laisse le texte libre passer.
 *  - Submit déclenche la chaîne address → payment(cod) → order via
 *    `useAddressMutation`, avec le nom FR canonique injecté par le combobox.
 *  - Bouton submit désactivé tant que les inputs sont invalides.
 *  - Bandeau d'erreur affiché si la mutation échoue.
 *
 * NOTE : on mock `useDeliveryCities` pour ne pas appeler `/api` en test —
 * c'est testé indépendamment dans `use-delivery-cities.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks : useAddressMutation (isole AddressStep de la chaîne réseau)
// ─────────────────────────────────────────────────────────────────────────────

const executeMock = vi.fn();
const resetMock = vi.fn();
let mutationState: {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: { code: string; message: string; httpStatus: number } | null;
} = { status: 'idle', error: null };

vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useAddressMutation: () => ({
    status: mutationState.status,
    error: mutationState.error,
    execute: executeMock,
    reset: resetMock,
  }),
}));

// StockIndicator fait des appels API : on stub pour éviter les warnings de fetch.
vi.mock('@/components/checkout/wizard/StockIndicator', () => ({
  StockIndicator: () => null,
}));

// CHA-230 — Mock du hook de fetch des villes (sinon AddressStep tente un
// `fetch('/api/delivery-cities/search')` qui échouera en jsdom).
//
// Pattern : un setter `setMockedCities()` permet à chaque test de configurer
// ce que le combobox affichera, indépendamment de la valeur tapée.
let mockedCities: PublicCity[] = [];
const setMockedCities = (cities: PublicCity[]) => {
  mockedCities = cities;
};
vi.mock('@/lib/checkout/delivery/use-delivery-cities', () => ({
  useDeliveryCities: () => ({
    query: '',
    items: mockedCities,
    loading: false,
    error: null,
  }),
}));

// Doit être importé APRÈS les mocks pour qu'ils prennent effet.
import { AddressStep } from './AddressStep';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CART: CartSnapshot = {
  items: [
    {
      variantId: 'pvar_test',
      sku: 'FEMI-KIT-100',
      name: 'Kit FemiGlow',
      quantity: 1,
      unitPriceCents: 32000,
    },
  ],
  totalCents: 32000,
  currency: 'MAD',
};

const CASABLANCA: PublicCity = {
  slug: 'casablanca',
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  deliveryPriceMad: 19,
  deliveryEta: '24h',
  aliases: ['Casa', 'Dar el Beida'],
};

const RABAT: PublicCity = {
  slug: 'rabat',
  nameFr: 'Rabat',
  nameAr: 'الرباط',
  deliveryPriceMad: 29,
  deliveryEta: '24h - 48h',
  aliases: [],
};

function seedStore(opts: {
  leadId?: string | null;
  cart?: CartSnapshot | null;
}) {
  const { setLeadId, setFormContext, setCartSnapshot, reset } =
    useWizardStore.getState();
  reset();
  setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
  });
  if (opts.leadId) setLeadId(opts.leadId);
  if (opts.cart) setCartSnapshot(opts.cart);
}

beforeEach(() => {
  executeMock.mockReset();
  resetMock.mockReset();
  mutationState = { status: 'idle', error: null };
  setMockedCities([]);
  seedStore({ leadId: 'cl_test', cart: MOCK_CART });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AddressStep — champs supprimés CHA-231', () => {
  it("ne rend PAS de champ « code postal »", () => {
    render(<AddressStep />);
    expect(screen.queryByLabelText(/code postal/i)).toBeNull();
  });

  it("ne rend PAS de champ « complément d'adresse » / addressLine2", () => {
    render(<AddressStep />);
    expect(screen.queryByLabelText(/complément/i)).toBeNull();
    expect(screen.queryByLabelText(/line ?2/i)).toBeNull();
  });

  it('ne rend AUCUN radio button « mode de livraison »', () => {
    render(<AddressStep />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('AddressStep — bloc réassurance livraison', () => {
  it('rend ShippingNotice (role="note")', () => {
    render(<AddressStep />);
    const notice = screen.getByTestId('wizard-shipping-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveAttribute('role', 'note');
  });

  it('affiche le message générique tant qu\'aucune ville n\'est sélectionnée', () => {
    render(<AddressStep />);
    const body = screen.getByTestId('wizard-shipping-body');
    expect(body.textContent ?? '').toMatch(/livraison gratuite/i);
    expect(body.textContent ?? '').toMatch(/24-48/);
  });

  it('CHA-230 : affiche un prix dynamique quand une ville payante est sélectionnée', async () => {
    setMockedCities([CASABLANCA]);
    const user = userEvent.setup();
    render(<AddressStep />);

    // Ouvre le combobox + sélectionne Casablanca au clavier.
    const cityInput = screen.getByTestId('wizard-address-city');
    await user.click(cityInput);
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      const body = screen.getByTestId('wizard-shipping-body');
      expect(body.textContent ?? '').toMatch(/19 MAD/);
      expect(body.textContent ?? '').toMatch(/24h/);
    });
  });
});

describe('AddressStep — champs rendus', () => {
  it('rend uniquement ville + adresse + notes (3 champs)', () => {
    render(<AddressStep />);
    expect(screen.getByTestId('wizard-address-city')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-address-line1')).toBeInTheDocument();
    expect(screen.getByLabelText(/note pour le livreur/i)).toBeInTheDocument();
  });

  it("expose un combobox WAI-ARIA pour la ville (role=combobox)", () => {
    render(<AddressStep />);
    const input = screen.getByTestId('wizard-address-city');
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it("affiche le hint bilingue par défaut (FR + AR)", () => {
    render(<AddressStep />);
    const hint = screen.getByText(/français ou en arabe/i);
    expect(hint).toBeInTheDocument();
    expect(hint.textContent ?? '').toContain('الدار البيضاء');
  });

  it('affiche le hint de ville reconnue quand la saisie matche un alias', async () => {
    setMockedCities([CASABLANCA]);
    const user = userEvent.setup();
    render(<AddressStep />);

    await user.type(screen.getByTestId('wizard-address-city'), 'Casa');

    await waitFor(() => {
      expect(screen.getByText(/Reconnu\s*:\s*Casablanca/i)).toBeInTheDocument();
    });
  });
});

describe('AddressStep — combobox CHA-230', () => {
  it('affiche les options FR + AR + prix/ETA dans le listbox', async () => {
    setMockedCities([CASABLANCA, RABAT]);
    const user = userEvent.setup();
    render(<AddressStep />);

    await user.click(screen.getByTestId('wizard-address-city'));

    // Le listbox s'ouvre au focus.
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // Casablanca + son AR + prix.
    expect(screen.getByText('Casablanca')).toBeInTheDocument();
    expect(screen.getByText('الدار البيضاء')).toBeInTheDocument();
    expect(screen.getByText(/19 MAD/)).toBeInTheDocument();
    expect(screen.getByText('Rabat')).toBeInTheDocument();
  });

  it('clavier : ArrowDown + Enter commit Casablanca dans le champ', async () => {
    setMockedCities([CASABLANCA]);
    const user = userEvent.setup();
    render(<AddressStep />);

    const cityInput = screen.getByTestId('wizard-address-city');
    await user.click(cityInput);
    await user.keyboard('{ArrowDown}{Enter}');

    expect((cityInput as HTMLInputElement).value).toBe('Casablanca');
  });

  it('click souris sur une option commit la ville', async () => {
    setMockedCities([CASABLANCA, RABAT]);
    const user = userEvent.setup();
    render(<AddressStep />);

    const cityInput = screen.getByTestId('wizard-address-city');
    await user.click(cityInput);
    const option = await screen.findByText('Rabat');
    await user.click(option);

    expect((cityInput as HTMLInputElement).value).toBe('Rabat');
  });

  it('Escape ferme le listbox', async () => {
    setMockedCities([CASABLANCA]);
    const user = userEvent.setup();
    render(<AddressStep />);

    const cityInput = screen.getByTestId('wizard-address-city');
    await user.click(cityInput);
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('AddressStep — submit', () => {
  it('le bouton submit est désactivé tant que les champs ne sont pas valides', () => {
    render(<AddressStep />);
    const btn = screen.getByTestId('wizard-address-submit');
    expect(btn).toBeDisabled();
  });

  it("appelle execute avec ville canonique FR + shippingMode=standard", async () => {
    setMockedCities([CASABLANCA]);
    const user = userEvent.setup();
    executeMock.mockResolvedValue(undefined);
    render(<AddressStep />);

    // Sélection clavier de Casablanca via le combobox.
    const cityInput = screen.getByTestId('wizard-address-city');
    await user.click(cityInput);
    await user.keyboard('{ArrowDown}{Enter}');

    await user.type(screen.getByTestId('wizard-address-line1'), '12 rue des Roses');

    const btn = screen.getByTestId('wizard-address-submit');
    await waitFor(() => expect(btn).not.toBeDisabled());

    fireEvent.click(btn);

    await waitFor(() => {
      expect(executeMock).toHaveBeenCalledTimes(1);
    });
    const args = executeMock.mock.calls[0]?.[0];
    expect(args.city).toBe('Casablanca');
    expect(args.addressLine1).toBe('12 rue des Roses');
    expect(args.country).toBe('MA');
    expect(args.shippingMode).toBe('standard');
  });

  it('autorise une saisie libre (ville inconnue) — le serveur reste tolérant', async () => {
    setMockedCities([]); // aucune ville reconnue
    const user = userEvent.setup();
    executeMock.mockResolvedValue(undefined);
    render(<AddressStep />);

    await user.type(screen.getByTestId('wizard-address-city'), 'Petit Village');
    await user.type(screen.getByTestId('wizard-address-line1'), '12 rue des Roses');

    const btn = screen.getByTestId('wizard-address-submit');
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);

    await waitFor(() => expect(executeMock).toHaveBeenCalled());
    const args = executeMock.mock.calls[0]?.[0];
    expect(args.city).toBe('Petit Village');
  });

  it("affiche un bandeau d'erreur si la mutation échoue (stock)", () => {
    mutationState = {
      status: 'error',
      error: { code: 'stock_insufficient', message: '', httpStatus: 409 },
    };
    render(<AddressStep />);
    const banner = screen.getByTestId('wizard-address-error');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner.textContent ?? '').toMatch(/stock/i);
  });

  it('affiche le statut "processing" pendant la mutation', () => {
    mutationState = { status: 'loading', error: null };
    render(<AddressStep />);
    expect(screen.getByTestId('wizard-address-processing')).toBeInTheDocument();
  });
});
