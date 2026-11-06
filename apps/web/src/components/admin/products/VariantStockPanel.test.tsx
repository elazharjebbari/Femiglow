import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toAdminStockView } from '@/lib/checkout/stock-status';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { VariantStockPanel } from './VariantStockPanel';

const stock = (available: number, reserved = 0, thresholdLow = 5) =>
  toAdminStockView({ variantId: 'pvar_kit', sku: 'FEMI-KIT-100', available, reserved, thresholdLow });

const fetchMock = vi.fn();
const confirmMock = vi.fn();

function respondWith(status: number, body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function respondWithStock(available: number, reserved = 0, thresholdLow = 5) {
  respondWith(200, { variantId: 'pvar_kit', available, reserved, thresholdLow });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function sentBody() {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(String(init.body));
}

function figure(label: string) {
  return within(screen.getByText(label).parentElement as HTMLElement).getByRole('definition');
}

beforeEach(() => {
  fetchMock.mockReset();
  confirmMock.mockReset().mockReturnValue(true);
  refresh.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('confirm', confirmMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<VariantStockPanel/>', () => {
  it('affiche disponible, réservé, effectif, seuil et statut', () => {
    render(<VariantStockPanel initialStock={stock(12, 3, 4)} readable />);
    expect(figure('Disponible')).toHaveTextContent('12');
    expect(figure('Réservé')).toHaveTextContent('3');
    expect(figure('Effectif')).toHaveTextContent('9');
    expect(figure('Seuil')).toHaveTextContent('4');
    expect(screen.getByText('in_stock')).toBeInTheDocument();
  });

  it('définit le disponible après confirmation et rafraîchit l’affichage', async () => {
    respondWithStock(50);
    render(<VariantStockPanel initialStock={stock(0)} readable />);
    expect(screen.getByText('out_of_stock')).toBeInTheDocument();

    type('Définir le disponible', '50');
    click('Définir');

    await waitFor(() => expect(figure('Effectif')).toHaveTextContent('50'));
    expect(confirmMock.mock.calls[0]?.[0]).toContain('FEMI-KIT-100 : 0 → 50');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/products/stock',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(sentBody()).toEqual({ variantId: 'pvar_kit', action: 'set', value: 50 });
    expect(screen.getByText('in_stock')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('disponible 50, effectif 50');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('n’envoie rien si la confirmation est refusée', () => {
    confirmMock.mockReturnValue(false);
    render(<VariantStockPanel initialStock={stock(0)} readable />);
    type('Définir le disponible', '50');
    click('Définir');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('avertit à la confirmation si les commandes resteront refusées', () => {
    confirmMock.mockReturnValue(false);
    render(<VariantStockPanel initialStock={stock(10, 8)} readable />);
    type('Définir le disponible', '5');
    click('Définir');
    expect(confirmMock.mock.calls[0]?.[0]).toContain('les commandes resteront refusées');
  });

  it('ajoute et retire avec un increment signé', async () => {
    respondWithStock(15);
    render(<VariantStockPanel initialStock={stock(10)} readable />);
    type('Ajouter ou retirer', '5');
    click('Ajouter');
    await waitFor(() => expect(figure('Disponible')).toHaveTextContent('15'));
    expect(sentBody()).toEqual({ variantId: 'pvar_kit', action: 'increment', value: 5 });

    fetchMock.mockReset();
    respondWithStock(12);
    type('Ajouter ou retirer', '3');
    click('Retirer');
    await waitFor(() => expect(figure('Disponible')).toHaveTextContent('12'));
    expect(sentBody()).toEqual({ variantId: 'pvar_kit', action: 'increment', value: -3 });
  });

  it('refuse de retirer plus que le disponible', () => {
    render(<VariantStockPanel initialStock={stock(2)} readable />);
    type('Ajouter ou retirer', '3');
    click('Retirer');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de retirer 3');
  });

  it('modifie le seuil', async () => {
    respondWithStock(10, 0, 2);
    render(<VariantStockPanel initialStock={stock(10)} readable />);
    type('Seuil de stock bas', '2');
    click('Modifier');
    await waitFor(() => expect(figure('Seuil')).toHaveTextContent('2'));
    expect(sentBody()).toEqual({ variantId: 'pvar_kit', action: 'set_threshold', value: 2 });
  });

  it.each(['', '-1', '1.5', '1000001'])('rejette la saisie « %s » sans appel', (value) => {
    render(<VariantStockPanel initialStock={stock(10)} readable />);
    type('Définir le disponible', value);
    click('Définir');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Saisis un entier');
  });

  it.each([
    [404, 'session admin expirée'],
    [503, 'Base de données indisponible'],
    [500, 'Erreur interne (500)'],
  ])('affiche une erreur claire sur HTTP %i et garde la valeur', async (status, message) => {
    respondWith(status, { error: { code: 'x', message: 'Erreur interne' } });
    render(<VariantStockPanel initialStock={stock(0)} readable />);
    type('Définir le disponible', '50');
    click('Définir');
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(figure('Disponible')).toHaveTextContent('0');
  });

  it('signale une panne réseau', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    render(<VariantStockPanel initialStock={stock(0)} readable />);
    type('Définir le disponible', '50');
    click('Définir');
    expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur ne répond pas');
  });

  it('adopte la valeur relue par le serveur après refresh', () => {
    const { rerender } = render(<VariantStockPanel initialStock={stock(10)} readable />);
    rerender(<VariantStockPanel initialStock={stock(7)} readable />);
    expect(figure('Disponible')).toHaveTextContent('7');
  });

  it('sans compteur : annonce le refus et ne propose aucune action', () => {
    render(<VariantStockPanel initialStock={null} readable />);
    expect(screen.getByRole('alert')).toHaveTextContent('toute commande est refusée');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('compteur illisible : ne prétend pas qu’il manque', () => {
    render(<VariantStockPanel initialStock={null} readable={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('illisible');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
