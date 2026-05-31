/**
 * CHA-230 Phase 3 — Tests POST/DELETE /api/admin/chat/intent-curator/[messageId].
 *
 * Stratégie : repos mockés en mémoire ; on teste le routage,
 * la validation Zod, l'auth gate, et l'idempotence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks repos en mémoire — on les déclare AVANT l'import du module sous test.
const messageStore = new Map<string, Record<string, unknown>>();
const goldenStore = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/chat/repos/message', () => ({
  messageRepo: {
    getById: vi.fn(async (id: string) => messageStore.get(id) ?? null),
  },
}));

vi.mock('@/lib/chat/repos/golden-intent', () => ({
  goldenIntentRepo: {
    add: vi.fn(async (input: Record<string, unknown>) => {
      const id = `cg_${Math.random().toString(36).slice(2, 10)}`;
      const row = { id, createdAt: new Date(), updatedAt: new Date(), ...input };
      goldenStore.set(id, row);
      return row;
    }),
    existsForMessage: vi.fn(async (messageId: string) => {
      for (const row of goldenStore.values()) {
        if ((row as { sourceMessageId?: string }).sourceMessageId === messageId) {
          return true;
        }
      }
      return false;
    }),
    list: vi.fn(async () => Array.from(goldenStore.values())),
    delete: vi.fn(async (id: string) => {
      goldenStore.delete(id);
    }),
  },
}));

// Auth gate — par défaut autorise.
const authMock = vi.fn(async () => ({ ok: true, email: 'admin@femiglow.ma' }));
vi.mock('@/lib/chat/admin/auth', () => ({
  requireAdminApi: () => authMock(),
}));

import { POST, DELETE } from './route';

beforeEach(() => {
  messageStore.clear();
  goldenStore.clear();
  authMock.mockResolvedValue({ ok: true, email: 'admin@femiglow.ma' });
  messageStore.set('cm_user_fr', {
    id: 'cm_user_fr',
    sessionId: 'cs_test',
    role: 'user',
    content: 'je veux un rabais',
    contentSafe: 'je veux un rabais',
    language: 'fr',
  });
  messageStore.set('cm_assistant', {
    id: 'cm_assistant',
    sessionId: 'cs_test',
    role: 'assistant',
    content: 'Bonjour FemiGlow.',
    contentSafe: 'Bonjour FemiGlow.',
    language: 'fr',
  });
});

afterEach(() => vi.clearAllMocks());

function buildPostReq(messageId: string, body: unknown) {
  return new Request(
    `http://localhost/api/admin/chat/intent-curator/${messageId}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

describe('POST /api/admin/chat/intent-curator/[messageId]', () => {
  it("renvoie 401 si pas authentifié", async () => {
    authMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
      }),
    } as never);
    const res = await POST(buildPostReq('cm_user_fr', { expectedIntent: 'negotiation' }), {
      params: { messageId: 'cm_user_fr' },
    });
    expect(res.status).toBe(401);
  });

  it("renvoie 404 si le message n'existe pas", async () => {
    const res = await POST(buildPostReq('cm_unknown', { expectedIntent: 'negotiation' }), {
      params: { messageId: 'cm_unknown' },
    });
    expect(res.status).toBe(404);
  });

  it("refuse de tagger un message assistant", async () => {
    const res = await POST(
      buildPostReq('cm_assistant', { expectedIntent: 'negotiation' }),
      { params: { messageId: 'cm_assistant' } },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('message-not-user');
  });

  it("refuse un body sans expectedIntent (Zod fail)", async () => {
    const res = await POST(buildPostReq('cm_user_fr', { foo: 'bar' }), {
      params: { messageId: 'cm_user_fr' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid-input');
  });

  it("crée une entrée golden et renvoie 201", async () => {
    const res = await POST(
      buildPostReq('cm_user_fr', { expectedIntent: 'negotiation', notes: 'rabais explicite' }),
      { params: { messageId: 'cm_user_fr' } },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toMatch(/^cg_/);
    // Une seule entrée golden, liée au bon message.
    expect(goldenStore.size).toBe(1);
    const created = Array.from(goldenStore.values())[0] as {
      sourceMessageId: string;
      expectedIntent: string;
      curatorEmail: string;
      text: string;
    };
    expect(created.sourceMessageId).toBe('cm_user_fr');
    expect(created.expectedIntent).toBe('negotiation');
    expect(created.curatorEmail).toBe('admin@femiglow.ma');
    expect(created.text).toBe('je veux un rabais');
  });

  it("renvoie 409 si le message a déjà été tagué (idempotence)", async () => {
    // Premier tag
    await POST(buildPostReq('cm_user_fr', { expectedIntent: 'negotiation' }), {
      params: { messageId: 'cm_user_fr' },
    });
    // Second tag — refusé
    const res = await POST(
      buildPostReq('cm_user_fr', { expectedIntent: 'wholesaler' }),
      { params: { messageId: 'cm_user_fr' } },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('already-tagged');
  });

  it("refuse une langue non supportée", async () => {
    messageStore.set('cm_es', {
      id: 'cm_es',
      sessionId: 'cs_test',
      role: 'user',
      content: 'hola',
      contentSafe: 'hola',
      language: 'es',
    });
    const res = await POST(buildPostReq('cm_es', { expectedIntent: 'negotiation' }), {
      params: { messageId: 'cm_es' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('message-language-unsupported');
  });
});

describe('DELETE /api/admin/chat/intent-curator/[messageId]', () => {
  it("renvoie 404 si aucune entrée golden pour ce message", async () => {
    const res = await DELETE(
      new Request('http://localhost/api/admin/chat/intent-curator/cm_user_fr', {
        method: 'DELETE',
      }),
      { params: { messageId: 'cm_user_fr' } },
    );
    expect(res.status).toBe(404);
  });

  it("supprime l'entrée golden existante", async () => {
    // Setup : tag puis untag
    await POST(buildPostReq('cm_user_fr', { expectedIntent: 'negotiation' }), {
      params: { messageId: 'cm_user_fr' },
    });
    expect(goldenStore.size).toBe(1);
    const res = await DELETE(
      new Request('http://localhost/api/admin/chat/intent-curator/cm_user_fr', {
        method: 'DELETE',
      }),
      { params: { messageId: 'cm_user_fr' } },
    );
    expect(res.status).toBe(200);
    expect(goldenStore.size).toBe(0);
  });
});
