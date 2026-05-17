/**
 * CHA-225 — Simulateur de conversations multi-tours.
 *
 * Permet d'enchaîner plusieurs messages user via `streamReply` en
 * réutilisant la même session in-memory. Sert de fondation aux tests
 * de bout en bout des règles de capture lead :
 *
 *  - "le visiteur écrit son numéro dans le chat → un lead doit être
 *    créé même s'il ne soumet jamais le widget"
 *  - "le visiteur dit 'je veux commander' au tour 1 → le widget doit
 *    être proposé immédiatement"
 *  - etc.
 *
 * Le harness fournit :
 *  - un store en mémoire pour `chat_session`, `chat_message`, `chat_lead`,
 *  - un mock d'`eventRepo.append` qui collecte tous les évents,
 *  - un mock de `providerRouter` qui renvoie un adapter OpenAI réel
 *    branché sur MSW (`src/test/msw/server.ts`),
 *  - une fonction `simulateUserTurn(text)` qui exécute streamReply,
 *    accumule la réponse, et expose les événements SSE.
 *
 * Les handlers MSW à utiliser viennent de `openai-handlers.ts`. Pour
 * que les tests soient déterministes, on configure des stubs simples
 * (réponses constantes ; pas de génération aléatoire).
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §4
 */
import { vi } from 'vitest';

import type { ChatStreamEvent } from '@/lib/chat/contracts';
import type { ChatLeadInsert, ChatLeadRow } from '@/lib/chat/db/schema';
import { computeIdentityHash } from '@/lib/chat/repos/identity-hash';
import { server } from '@/test/msw/server';
import { encodeSseStream, type SsePart } from '@/test/msw/openai-handlers';
import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Stores partagés (réinitialisés via `resetSimulationStores()`)
// ---------------------------------------------------------------------------

export interface SimMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  contentRaw?: string | null;
  contentSafe?: string | null;
  language?: string | null;
  status: 'pending' | 'streaming' | 'sent' | 'error' | 'deleted';
  createdAt: Date;
  providerId?: string | null;
  modelName?: string | null;
  parentMessageId?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  ragHits?: unknown;
  errorCode?: string | null;
  latencyMs?: number | null;
  firstTokenMs?: number | null;
  cost?: string | null;
}

export interface SimEvent {
  sessionId: string;
  type: string;
  payload: unknown;
}

export interface SimSession {
  id: string;
  visitorId: string;
  fingerprintHash: string | null;
  language: string;
  page: string | null;
  referrer: string | null;
  utm: Record<string, string> | null;
  status: 'open' | 'idle' | 'archived' | 'purged';
  instructionVersionId: string;
  themePresetId: string | null;
  experimentVariantId: string | null;
  openedAt: Date;
  lastSeenAt: Date;
  archivedAt: Date | null;
  purgedAt: Date | null;
  consent: { essential: true; analytics: boolean; marketing: boolean } | null;
  convertedOrderId: string | null;
  convertedAt: Date | null;
  metaSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const simStores = {
  sessions: new Map<string, SimSession>(),
  messages: new Map<string, SimMessage>(),
  events: [] as SimEvent[],
  leads: new Map<string, ChatLeadRow>(),
  runtimeFlags: new Map<string, boolean>(),
};

export function resetSimulationStores(): void {
  simStores.sessions.clear();
  simStores.messages.clear();
  simStores.events.length = 0;
  simStores.leads.clear();
  simStores.runtimeFlags.clear();
}

// ---------------------------------------------------------------------------
// Mocks `vi.hoisted` — exposés pour le test, à brancher via `vi.mock(...)`.
// ---------------------------------------------------------------------------

/**
 * Hooks à appeler depuis le `vi.mock` du fichier de test (avant import
 * de `streamReply`). On expose des factory functions au lieu de mocks
 * directs, parce que les `vi.mock` doivent être hoistés en haut de
 * fichier pour fonctionner.
 *
 * Usage :
 *   vi.mock('@/lib/chat/repos/session', () => buildSessionRepoMock());
 *   vi.mock('@/lib/chat/repos/message', () => buildMessageRepoMock());
 *   ...
 *
 * Tous les mocks lisent et écrivent dans `simStores`.
 */
export function buildSessionRepoMock() {
  return {
    sessionRepo: {
      getById: vi.fn(async (id: string) => simStores.sessions.get(id) ?? null),
      update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        const cur = simStores.sessions.get(id);
        if (cur) simStores.sessions.set(id, { ...cur, ...patch } as SimSession);
      }),
      touch: vi.fn(async () => {}),
    },
  };
}

export function buildMessageRepoMock() {
  return {
    messageRepo: {
      create: vi.fn(async (input: Partial<SimMessage>) => {
        const id =
          input.id ??
          `cm_${Math.random().toString(36).slice(2, 10)}${simStores.messages.size}`;
        const row: SimMessage = {
          id,
          sessionId: input.sessionId!,
          role: input.role!,
          content: input.content ?? '',
          contentRaw: input.contentRaw ?? null,
          contentSafe: input.contentSafe ?? null,
          language: input.language ?? null,
          status: input.status ?? 'pending',
          createdAt: new Date(),
          providerId: input.providerId ?? null,
          modelName: input.modelName ?? null,
          parentMessageId: input.parentMessageId ?? null,
          tokensIn: input.tokensIn ?? null,
          tokensOut: input.tokensOut ?? null,
          ragHits: input.ragHits ?? null,
        };
        simStores.messages.set(id, row);
        return row;
      }),
      update: vi.fn(async (id: string, patch: Partial<SimMessage>) => {
        const cur = simStores.messages.get(id);
        if (cur) simStores.messages.set(id, { ...cur, ...patch });
      }),
      recentForMemory: vi.fn(async (sessionId: string, limit: number) => {
        const all = [...simStores.messages.values()]
          .filter((m) => m.sessionId === sessionId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return all.slice(-limit);
      }),
      listBySession: vi.fn(async (sessionId: string) => {
        return [...simStores.messages.values()].filter(
          (m) => m.sessionId === sessionId,
        );
      }),
    },
  };
}

export function buildEventRepoMock() {
  return {
    eventRepo: {
      append: vi.fn(
        async (sessionId: string, type: string, payload: unknown) => {
          simStores.events.push({ sessionId, type, payload });
        },
      ),
    },
  };
}

export function buildInstructionRepoMock() {
  return {
    instructionRepo: {
      active: vi.fn(async () => ({
        id: 'ci_test',
        version: 1,
        scope: 'default',
        body: "Tu es l'assistante FemiGlow. Réponds en 1 phrase. Pas de markdown.",
        bodyAr: null,
        bodyArMa: null,
        notes: null,
        enabled: true,
        createdBy: 'test',
        createdAt: new Date(),
      })),
    },
  };
}

export function buildProviderRepoMock() {
  return {
    providerRepo: {
      incrementConsumed: vi.fn(async () => {}),
    },
  };
}

export function buildRagServiceMock() {
  return {
    ragService: {
      retrieve: vi.fn(async () => []),
      ingest: vi.fn(async () => ({ chunks: 0 })),
    },
  };
}

export function buildLeadRepoMock() {
  return {
    leadRepo: {
      create: vi.fn(async (insert: Omit<ChatLeadInsert, 'id' | 'identityHash'> & { id?: string }) => {
        // Simulate ON CONFLICT (sessionId, identityHash) DO NOTHING:
        // if a lead with the same (sessionId, identityHash) exists, return it.
        const identityHash = computeIdentityHash(insert.phoneE164, insert.firstName);
        for (const existing of simStores.leads.values()) {
          if (existing.sessionId === insert.sessionId && existing.identityHash === identityHash) {
            return existing;
          }
        }
        const id = insert.id ?? `cl_${Math.random().toString(36).slice(2, 10)}`;
        const row: ChatLeadRow = {
          id,
          sessionId: insert.sessionId,
          triggeringMessageId: insert.triggeringMessageId ?? null,
          triggerReason: insert.triggerReason,
          firstName: insert.firstName,
          phoneE164: insert.phoneE164,
          phoneRaw: insert.phoneRaw,
          note: insert.note ?? null,
          consentVersion: insert.consentVersion,
          consentAt: insert.consentAt ?? new Date(),
          visitorId: insert.visitorId,
          fingerprintHash: insert.fingerprintHash ?? null,
          identityHash: identityHash,
          page: insert.page ?? null,
          referrer: insert.referrer ?? null,
          utm: insert.utm ?? null,
          language: insert.language,
          intentAtCapture: insert.intentAtCapture ?? null,
          snapshotMessages: insert.snapshotMessages ?? null,
          webhookStatus: insert.webhookStatus ?? 'pending',
          webhookAttempts: insert.webhookAttempts ?? 0,
          webhookLastError: insert.webhookLastError ?? null,
          webhookSentAt: insert.webhookSentAt ?? null,
          handledBy: insert.handledBy ?? null,
          handledAt: insert.handledAt ?? null,
          outcome: insert.outcome ?? 'pending',
          convertedOrderId: insert.convertedOrderId ?? null,
          // CHA-230 — Extensions wizard checkout funnel.
          lastName: insert.lastName ?? null,
          email: insert.email ?? null,
          emailVerifiedAt: insert.emailVerifiedAt ?? null,
          emailConsent: insert.emailConsent ?? false,
          shippingCity: insert.shippingCity ?? null,
          shippingAddressLine1: insert.shippingAddressLine1 ?? null,
          shippingAddressLine2: insert.shippingAddressLine2 ?? null,
          shippingPostalCode: insert.shippingPostalCode ?? null,
          shippingCountry: insert.shippingCountry ?? 'MA',
          shippingNotes: insert.shippingNotes ?? null,
          preferredPaymentMethod: insert.preferredPaymentMethod ?? null,
          source: insert.source ?? 'chat_widget',
          formId: insert.formId ?? null,
          formMode: insert.formMode ?? null,
          variantKey: insert.variantKey ?? null,
          gclid: insert.gclid ?? null,
          fbp: insert.fbp ?? null,
          fbc: insert.fbc ?? null,
          cartSnapshot: insert.cartSnapshot ?? null,
          cartTotalCents: insert.cartTotalCents ?? null,
          cartCurrency: insert.cartCurrency ?? null,
          lastTouchedStep: insert.lastTouchedStep ?? null,
          leadCapturedAt: insert.leadCapturedAt ?? null,
          addressCompletedAt: insert.addressCompletedAt ?? null,
          paymentSelectedAt: insert.paymentSelectedAt ?? null,
          purchasedAt: insert.purchasedAt ?? null,
          abandonWebhookAt: insert.abandonWebhookAt ?? null,
          step2WebhookAt: insert.step2WebhookAt ?? null,
          step1AbandonWebhookAt: insert.step1AbandonWebhookAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        simStores.leads.set(id, row);
        return row;
      }),
      hasLeadForSession: vi.fn(async (sessionId: string) => {
        for (const lead of simStores.leads.values()) {
          if (lead.sessionId === sessionId) return true;
        }
        return false;
      }),
      findBySession: vi.fn(async (sessionId: string) => {
        const leads = [...simStores.leads.values()].filter(
          (l) => l.sessionId === sessionId,
        );
        leads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return leads[0] ?? null;
      }),
      findBySessionAndIdentity: vi.fn(async (sessionId: string, identityHash: string) => {
        const leads = [...simStores.leads.values()].filter(
          (l) => l.sessionId === sessionId && l.identityHash === identityHash,
        );
        leads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return leads[0] ?? null;
      }),
      upgrade: vi.fn(
        async (id: string, patch: Record<string, unknown>) => {
          const cur = simStores.leads.get(id);
          if (!cur) return null;
          const next = { ...cur, ...patch, updatedAt: new Date() } as ChatLeadRow;
          simStores.leads.set(id, next);
          return next;
        },
      ),
    },
  };
}

export function buildProviderRouterMock() {
  return async () => {
    const { createOpenAIAdapter } = await import('@/lib/chat/providers/openai');
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
  };
}

export function buildRuntimeSettingMock() {
  return {
    getRuntimeBool: vi.fn(async (key: string, fallback: boolean) => {
      return simStores.runtimeFlags.get(key) ?? fallback;
    }),
    getRuntimeString: vi.fn(async (_k: string, fallback: string | null) => fallback),
  };
}

// ---------------------------------------------------------------------------
// Helpers de configuration MSW
// ---------------------------------------------------------------------------

/**
 * Pousse un handler OpenAI qui renvoie le texte fixe `reply` en SSE.
 * Utile pour faire varier la réponse assistant (ex. déclencher
 * out-of-knowledge ou simuler une réponse commerciale).
 */
export function useStubReply(reply: string): void {
  const parts: SsePart[] = [];
  // On découpe artificiellement la réponse en chunks de ~10 chars pour
  // être réaliste vis-à-vis du streaming.
  const CHUNK = 10;
  for (let i = 0; i < reply.length; i += CHUNK) {
    parts.push({ delta: reply.slice(i, i + CHUNK) });
  }
  parts.push({
    finish_reason: 'stop',
    usage: { prompt_tokens: 12, completion_tokens: parts.length },
  });
  server.use(
    http.post('https://api.openai.com/v1/chat/completions', () => {
      const body = encodeSseStream(parts);
      return new HttpResponse(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Builder de session pour les tests
// ---------------------------------------------------------------------------

export function makeTestSession(overrides: Partial<SimSession> = {}): SimSession {
  const id = overrides.id ?? `cs_test_${simStores.sessions.size}`;
  const now = new Date();
  const session: SimSession = {
    id,
    visitorId: overrides.visitorId ?? `v_${id}`,
    fingerprintHash: overrides.fingerprintHash ?? 'fp_test',
    language: overrides.language ?? 'fr',
    page: overrides.page ?? '/',
    referrer: overrides.referrer ?? null,
    utm: overrides.utm ?? null,
    status: overrides.status ?? 'open',
    instructionVersionId: overrides.instructionVersionId ?? 'ci_test',
    themePresetId: overrides.themePresetId ?? null,
    experimentVariantId: overrides.experimentVariantId ?? null,
    openedAt: now,
    lastSeenAt: now,
    archivedAt: null,
    purgedAt: null,
    consent: overrides.consent ?? null,
    convertedOrderId: null,
    convertedAt: null,
    metaSummary: null,
    createdAt: now,
    updatedAt: now,
  };
  simStores.sessions.set(id, session);
  return session;
}

// ---------------------------------------------------------------------------
// Drive un seul tour user via streamReply (lazy import to allow vi.mock).
// ---------------------------------------------------------------------------

export interface SimulationTurnResult {
  events: ChatStreamEvent[];
  assistantReply: string;
  leadOffered: boolean;
  leadOfferReason?: string;
  autoLeadCreated: boolean;
  leads: ChatLeadRow[];
}

/**
 * Exécute un tour user complet. Retourne :
 *  - tous les évents SSE,
 *  - la réponse assistant assemblée à partir des `chunk`,
 *  - un flag `leadOffered` (a-t-on émis lead-form-offer ?),
 *  - un flag `autoLeadCreated` (un lead a-t-il été créé automatiquement ?),
 *  - la liste des leads en base (via le store mocké).
 */
export async function runUserTurn(
  session: SimSession,
  text: string,
): Promise<SimulationTurnResult> {
  // Import lazy pour respecter les vi.mock du test parent.
  const { streamReply } = await import('@/lib/chat/services/orchestrator');
  const events: ChatStreamEvent[] = [];
  const beforeLeadIds = new Set([...simStores.leads.keys()]);
  for await (const evt of streamReply({ session: session as never, text })) {
    events.push(evt);
  }
  const chunks = events
    .filter((e) => e.event === 'chunk')
    .map((e) => (e.data as { delta: string }).delta);
  const assistantReply = chunks.join('');
  const offer = events.find((e) => e.event === 'lead-form-offer');
  const newLeads = [...simStores.leads.values()].filter(
    (l) => !beforeLeadIds.has(l.id) && l.sessionId === session.id,
  );
  return {
    events,
    assistantReply,
    leadOffered: !!offer,
    leadOfferReason: offer
      ? (offer.data as { reason: string }).reason
      : undefined,
    autoLeadCreated: newLeads.some((l) => l.triggerReason === 'inline-contact'),
    leads: [...simStores.leads.values()].filter((l) => l.sessionId === session.id),
  };
}

/**
 * Exécute une suite de tours user en séquence. Chaque tour utilise la
 * MÊME session ; le contenu de l'historique grandit au fur et à mesure.
 */
export async function runConversation(
  session: SimSession,
  userTurns: string[],
): Promise<SimulationTurnResult[]> {
  const results: SimulationTurnResult[] = [];
  for (const t of userTurns) {
    results.push(await runUserTurn(session, t));
  }
  return results;
}
