/**
 * CHA-205 — Tests pour POST /api/chat/lead/contact.
 *
 * Stratégie : mock fin des repos + services externes (webhook, runtime,
 * rate-limit). Le test valide les chemins de validation, l'idempotence
 * (1 lead/session), l'anti-bot honeypot, le mapping erreur téléphone et
 * la 503 quand le toggle runtime est désactivé.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §6.2
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks. Toutes les références sont créées via `vi.hoisted` pour être
// disponibles au moment où Vitest hoiste les `vi.mock` au top du module.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const state = {
    runtimeEnabled: true,
    leadAlreadyForSession: false,
    /**
     * Si un lead pré-existe, sa raison détermine si on accepte l'upgrade
     * (cas `inline-contact` — auto-créé par l'orchestrateur, CHA-225) ou
     * si on renvoie 409.
     */
    existingLeadReason: 'manual' as
      | 'manual'
      | 'inline-contact'
      | 'purchase-intent'
      | 'callback-request'
      | 'long-no-progress'
      | 'after-hours'
      | 'b2b'
      | 'frustration'
      | 'objection-repeat'
      | 'out-of-knowledge'
      | 'explicit-request',
    sessionExists: true,
  };
  const sessionGetById = vi.fn(async (id: string) =>
    state.sessionExists
      ? {
          id,
          visitorId: 'cv_test',
          fingerprintHash: null,
          page: '/kit',
          referrer: null,
          utm: null,
        }
      : null,
  );
  const leadHasForSession = vi.fn(async () => state.leadAlreadyForSession);
  /** CHA-225 — utilisé par la route pour décider upgrade vs 409. */
  const leadFindBySession = vi.fn(async (sessionId: string) =>
    state.leadAlreadyForSession
      ? {
          id: 'cl_existing',
          sessionId,
          triggerReason: state.existingLeadReason,
          firstName: 'pré-existant',
          phoneE164: '+212600000000',
        }
      : null,
  );
  /** CHA-240 — lookup par (session, identityHash). */
  const leadFindBySessionAndIdentity = vi.fn(async (sessionId: string) =>
    state.leadAlreadyForSession
      ? {
          id: 'cl_existing',
          sessionId,
          triggerReason: state.existingLeadReason,
          firstName: 'pré-existant',
          phoneE164: '+212600000000',
        }
      : null,
  );
  const leadCreate = vi.fn(async (input: Record<string, unknown>) => ({
    id: 'cl_new',
    ...input,
  }));
  /** CHA-225 — formalise un lead `inline-contact` auto-créé. */
  const leadUpgrade = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
    id,
    sessionId: 'cs_test',
    triggerReason: patch.triggerReason ?? 'manual',
    firstName: patch.firstName ?? 'X',
    phoneE164: patch.phoneE164 ?? '+212612345678',
  }));
  const messageRecentForMemory = vi.fn(async () => []);
  const eventAppend = vi.fn(async () => {});
  const dispatchLeadWebhook = vi.fn(async () => ({ status: 'sent' as const, attempts: 1 }));
  const rateLimitConsume = vi.fn(async () => ({ allowed: true }));
  const getRuntimeBool = vi.fn(async () => state.runtimeEnabled);
  return {
    state,
    sessionGetById,
    leadHasForSession,
    leadFindBySession,
    leadFindBySessionAndIdentity,
    leadCreate,
    leadUpgrade,
    messageRecentForMemory,
    eventAppend,
    dispatchLeadWebhook,
    rateLimitConsume,
    getRuntimeBool,
  };
});

vi.mock('@/lib/chat/feature-flag', () => ({
  ChatDisabledError: class ChatDisabledError extends Error {},
  assertChatEnabled: vi.fn(() => undefined),
}));

vi.mock('@/lib/chat/repos/session', () => ({
  sessionRepo: { getById: mocks.sessionGetById },
}));

vi.mock('@/lib/chat/repos/lead', () => ({
  leadRepo: {
    hasLeadForSession: mocks.leadHasForSession,
    findBySession: mocks.leadFindBySession,
    findBySessionAndIdentity: mocks.leadFindBySessionAndIdentity,
    create: mocks.leadCreate,
    upgrade: mocks.leadUpgrade,
  },
}));

vi.mock('@/lib/chat/repos/message', () => ({
  messageRepo: { recentForMemory: mocks.messageRecentForMemory },
}));

vi.mock('@/lib/chat/repos/identity-hash', () => ({
  computeIdentityHash: vi.fn((_phone: string, _name: string) => 'mock_identity_hash'),
}));

vi.mock('@/lib/chat/repos/event', () => ({
  eventRepo: { append: mocks.eventAppend },
}));

vi.mock('@/lib/chat/services/lead-webhook', () => ({
  dispatchLeadWebhook: mocks.dispatchLeadWebhook,
}));

vi.mock('@/lib/chat/services/rate-limit', () => ({
  rateLimit: { consume: mocks.rateLimitConsume },
}));

vi.mock('@/lib/chat/runtime-setting', () => ({
  getRuntimeBool: mocks.getRuntimeBool,
}));

vi.mock('@/lib/chat/services/intent', () => ({
  detectIntent: vi.fn(() => 'misc'),
}));

vi.mock('@/lib/env', () => ({
  env: {
    CHAT_LEAD_CONSENT_VERSION: '2026-05-06',
  },
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://x/api/chat/lead/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: 'cs_test',
    triggerReason: 'manual',
    firstName: 'Yasmine',
    phoneRaw: '0612345678',
    countryHint: 'MA',
    consent: true,
    consentVersion: '2026-05-06',
    language: 'fr',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.state.runtimeEnabled = true;
  mocks.state.leadAlreadyForSession = false;
  mocks.state.existingLeadReason = 'manual';
  mocks.state.sessionExists = true;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Cas nominal
// ---------------------------------------------------------------------------

describe('POST /api/chat/lead/contact — happy path', () => {
  it('crée un lead et renvoie 200 + outcomeMessage', async () => {
    const res = await POST(makeRequest(validInput()) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; leadId: string; outcomeMessage: string };
    expect(json.ok).toBe(true);
    expect(json.leadId).toBe('cl_new');
    expect(json.outcomeMessage).toMatch(/Merci/);
    expect(mocks.leadCreate).toHaveBeenCalledOnce();
    expect(mocks.eventAppend).toHaveBeenCalledWith(
      'cs_test',
      'chat_lead_form_submit',
      expect.objectContaining({ leadId: 'cl_new' }),
    );
    expect(mocks.dispatchLeadWebhook).toHaveBeenCalledOnce();
  });

  it('renvoie le message en arabe si language=ar', async () => {
    const res = await POST(makeRequest(validInput({ language: 'ar' })) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { outcomeMessage: string };
    expect(json.outcomeMessage).toMatch(/شكراً/);
  });
});

// ---------------------------------------------------------------------------
// Toggle runtime kill switch
// ---------------------------------------------------------------------------

describe('toggle runtime', () => {
  it("renvoie 503 si lead_form_enabled=false", async () => {
    mocks.state.runtimeEnabled = false;
    const res = await POST(makeRequest(validInput()) as never);
    expect(res.status).toBe(503);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Validation Zod
// ---------------------------------------------------------------------------

describe('validation', () => {
  it('renvoie 400 si JSON invalide', async () => {
    const req = new Request('http://x/api/chat/lead/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("renvoie 400 si firstName trop court", async () => {
    const res = await POST(makeRequest(validInput({ firstName: 'A' })) as never);
    expect(res.status).toBe(400);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  it("renvoie 400 si consent !== true", async () => {
    const res = await POST(makeRequest(validInput({ consent: false })) as never);
    expect(res.status).toBe(400);
  });

  it("renvoie 400 si triggerReason hors enum", async () => {
    const res = await POST(makeRequest(validInput({ triggerReason: 'invalid' })) as never);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Honeypot
// ---------------------------------------------------------------------------

describe('honeypot', () => {
  it("simule un succès silencieux quand honeypot rempli (pas de création)", async () => {
    const res = await POST(makeRequest(validInput({ honeypot: 'spam-bot-content' })) as never);
    expect(res.status).toBe(400); // Zod rejette honeypot.length > 0 → 400
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

describe('session lookup', () => {
  it("renvoie 404 si la session n'existe pas", async () => {
    mocks.state.sessionExists = false;
    const res = await POST(makeRequest(validInput()) as never);
    expect(res.status).toBe(404);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Idempotence
// ---------------------------------------------------------------------------

describe('idempotence', () => {
  it("renvoie 409 si un lead existe déjà pour cette session", async () => {
    mocks.state.leadAlreadyForSession = true;
    mocks.state.existingLeadReason = 'manual';
    const res = await POST(makeRequest(validInput()) as never);
    expect(res.status).toBe(409);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  // CHA-225 — upgrade : si le lead existant a été auto-créé par
  // l'orchestrateur (raison `inline-contact`) parce que le visiteur
  // avait tapé son numéro dans le chat, la soumission du formulaire
  // doit FORMALISER ce lead (consent propre + validation) au lieu de
  // renvoyer 409. Sinon, on perd l'opportunité de capter le RGPD
  // explicite et le visiteur reçoit une erreur incompréhensible.
  it("formalise un lead 'inline-contact' existant au lieu de 409 (CHA-225)", async () => {
    mocks.state.leadAlreadyForSession = true;
    mocks.state.existingLeadReason = 'inline-contact';
    const res = await POST(
      makeRequest(validInput({ triggerReason: 'manual' })) as never,
    );
    expect(res.status).toBe(200);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
    expect(mocks.leadUpgrade).toHaveBeenCalledOnce();
    expect(mocks.leadUpgrade).toHaveBeenCalledWith(
      'cl_existing',
      expect.objectContaining({
        firstName: 'Yasmine',
        triggerReason: 'manual',
      }),
    );
    // L'event d'upgrade doit être enregistré pour audit.
    expect(mocks.eventAppend).toHaveBeenCalledWith(
      'cs_test',
      'chat_lead_form_upgrade',
      expect.objectContaining({
        previousReason: 'inline-contact',
      }),
    );
  });

  it("ne formalise PAS un lead non-inline-contact (priorité au 409)", async () => {
    mocks.state.leadAlreadyForSession = true;
    mocks.state.existingLeadReason = 'callback-request';
    const res = await POST(makeRequest(validInput()) as never);
    expect(res.status).toBe(409);
    expect(mocks.leadUpgrade).not.toHaveBeenCalled();
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Téléphone invalide
// ---------------------------------------------------------------------------

describe('téléphone invalide', () => {
  // phoneRaw doit avoir min 6 chars (Zod) — sinon 400 avant d'atteindre
  // parsePhone. On choisit ici des cas qui passent Zod mais échouent au
  // parser → 422 + code structuré.
  it('renvoie 422 avec code lisible si calling-code inconnu', async () => {
    const res = await POST(
      makeRequest(validInput({ phoneRaw: '+9991234567', countryHint: 'MA' })) as never,
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string; code: string };
    expect(json.error).toBe('invalid-phone');
    expect(json.code).toBeDefined();
  });

  it("renvoie 422 si la longueur ne correspond pas au pays", async () => {
    // 6 chiffres (passe Zod) mais MA exige 9 après trunk-strip → wrong-length.
    const res = await POST(makeRequest(validInput({ phoneRaw: '061234' })) as never);
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Rate-limit
// ---------------------------------------------------------------------------

describe('rate-limit', () => {
  it('renvoie 429 si IP rate-limited', async () => {
    mocks.rateLimitConsume.mockImplementationOnce(async () => ({ allowed: false }));
    const res = await POST(makeRequest(validInput()) as never);
    expect(res.status).toBe(429);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });
});
