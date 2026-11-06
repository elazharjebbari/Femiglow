import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toAdminStockView } from '@/lib/checkout/stock-status';

import { VariantStockPanel } from './VariantStockPanel';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const base = { variantId: 'pvar_kit', sku: 'FEMI-KIT-100', available: 500, reserved: 0, thresholdLow: 5 };

function view(over: Partial<typeof base> & { sellWhenOut?: boolean } = {}, soldLast7Days: number | null = 875) {
  return toAdminStockView({ sellWhenOut: true, ...base, ...over }, { soldLast7Days });
}

function renderPanel(stock = view() as ReturnType<typeof view> | null) {
  return render(
    <VariantStockPanel variantId="pvar_kit" sku="FEMI-KIT-100" label="Le kit" initialStock={stock} readable />,
  );
}

function reply(status: number, body: unknown) {
  return vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

const ok = (available: number) =>
  reply(200, { variantId: 'pvar_kit', available, reserved: 0, thresholdLow: 5, sellWhenOut: true, replayed: false });

beforeEach(() => {
  refresh.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<VariantStockPanel/>', () => {
  it('montre le stock restant, le rythme et l’autonomie', () => {
    renderPanel();
    expect(screen.getByTestId('stock-value')).toHaveTextContent('500');
    expect(screen.getByText(/≈ 125 \/ jour/)).toBeInTheDocument();
    expect(screen.getByText(/≈ 4 jours/)).toBeInTheDocument();
    expect(screen.getByText('Bientôt épuisé')).toBeInTheDocument();
  });

  it('affiche le stock négatif et les commandes à couvrir', () => {
    renderPanel(view({ available: -12 }));
    expect(screen.getByTestId('stock-value')).toHaveTextContent('−12');
    expect(screen.getByText(/12 commandes à couvrir/)).toBeInTheDocument();
    expect(screen.getByText('Stock négatif')).toBeInTheDocument();
  });

  it('réception : montre le résultat avant d’envoyer, puis met à jour le chiffre', async () => {
    const fetchMock = ok(700);
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    expect(screen.getByRole('button', { name: 'Ajouter au stock' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Unités reçues'), { target: { value: '200' } });
    expect(screen.getByText(/Résultat/)).toHaveTextContent('500 → 700');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au stock' }));
    await waitFor(() => expect(screen.getByTestId('stock-value')).toHaveTextContent('700'));
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ action: 'restock', value: 200, variantId: 'pvar_kit' });
    expect(body.idempotencyKey).toEqual(expect.any(String));
    expect(refresh).toHaveBeenCalled();
  });

  it('une nouvelle saisie porte une nouvelle clé d’idempotence', async () => {
    const fetchMock = ok(600);
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    for (const n of ['1', '2']) {
      fireEvent.change(screen.getByLabelText('Unités reçues'), { target: { value: n } });
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter au stock' }));
      await waitFor(() => expect(screen.getByLabelText('Unités reçues')).toHaveValue(''));
    }
    const keys = fetchMock.mock.calls.map(
      (c) => JSON.parse((c as [string, RequestInit])[1].body as string).idempotencyKey,
    );
    expect(new Set(keys).size).toBe(2);
  });

  it('échec réseau : la même saisie garde sa clé pour un nouvel essai sans doublon', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce(
      new Response(JSON.stringify({ variantId: 'pvar_kit', available: 700, reserved: 0, thresholdLow: 5, sellWhenOut: true, replayed: true })),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    fireEvent.change(screen.getByLabelText('Unités reçues'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au stock' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au stock' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const keys = fetchMock.mock.calls.map(
      (c) => JSON.parse((c as [string, RequestInit])[1].body as string).idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it('inventaire : envoie la valeur vue à l’écran', async () => {
    const fetchMock = ok(480);
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Inventaire' }));
    fireEvent.change(screen.getByLabelText('Quantité comptée'), { target: { value: '480' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remplacer par ce comptage' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ action: 'count', value: 480, expectedAvailable: 500 });
  });

  it('inventaire en conflit : explique et affiche le nouveau stock', async () => {
    vi.stubGlobal('fetch', reply(409, { error: { code: 'stock_changed', details: { available: 497 } } }));
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Inventaire' }));
    fireEvent.change(screen.getByLabelText('Quantité comptée'), { target: { value: '480' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remplacer par ce comptage' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Des commandes sont passées entre-temps');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('497');
  });

  it('refuse une saisie non numérique', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Unités reçues'), { target: { value: '12a' } });
    expect(screen.getByRole('button', { name: 'Ajouter au stock' })).toBeDisabled();
  });

  it('prévient quand la session a expiré', async () => {
    vi.stubGlobal('fetch', reply(404, {}));
    renderPanel();
    fireEvent.change(screen.getByLabelText('Unités reçues'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au stock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('session a peut-être expiré');
  });

  it('bascule la règle à 0', async () => {
    const fetchMock = reply(200, { variantId: 'pvar_kit', available: 500, reserved: 0, thresholdLow: 5, sellWhenOut: false, replayed: false });
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /À 0, continuer à vendre/ }));
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ action: 'set_sell_when_out', value: false });
    expect(screen.getByRole('checkbox', { name: /À 0, continuer à vendre/ })).not.toBeChecked();
  });

  it('variante sans compteur : annonce que la première réception le crée', () => {
    renderPanel(null);
    expect(screen.getByText(/première réception le crée/)).toBeInTheDocument();
    expect(screen.getByTestId('stock-value')).toHaveTextContent('0');
  });

  it('compteur illisible : aucun geste possible', () => {
    render(<VariantStockPanel variantId="pvar_kit" sku="FEMI-KIT-100" label="Le kit" initialStock={null} readable={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('pas pu être lu');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
