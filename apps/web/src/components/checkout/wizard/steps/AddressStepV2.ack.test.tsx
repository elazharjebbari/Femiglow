/**
 * Étape 2 — accusé de l'étape 1 : « C'est noté, on vous appelle ».
 * Affiché seulement s'il dit vrai, replié dès que la saisie commence.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';
import { getWizardDictionary } from '@/lib/checkout/i18n/dictionary';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

const emit = vi.fn();
vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useAddressMutation: () => ({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit, flush: vi.fn(), isReady: true, consent: {} }),
}));
vi.mock('@/lib/checkout/use-shipping-config', () => ({
  useShippingConfig: () => ({ freeShipping: false }),
}));
vi.mock('@/components/checkout/wizard/StockIndicator', () => ({ StockIndicator: () => null }));

const CASA: PublicCity = {
  slug: 'casablanca',
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  aliases: [],
  deliveryPriceMad: 35,
  deliveryEta: '24h-48h',
};
vi.mock('@/lib/checkout/delivery/use-delivery-cities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDeliveryCities: () => ({ items: [CASA], loading: false }),
}));

const { AddressStepV2 } = await import('./AddressStepV2');

const fr = getWizardDictionary('fr').addressV2;
const PHONE = '06 26 62 88 30';

interface SeedOptions {
  ack?: boolean;
  phone?: string;
  firstName?: string;
  language?: 'fr' | 'ar' | 'en';
}

function seed({ ack = true, phone = '0626628830', firstName = 'Salma', language = 'fr' }: SeedOptions = {}) {
  useWizardStore.getState().reset();
  useWizardStore.setState({
    leadId: 'lead_1',
    leadDraft: { ...useWizardStore.getState().leadDraft, firstName, phone },
    cartSnapshot: {
      items: [{ variantId: 'pvar_1', sku: 'KIT', name: 'Kit', quantity: 1, unitPriceCents: 19900 }],
      totalCents: 19900,
      currency: 'MAD',
    },
    formContext: {
      formId: 'wizard_kit',
      formMode: 'wizard_embed',
      variantKey: 'A',
      source: 'wizard_kit',
      step2Variant: 'v2',
      step2Ack: ack,
      language,
    },
  });
}

const notice = () => screen.getByTestId('wizard-lead-ack');
const city = () => screen.getByTestId('wizard-address-city') as HTMLInputElement;
const eventParams = (name: string) => emit.mock.calls.find((c) => c[0] === name)?.[1];

function mockPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: coarse && query.includes('coarse'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  emit.mockClear();
  mockPointer(false);
  seed();
});
afterEach(() => vi.unstubAllGlobals());

describe('accusé — arrivée', () => {
  it('carte complète : prénom, numéro relu, raison de donner sa ville', () => {
    render(<AddressStepV2 />);
    expect(notice()).toHaveAttribute('data-expanded', 'true');
    expect(notice()).toHaveTextContent(fr.ackTitle('Salma'));
    expect(notice()).toHaveTextContent(fr.ackBody(PHONE));
    expect(screen.getByText(fr.subtitleAck)).toBeInTheDocument();
    expect(screen.queryByText(fr.subtitle)).not.toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-address')).toHaveAttribute('data-ack', 'true');
  });

  it('numéro saisi en +212 : affiché au format local', () => {
    seed({ phone: '+212 626 62 88 30' });
    render(<AddressStepV2 />);
    expect(notice()).toHaveTextContent(PHONE);
  });

  it('sans prénom : titre neutre', () => {
    seed({ firstName: '' });
    render(<AddressStepV2 />);
    expect(notice()).toHaveTextContent(fr.ackTitleNoName);
  });

  it.each(['ar', 'en'] as const)('langue %s : textes du dictionnaire, numéro de gauche à droite', (language) => {
    seed({ language });
    render(<AddressStepV2 />);
    const copy = getWizardDictionary(language).addressV2;
    expect(notice()).toHaveTextContent(copy.ackTitle('Salma'));
    expect(screen.getByText(PHONE)).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText(copy.subtitleAck)).toBeInTheDocument();
  });
});

describe('accusé — ne s’affiche que s’il dit vrai', () => {
  it('réglage coupé : écran d’avant, sous-titre d’avant', () => {
    seed({ ack: false });
    render(<AddressStepV2 />);
    expect(screen.queryByTestId('wizard-lead-ack')).not.toBeInTheDocument();
    expect(screen.getByText(fr.subtitle)).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-address')).toHaveAttribute('data-ack', 'false');
  });

  it('enregistrement en échec : pas de « c’est noté »', () => {
    useWizardStore.getState().markSyncDegraded();
    render(<AddressStepV2 />);
    expect(screen.queryByTestId('wizard-lead-ack')).not.toBeInTheDocument();
    expect(screen.getByText(fr.subtitle)).toBeInTheDocument();
  });

  it('enregistrement qui échoue pendant l’étape : l’accusé disparaît', () => {
    render(<AddressStepV2 />);
    expect(notice()).toBeInTheDocument();
    act(() => useWizardStore.getState().markSyncDegraded());
    expect(screen.queryByTestId('wizard-lead-ack')).not.toBeInTheDocument();
  });

  it.each(['', '06 26', '0126628830'])('numéro illisible « %s » : rien', (phone) => {
    seed({ phone });
    render(<AddressStepV2 />);
    expect(screen.queryByTestId('wizard-lead-ack')).not.toBeInTheDocument();
  });
});

describe('accusé — se replie et ne rebondit pas', () => {
  it('pointeur fin (ordinateur) : le focus seul ne replie pas', () => {
    render(<AddressStepV2 />);
    fireEvent.focus(city());
    expect(notice()).toHaveAttribute('data-expanded', 'true');
  });

  it('écran tactile : replié au premier contact avec le champ, et le reste', () => {
    mockPointer(true);
    render(<AddressStepV2 />);
    fireEvent.focus(city());
    expect(notice()).toHaveAttribute('data-expanded', 'false');
    expect(notice()).toHaveTextContent(fr.ackCompact(PHONE));
    fireEvent.blur(city());
    expect(notice()).toHaveAttribute('data-expanded', 'false');
  });

  it('première lettre tapée : replié ; champ vidé : reste replié', async () => {
    render(<AddressStepV2 />);
    fireEvent.change(city(), { target: { value: 'C' } });
    await waitFor(() => expect(notice()).toHaveAttribute('data-expanded', 'false'));
    fireEvent.change(city(), { target: { value: '' } });
    expect(notice()).toHaveAttribute('data-expanded', 'false');
  });

  it('ville choisie : ligne repliée toujours visible au-dessus du formulaire', async () => {
    render(<AddressStepV2 />);
    fireEvent.focus(city());
    fireEvent.click(await screen.findByTestId('wizard-address-city-option-casablanca'));
    expect(notice()).toHaveAttribute('data-expanded', 'false');
    expect(notice()).toHaveTextContent(PHONE);
  });

  it('retour avec une ville déjà saisie : replié d’emblée', () => {
    useWizardStore.getState().mergeAddressDraft({ city: 'Casablanca', citySlug: 'casablanca' });
    render(<AddressStepV2 />);
    expect(notice()).toHaveAttribute('data-expanded', 'false');
  });
});

describe('accusé — mesure', () => {
  it('address_step_view porte le bras, sans numéro ni prénom', () => {
    render(<AddressStepV2 />);
    const params = eventParams('address_step_view');
    expect(params).toMatchObject({ step2_variant: 'v2', step2_ack: true });
    expect(JSON.stringify(emit.mock.calls)).not.toContain('62 88');
    expect(JSON.stringify(emit.mock.calls)).not.toContain('Salma');
  });

  it('réglage coupé : step2_ack à false', () => {
    seed({ ack: false });
    render(<AddressStepV2 />);
    expect(eventParams('address_step_view')).toMatchObject({ step2_ack: false });
  });
});
