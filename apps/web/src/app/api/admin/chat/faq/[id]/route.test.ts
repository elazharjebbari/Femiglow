/**
 * CHA-303 — Tests routes admin FAQ `[id]` : PATCH/POST/DELETE.
 *
 * Couvre :
 *   - 404 si l'entrée n'existe pas
 *   - PATCH champ par champ (toggle, delete, threshold borné, scripted)
 *   - PATCH `questionCanonical` déclenche un ré-embed
 *   - Form `_action=delete` redirige 303
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EmbeddingProviderUnavailableError } from '@/lib/chat/services/embeddings';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/repos/faq', () => ({
  faqRepo: {
    getById: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock('@/lib/chat/services/embeddings', async () => {
  const mod = await vi.importActual<
    typeof import('@/lib/chat/services/embeddings')
  >('@/lib/chat/services/embeddings');
  return {
    ...mod,
    embedTexts: vi.fn(),
  };
});

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { faqRepo } from '@/lib/chat/repos/faq';
import { embedTexts } from '@/lib/chat/services/embeddings';
import { DELETE, PATCH, POST } from './route';

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const embedTextsMock = embedTexts as unknown as ReturnType<typeof vi.fn>;
const getByIdMock = faqRepo.getById as unknown as ReturnType<typeof vi.fn>;
const updateMock = faqRepo.update as unknown as ReturnType<typeof vi.fn>;
const deleteByIdMock = faqRepo.deleteById as unknown as ReturnType<typeof vi.fn>;

const ROW = {
  id: 'fq_1',
  key: 'price-pack-fr',
  language: 'fr' as const,
  questionCanonical: 'Combien coûte le pack ?',
  questionEmbedding: [] as number[],
  scriptedReply: 'reply',
  intentHint: 'pricing' as string | null,
  threshold: '0.55',
  enabled: true,
  audience: 'all' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const FAKE_VECTOR = new Array(1536).fill(0).map((_, i) => i / 1536);

function jsonReq(body: unknown, method: 'PATCH' | 'POST' = 'PATCH'): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/faq/fq_1', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formReq(body: Record<string, string>): NextRequest {
  const form = new URLSearchParams(body);
  return new NextRequest('http://localhost/api/admin/chat/faq/fq_1', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('PATCH /api/admin/chat/faq/[id]', () => {
  it('renvoie 401 si non authentifié', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await PATCH(jsonReq({}), { params: { id: 'fq_1' } });
    expect(res.status).toBe(401);
  });

  it('renvoie 404 si la FAQ n\'existe pas', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(null);
    const res = await PATCH(jsonReq({ scriptedReply: 'nouveau' }), {
      params: { id: 'fq_404' },
    });
    expect(res.status).toBe(404);
  });

  it('toggle bascule enabled', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce({ ...ROW, enabled: true });
    updateMock.mockResolvedValueOnce(null);
    const res = await PATCH(jsonReq({ _action: 'toggle' }), {
      params: { id: 'fq_1' },
    });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('fq_1', { enabled: false });
  });

  it('refuse un threshold hors borne', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    const res = await PATCH(jsonReq({ threshold: 0.1 }), {
      params: { id: 'fq_1' },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('threshold-out-of-range');
  });

  it('patch scriptedReply sans toucher au vecteur', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    updateMock.mockResolvedValueOnce({ ...ROW, scriptedReply: 'nouveau' });
    const res = await PATCH(jsonReq({ scriptedReply: 'nouveau' }), {
      params: { id: 'fq_1' },
    });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const args = updateMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.scriptedReply).toBe('nouveau');
    expect(args.questionEmbedding).toBeUndefined();
    expect(embedTextsMock).not.toHaveBeenCalled();
  });

  it("ré-embed quand questionCanonical change", async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    embedTextsMock.mockResolvedValueOnce({
      vectors: [FAKE_VECTOR],
      model: 'm',
      provider: 'openai',
      dim: 1536,
    });
    updateMock.mockResolvedValueOnce(ROW);
    const res = await PATCH(
      jsonReq({ questionCanonical: 'Quelle est la nouvelle question ?' }),
      { params: { id: 'fq_1' } },
    );
    expect(res.status).toBe(200);
    expect(embedTextsMock).toHaveBeenCalledWith([
      'Quelle est la nouvelle question ?',
    ]);
    const args = updateMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.questionCanonical).toBe('Quelle est la nouvelle question ?');
    expect(args.questionEmbedding).toEqual(FAKE_VECTOR);
  });

  it("renvoie 503 si embed provider unavailable lors d'un re-embed", async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    embedTextsMock.mockRejectedValueOnce(new EmbeddingProviderUnavailableError());
    const res = await PATCH(
      jsonReq({ questionCanonical: 'Nouvelle question' }),
      { params: { id: 'fq_1' } },
    );
    expect(res.status).toBe(503);
  });
});

describe('POST (form) /api/admin/chat/faq/[id]', () => {
  it('action=delete supprime puis redirige 303', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce(ROW);
    deleteByIdMock.mockResolvedValueOnce(true);
    const res = await POST(formReq({ _action: 'delete' }), {
      params: { id: 'fq_1' },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/admin/chat/faq?ok=deleted');
    expect(deleteByIdMock).toHaveBeenCalledWith('fq_1');
  });

  it('action=toggle (form) redirige avec le bon flash', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    getByIdMock.mockResolvedValueOnce({ ...ROW, enabled: true });
    updateMock.mockResolvedValueOnce(null);
    const res = await POST(formReq({ _action: 'toggle' }), {
      params: { id: 'fq_1' },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('?ok=disabled');
  });
});

describe('DELETE /api/admin/chat/faq/[id]', () => {
  it('204 si OK', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    deleteByIdMock.mockResolvedValueOnce(true);
    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/chat/faq/fq_1', {
        method: 'DELETE',
      }),
      { params: { id: 'fq_1' } },
    );
    expect(res.status).toBe(200);
    expect(deleteByIdMock).toHaveBeenCalledWith('fq_1');
  });

  it('404 si not found', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    deleteByIdMock.mockResolvedValueOnce(false);
    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/chat/faq/fq_0', {
        method: 'DELETE',
      }),
      { params: { id: 'fq_0' } },
    );
    expect(res.status).toBe(404);
  });
});
