/**
 * CHA-300 — Tests routes admin Suggestions `[id]` : PATCH/POST/DELETE.
 *
 * Couvre : 404 si non-existant, action toggle/publish/delete, patch normal,
 * form-encoded → 303.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/repos/canned-pair', () => ({
  cannedPairRepo: {
    getById: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  },
}));

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { cannedPairRepo } from '@/lib/chat/repos/canned-pair';
import { DELETE, PATCH, POST } from './route';

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const getByIdMock = cannedPairRepo.getById as unknown as ReturnType<typeof vi.fn>;
const updateMock = cannedPairRepo.update as unknown as ReturnType<typeof vi.fn>;
const deleteByIdMock = cannedPairRepo.deleteById as unknown as ReturnType<typeof vi.fn>;

const ROW = {
  id: 'cnp_1',
  key: 'pricing-pack',
  pagePattern: '/kit/*',
  audience: 'all' as const,
  order: 100,
  enabled: true,
  labelFr: 'Voir le prix',
  labelAr: 'شاهد السعر',
  labelArMa: 'شوف الثمن',
  scriptedReplyFr: 'Le pack coûte 299 MAD.',
  scriptedReplyAr: 'السعر 299 درهم.',
  scriptedReplyArMa: 'الثمن 299 درهم.',
  ctaLabel: 'Voir le pack' as string | null,
  ctaUrl: '/kit' as string | null,
  allowFollowupLlm: false,
  status: 'draft' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function jsonReq(body: unknown, method: 'PATCH' | 'POST' = 'PATCH'): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/suggestions/cnp_1', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formReq(body: Record<string, string>): NextRequest {
  const form = new URLSearchParams(body);
  return new NextRequest('http://localhost/api/admin/chat/suggestions/cnp_1', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('PATCH /api/admin/chat/suggestions/[id]', () => {
  it('rejette si non authentifié (401)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await PATCH(jsonReq({}), { params: { id: 'cnp_1' } });
    expect(res.status).toBe(401);
  });

  it('renvoie 404 si la suggestion n\'existe pas', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(null);
    const res = await PATCH(jsonReq({ key: 'new' }), { params: { id: 'cnp_x' } });
    expect(res.status).toBe(404);
  });

  it('action toggle bascule enabled', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce({ ...ROW, enabled: true });
    updateMock.mockResolvedValueOnce({ ...ROW, enabled: false });
    const res = await PATCH(jsonReq({ _action: 'toggle' }), {
      params: { id: 'cnp_1' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enabled: boolean };
    expect(body.enabled).toBe(false);
    expect(updateMock).toHaveBeenCalledWith('cnp_1', { enabled: false });
  });

  it('action publish met status=published', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce({ ...ROW, status: 'draft' });
    updateMock.mockResolvedValueOnce({ ...ROW, status: 'published' });
    const res = await PATCH(jsonReq({ _action: 'publish' }), {
      params: { id: 'cnp_1' },
    });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('cnp_1', { status: 'published' });
  });

  it('action delete supprime', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    deleteByIdMock.mockResolvedValueOnce(true);
    const res = await PATCH(jsonReq({ _action: 'delete' }), {
      params: { id: 'cnp_1' },
    });
    expect(res.status).toBe(200);
    expect(deleteByIdMock).toHaveBeenCalledWith('cnp_1');
  });

  it('patch normal met à jour les champs fournis', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    updateMock.mockResolvedValueOnce({
      ...ROW,
      order: 50,
      labelFr: 'Nouveau label',
    });
    const res = await PATCH(
      jsonReq({ order: 50, labelFr: 'Nouveau label', status: 'review' }),
      { params: { id: 'cnp_1' } },
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('cnp_1', {
      order: 50,
      labelFr: 'Nouveau label',
      status: 'review',
    });
  });

  it('patch ignore les champs aux types invalides', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    updateMock.mockResolvedValueOnce(ROW);
    await PATCH(
      jsonReq({ audience: 'wrong-value', order: 'NaN', enabled: 'true' }),
      { params: { id: 'cnp_1' } },
    );
    expect(updateMock).toHaveBeenCalledWith('cnp_1', {});
  });
});

describe('POST /api/admin/chat/suggestions/[id] (form-encoded)', () => {
  it('form toggle redirige 303 vers liste avec flash enabled/disabled', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce({ ...ROW, enabled: true });
    updateMock.mockResolvedValueOnce({ ...ROW, enabled: false });
    const res = await POST(formReq({ _action: 'toggle' }), {
      params: { id: 'cnp_1' },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(
      '/admin/chat/suggestions?ok=disabled',
    );
  });

  it('form delete redirige 303 vers liste avec flash deleted', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    deleteByIdMock.mockResolvedValueOnce(true);
    const res = await POST(formReq({ _action: 'delete' }), {
      params: { id: 'cnp_1' },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(
      '/admin/chat/suggestions?ok=deleted',
    );
  });

  it('form publish redirige 303 vers liste avec flash published', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce({ ...ROW, status: 'draft' });
    updateMock.mockResolvedValueOnce({ ...ROW, status: 'published' });
    const res = await POST(formReq({ _action: 'publish' }), {
      params: { id: 'cnp_1' },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(
      '/admin/chat/suggestions?ok=published',
    );
  });

  it('form patch normal redirige 303 vers liste avec flash updated', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    updateMock.mockResolvedValueOnce({ ...ROW, order: 50 });
    const res = await POST(formReq({ order: '50', status: 'published' }), {
      params: { id: 'cnp_1' },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(
      '/admin/chat/suggestions?ok=updated',
    );
  });
});

describe('DELETE /api/admin/chat/suggestions/[id]', () => {
  it('rejette si non authentifié (401)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await DELETE(jsonReq({}, 'POST'), { params: { id: 'cnp_1' } });
    expect(res.status).toBe(401);
  });

  it('renvoie 404 si la suggestion n\'existe pas', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    deleteByIdMock.mockResolvedValueOnce(false);
    const res = await DELETE(jsonReq({}, 'POST'), { params: { id: 'cnp_x' } });
    expect(res.status).toBe(404);
  });

  it('happy path supprime et renvoie 200', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    deleteByIdMock.mockResolvedValueOnce(true);
    const res = await DELETE(jsonReq({}, 'POST'), { params: { id: 'cnp_1' } });
    expect(res.status).toBe(200);
  });
});
