/**
 * Test d'intégration de l'orchestrator chat.
 *
 * Stratégie :
 * - Repos (session/message/event/instruction/provider) → mockés en mémoire
 * - providerRouter → mocké pour retourner notre vrai `createOpenAIAdapter`
 * - ragService → mocké pour ne pas frapper la DB
 * - OpenAI HTTP → mocké via MSW (aucun appel réel)
 *
 * Le but : valider que les évènements SSE émis (`start` / `chunk` /
 * `source` / `end` / `error`) sont conformes au contrat, dans le bon
 * ordre, avec les bons IDs.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';
import {
  openaiAuthErrorHandler,
  openaiHappyPathHandlers,
} from '@/test/msw/openai-handlers';

// Mocks de repos (in-memory)
const sessionStore = new Map<string, Record<string, unknown>>();
const messageStore = new Map<string, Record<string, unknown>>();
const events: Array<{ sessionId: string; type: string; payload: unknown }> = [];

vi.mock('../repos/session', () => ({
  sessionRepo: {
    getById: vi.fn(async (id: string) => sessionStore.get(id) ?? null),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const cur = sessionStore.get(id);
      if (cur) sessionStore.set(id, { ...cur, ...patch });
    }),
    touch: vi.fn(async () => {}),
  },
}));

vi.mock('../repos/message', () => ({
  messageRepo: {
    create: vi.fn(async (input: Record<string, unknown>) => {
      const id = `cm_${Math.random().toString(36).slice(2, 10)}`;
      const row = { id, createdAt: new Date(), ...input };
      messageStore.set(id, row);
      return row;
    }),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const cur = messageStore.get(id);
      if (cur) messageStore.set(id, { ...cur, ...patch });
    }),
    recentForMemory: vi.fn(async () => []),
    listBySession: vi.fn(async () => []),
  },
}));

vi.mock('../repos/event', () => ({
  eventRepo: {
    append: vi.fn(async (sessionId: string, type: string, payload: unknown) => {
      events.push({ sessionId, type, payload });
    }),
    hasLeadOfferForSession: vi.fn(async (sessionId: string) =>
      events.some(
        (e) => e.sessionId === sessionId && e.type === 'chat_lead_form_offered',
      ),
    ),
    hasLeadOfferForMessage: vi.fn(async (sessionId: string, messageId: string) =>
      events.some(
        (e) =>
          e.sessionId === sessionId &&
          e.type === 'chat_lead_form_offered' &&
          (e.payload as { messageId?: string } | null)?.messageId === messageId,
      ),
    ),
  },
}));

vi.mock('../repos/instruction', () => ({
  instructionRepo: {
    active: vi.fn(async () => ({
      id: 'ci_test',
      version: 1,
      scope: 'default',
      body: "Tu es l'assistante FemiGlow. Réponds en 1 phrase.",
      bodyAr: null,
      bodyArMa: null,
      notes: null,
      enabled: true,
      createdBy: 'test',
      createdAt: new Date(),
    })),
  },
}));

vi.mock('../repos/provider', () => ({
  providerRepo: {
    incrementConsumed: vi.fn(async () => {}),
  },
}));

vi.mock('../repos/lead', () => ({
  leadRepo: {
    hasLeadForSession: vi.fn(async () => false),
    create: vi.fn(async () => ({ id: 'cl_test' })),
  },
}));

vi.mock('../runtime-setting', () => ({
  getRuntimeBool: vi.fn(async (_key: string, fallback: boolean) => fallback),
}));

vi.mock('../rag/service', () => ({
  ragService: {
    retrieve: vi.fn(async () => []),
    ingest: vi.fn(async () => ({ chunks: 0 })),
  },
}));

// Mock du provider-router pour retourner notre vrai adapter OpenAI.
vi.mock('./provider-router', async () => {
  const { createOpenAIAdapter } = await import('../providers/openai');
  const adapter = createOpenAIAdapter({
    id: 'cp_test',
    kind: 'openai',
    label: 'OpenAI test',
    apiKey: 'sk-test',
    chatModel: 'gpt-4o-mini',
  });
  const row = {
    id: 'cp_test',
    kind: 'openai' as const,
    chatModel: 'gpt-4o-mini',
  };
  return {
    providerRouter: {
      choose: vi.fn(async () => ({ adapter, row })),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    },
  };
});

import { streamReply } from './orchestrator';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  events.length = 0;
  sessionStore.clear();
  messageStore.clear();
  sessionStore.set('cs_test', {
    id: 'cs_test',
    visitorId: 'v_test',
    language: 'fr',
    status: 'open',
    instructionVersionId: 'ci_test',
  });
});

afterEach(() => server.resetHandlers());

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of iter) out.push(x);
  return out;
}

describe('orchestrator.streamReply — happy path', () => {
  it('émet start → chunk* → end avec les IDs cohérents', async () => {
    server.use(...openaiHappyPathHandlers);
    const session = sessionStore.get('cs_test') as never;
    const evts = await collect(streamReply({ session, text: 'Bonjour' }));

    const types = evts.map((e) => e.event);
    expect(types[0]).toBe('start');
    expect(types[types.length - 1]).toBe('end');
    expect(types.filter((t) => t === 'chunk').length).toBeGreaterThan(0);

    // Tous les chunks réfèrent le même messageId.
    const startId = (evts[0]!.data as { messageId: string }).messageId;
    for (const e of evts.slice(1)) {
      const data = e.data as { messageId?: string };
      if (data.messageId) expect(data.messageId).toBe(startId);
    }

    // Le message assistant est bien persisté avec la réponse complète.
    const assistant = [...messageStore.values()].find(
      (m) => (m as { role: string }).role === 'assistant',
    );
    expect(assistant).toBeDefined();
    expect((assistant as { content: string }).content).toBe('Bonjour FemiGlow.');
    expect((assistant as { tokensIn: number }).tokensIn).toBe(18);
    expect((assistant as { tokensOut: number }).tokensOut).toBe(6);
    expect((assistant as { status: string }).status).toBe('sent');
  });

  it('persiste le message user avant tout appel provider', async () => {
    server.use(...openaiHappyPathHandlers);
    const session = sessionStore.get('cs_test') as never;
    await collect(streamReply({ session, text: 'Hello world' }));
    const user = [...messageStore.values()].find(
      (m) => (m as { role: string }).role === 'user',
    );
    expect(user).toBeDefined();
    expect((user as { content: string }).content).toContain('Hello');
  });

  it("émet l'évent KPI message_sent_user puis message_sent_agent", async () => {
    server.use(...openaiHappyPathHandlers);
    const session = sessionStore.get('cs_test') as never;
    await collect(streamReply({ session, text: 'Bonjour' }));
    const types = events.map((e) => e.type);
    expect(types).toContain('message_sent_user');
    expect(types).toContain('message_sent_agent');
    expect(types.indexOf('message_sent_user')).toBeLessThan(
      types.indexOf('message_sent_agent'),
    );
  });
});

describe('orchestrator.streamReply — erreurs', () => {
  it('émet event=error si l\'API OpenAI renvoie 401', async () => {
    server.use(openaiAuthErrorHandler);
    const session = sessionStore.get('cs_test') as never;
    const evts = await collect(streamReply({ session, text: 'Bonjour' }));
    const errEvt = evts.find((e) => e.event === 'error');
    expect(errEvt).toBeDefined();
    expect((errEvt!.data as { code: string }).code).toBe('auth');
    // Le message assistant doit être marqué en erreur.
    const assistant = [...messageStore.values()].find(
      (m) => (m as { role: string }).role === 'assistant',
    );
    expect((assistant as { status: string }).status).toBe('error');
  });
});

describe('orchestrator.streamReply — détection langue', () => {
  it('détecte le français (ASCII latin)', async () => {
    server.use(...openaiHappyPathHandlers);
    const session = sessionStore.get('cs_test') as never;
    const evts = await collect(streamReply({ session, text: 'Bonjour, comment ça va ?' }));
    const start = evts.find((e) => e.event === 'start')!;
    expect((start.data as { language: string }).language).toBe('fr');
  });

  it('détecte l\'arabe (script arabe)', async () => {
    server.use(...openaiHappyPathHandlers);
    const session = sessionStore.get('cs_test') as never;
    const evts = await collect(
      streamReply({ session, text: 'مرحبا، كيف حالك ؟' }),
    );
    const start = evts.find((e) => e.event === 'start')!;
    expect((start.data as { language: string }).language).toBe('ar');
  });
});
