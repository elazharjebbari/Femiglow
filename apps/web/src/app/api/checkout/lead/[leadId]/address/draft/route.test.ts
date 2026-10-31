import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const patchAddressDraft = vi.fn();
const patchAddress = vi.fn();
vi.mock('@/lib/checkout/repos/lead-repo', () => ({
  wizardLeadRepo: { patchAddressDraft, patchAddress },
}));

const { PATCH } = await import('./route');

const call = (body: unknown) =>
  PATCH(
    new NextRequest('http://t.local/api/checkout/lead/cl_1234/address/draft', {
      method: 'PATCH',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: { leadId: 'cl_1234' } },
  );

beforeEach(() => {
  patchAddressDraft.mockReset();
  patchAddress.mockReset();
});

describe('PATCH /api/checkout/lead/[id]/address/draft', () => {
  it('enregistre le seul champ reçu, sans valider l’étape', async () => {
    patchAddressDraft.mockResolvedValue({ id: 'cl_1234' });
    const res = await call({ city: 'Casablanca' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: true });
    expect(patchAddressDraft).toHaveBeenCalledWith('cl_1234', { city: 'Casablanca' });
    expect(patchAddress).not.toHaveBeenCalled();
  });

  it('lead introuvable ou commande déjà passée : 200, rien d’écrit', async () => {
    patchAddressDraft.mockResolvedValue(null);
    const res = await call({ city: 'Rabat' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: false });
  });

  it('panne de base : 200, pour ne pas bloquer la commande dans la file', async () => {
    patchAddressDraft.mockRejectedValue(new Error('db down'));
    const res = await call({ city: 'Rabat' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: false });
  });

  it('données invalides : refusées', async () => {
    expect((await call({})).status).toBeGreaterThanOrEqual(400);
    expect((await call('pas du json')).status).toBeGreaterThanOrEqual(400);
    expect(patchAddressDraft).not.toHaveBeenCalled();
  });
});
