/**
 * CHA-300 — Tests routes admin Suggestions collection.
 *
 * On mocke `requireAdminApi` et `cannedPairRepo`. Pas d'embedding requis
 * (cascade L2 matche par `key` exacte).
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: vi.fn(),
}));

vi.mock('@/lib/chat/repos/canned-pair', () => ({
  cannedPairRepo: {
    create: vi.fn(),
    listAll: vi.fn(),
  },
}));

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { cannedPairRepo } from '@/lib/chat/repos/canned-pair';
import { GET, POST } from './route';

const requireAdminApiMock = requireAdminApi as unknown as ReturnType<typeof vi.fn>;
const createMock = cannedPairRepo.create as unknown as ReturnType<typeof vi.fn>;
const listAllMock = cannedPairRepo.listAll as unknown as ReturnType<typeof vi.fn>;

const FULL_PAYLOAD = {
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
  ctaLabel: 'Voir le pack',
  ctaUrl: '/kit',
  allowFollowupLlm: false,
  status: 'draft' as const,
};

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/chat/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formRequest(body: Record<string, string>): NextRequest {
  const form = new URLSearchParams(body);
  return new NextRequest('http://localhost/api/admin/chat/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/admin/chat/suggestions', () => {
  it('rejette si non authentifié (401)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await POST(jsonRequest(FULL_PAYLOAD));
    expect(res.status).toBe(401);
  });

  it('rejette les inputs invalides (400, key vide)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    const res = await POST(jsonRequest({ ...FULL_PAYLOAD, key: '' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-input');
  });

  it('rejette si une langue manque (400)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    const partial = { ...FULL_PAYLOAD } as Record<string, unknown>;
    delete partial.labelArMa;
    const res = await POST(jsonRequest(partial));
    expect(res.status).toBe(400);
  });

  it('crée la suggestion et renvoie 200 JSON en happy path', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    createMock.mockResolvedValueOnce({
      id: 'cnp_abc',
      ...FULL_PAYLOAD,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await POST(jsonRequest(FULL_PAYLOAD));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe('cnp_abc');
    expect(createMock).toHaveBeenCalledTimes(1);
    const args = createMock.mock.calls[0]![0] as { key: string; pagePattern: string };
    expect(args.key).toBe('pricing-pack');
    expect(args.pagePattern).toBe('/kit/*');
  });

  it('form-encoded redirige en 303 vers la liste', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    createMock.mockResolvedValueOnce({
      id: 'cnp_xyz',
      ...FULL_PAYLOAD,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await POST(
      formRequest({
        key: 'pricing-pack',
        pagePattern: '/kit/*',
        audience: 'all',
        order: '100',
        enabled: 'on',
        labelFr: 'Voir le prix',
        labelAr: 'شاهد السعر',
        labelArMa: 'شوف الثمن',
        scriptedReplyFr: 'Le pack coûte 299 MAD.',
        scriptedReplyAr: 'السعر 299 درهم.',
        scriptedReplyArMa: 'الثمن 299 درهم.',
        status: 'published',
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(
      '/admin/chat/suggestions?ok=created',
    );
    const args = createMock.mock.calls[0]![0] as {
      order: number;
      status: string;
      enabled: boolean;
    };
    expect(args.order).toBe(100);
    expect(args.status).toBe('published');
    expect(args.enabled).toBe(true);
  });

  it("interprète l'absence de la case 'enabled' comme false", async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    createMock.mockResolvedValueOnce({
      id: 'cnp_off',
      ...FULL_PAYLOAD,
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await POST(
      formRequest({
        key: 'k1',
        pagePattern: '*',
        audience: 'all',
        order: '0',
        labelFr: 'Label FR',
        labelAr: 'Label AR',
        labelArMa: 'Label AR-MA',
        scriptedReplyFr: 'reply fr long enough',
        scriptedReplyAr: 'reply ar long enough',
        scriptedReplyArMa: 'reply ar-ma long enough',
        status: 'draft',
      }),
    );
    expect(res.status).toBe(303);
    const args = createMock.mock.calls[0]![0] as { enabled: boolean };
    expect(args.enabled).toBe(false);
  });
});

describe('GET /api/admin/chat/suggestions', () => {
  it('rejette si non authentifié (401)', async () => {
    requireAdminApiMock.mockResolvedValueOnce({
      ok: false,
      response: new Response('unauthorized', { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('renvoie la liste complète', async () => {
    requireAdminApiMock.mockResolvedValueOnce({ ok: true, email: 'admin@x' });
    listAllMock.mockResolvedValueOnce([
      {
        id: 'cnp_a',
        ...FULL_PAYLOAD,
        createdAt: new Date('2026-05-01'),
        updatedAt: new Date('2026-05-13'),
      },
    ]);
    const res = await GET();
    const body = (await res.json()) as {
      suggestions: Array<Record<string, unknown>>;
    };
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0]!.key).toBe('pricing-pack');
  });
});
