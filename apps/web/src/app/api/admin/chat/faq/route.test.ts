/**
 * CHA-303 — Tests routes admin FAQ.
 *
 * On mocke `requireAdminApi`, `embedTexts` et `faqRepo` pour vérifier le
 * happy path (création JSON + form-encoded) et les erreurs (auth, input
 * invalide, embedding provider absent).
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EmbeddingProviderUnavailableError } from '@/lib/chat/services/embeddings';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/repos/faq', () => ({
  faqRepo: {
    upsertEntry: vi.fn(),
    update: vi.fn(),
    listAll: vi.fn(),
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
import { GET, POST } from './route';

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const embedTextsMock = embedTexts as unknown as ReturnType<typeof vi.fn>;
const upsertEntryMock = faqRepo.upsertEntry as unknown as ReturnType<typeof vi.fn>;
const updateMock = faqRepo.update as unknown as ReturnType<typeof vi.fn>;
const listAllMock = faqRepo.listAll as unknown as ReturnType<typeof vi.fn>;

const FAKE_VECTOR = new Array(1536).fill(0).map((_, i) => i / 1536);

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/faq', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formRequest(body: Record<string, string>): NextRequest {
  const form = new URLSearchParams(body);
  return new NextRequest('http://localhost/api/admin/chat/faq', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/admin/chat/faq', () => {
  it('rejette si non authentifié (401)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await POST(
      jsonRequest({
        key: 'price-pack-fr',
        language: 'fr',
        questionCanonical: 'Combien coûte le pack ?',
        scriptedReply: '299 MAD.',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejette les inputs invalides (400)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    const res = await POST(jsonRequest({ key: '', language: 'fr' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-input');
  });

  it('embed + upsert + renvoie 200 JSON en happy path', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    embedTextsMock.mockResolvedValueOnce({
      vectors: [FAKE_VECTOR],
      model: 'text-embedding-3-small',
      dim: 1536,
      provider: 'openai',
    });
    upsertEntryMock.mockResolvedValueOnce({
      id: 'fq_abc',
      inserted: true,
      updated: false,
    });
    const res = await POST(
      jsonRequest({
        key: 'price-pack-fr',
        language: 'fr',
        questionCanonical: 'Combien coûte le pack ?',
        scriptedReply: '299 MAD.',
        threshold: 0.55,
        audience: 'all',
        enabled: true,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; inserted: boolean };
    expect(body.id).toBe('fq_abc');
    expect(body.inserted).toBe(true);
    expect(upsertEntryMock).toHaveBeenCalledTimes(1);
    const args = upsertEntryMock.mock.calls[0]![0] as {
      key: string;
      threshold: number;
    };
    expect(args.key).toBe('price-pack-fr');
    expect(args.threshold).toBe(0.55);
  });

  it("renvoie 503 si l'embedding provider est indisponible", async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    embedTextsMock.mockRejectedValueOnce(new EmbeddingProviderUnavailableError());
    const res = await POST(
      jsonRequest({
        key: 'price-pack-fr',
        language: 'fr',
        questionCanonical: 'Combien coûte ?',
        scriptedReply: 'reply text long enough',
      }),
    );
    expect(res.status).toBe(503);
  });

  it('form-encoded redirige en 303 vers la liste', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    embedTextsMock.mockResolvedValueOnce({
      vectors: [FAKE_VECTOR],
      model: 'm',
      dim: 1536,
      provider: 'openai',
    });
    upsertEntryMock.mockResolvedValueOnce({
      id: 'fq_xyz',
      inserted: false,
      updated: true,
    });
    const res = await POST(
      formRequest({
        key: 'shipping-fr',
        language: 'fr',
        questionCanonical: 'Quand serai-je livré ?',
        scriptedReply: 'Sous 48h.',
        threshold: '0.6',
        audience: 'all',
        enabled: 'on',
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/admin/chat/faq?ok=updated');
  });

  it('applique enabled=false via update après upsert', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    embedTextsMock.mockResolvedValueOnce({
      vectors: [FAKE_VECTOR],
      model: 'm',
      dim: 1536,
      provider: 'openai',
    });
    upsertEntryMock.mockResolvedValueOnce({
      id: 'fq_off',
      inserted: true,
      updated: false,
    });
    updateMock.mockResolvedValueOnce({ id: 'fq_off' });
    await POST(
      jsonRequest({
        key: 'disabled-fr',
        language: 'fr',
        questionCanonical: 'Une question désactivée',
        scriptedReply: 'reply',
        threshold: 0.55,
        audience: 'all',
        enabled: false,
      }),
    );
    expect(updateMock).toHaveBeenCalledWith('fq_off', { enabled: false });
  });
});

describe('GET /api/admin/chat/faq', () => {
  it('rejette si non authentifié (401)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("renvoie la liste sans questionEmbedding (donnée volumineuse)", async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    listAllMock.mockResolvedValueOnce([
      {
        id: 'fq_a',
        key: 'price-pack-fr',
        language: 'fr',
        questionCanonical: 'Combien ?',
        questionEmbedding: FAKE_VECTOR,
        scriptedReply: '299 MAD',
        intentHint: 'pricing',
        threshold: '0.55',
        enabled: true,
        audience: 'all',
        createdAt: new Date('2026-05-01'),
        updatedAt: new Date('2026-05-13'),
      },
    ]);
    const res = await GET();
    const body = (await res.json()) as {
      faqs: Array<Record<string, unknown>>;
    };
    expect(body.faqs).toHaveLength(1);
    expect(body.faqs[0]!.questionEmbedding).toBeUndefined();
    expect(body.faqs[0]!.key).toBe('price-pack-fr');
  });
});
