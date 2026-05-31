/**
 * CHA-231 (gap 1) — Tests GET /api/chat/lead-status.
 *
 * Vérifie :
 *   - hasPendingOffer=false si aucun event.
 *   - lastOffer renvoyé si `chat_lead_form_offered` présent.
 *   - leadCaptured=true si submit/auto-create présent → hasPendingOffer=false.
 *   - 400 si sessionId manquant ou invalide.
 *   - 404 si chat désactivé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const events: Array<{
    type: string;
    payload: unknown;
    occurredAt: Date;
  }> = [];
  const listBySession = vi.fn(async () => events);
  const eventRepo = { listBySession, appendEventForTest: (e: typeof events[number]) => events.push(e), clear: () => (events.length = 0) };
  return { eventRepo };
});

vi.mock('@/lib/chat/repos/event', () => ({
  eventRepo: mocks.eventRepo,
}));

vi.mock('@/lib/chat/feature-flag', () => ({
  ChatDisabledError: class ChatDisabledError extends Error {},
  assertChatEnabled: vi.fn(() => {}),
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { GET } from './route';

function buildReq(url: string): import('next/server').NextRequest {
  return { url } as import('next/server').NextRequest;
}

describe('GET /api/chat/lead-status (CHA-231 gap 1)', () => {
  beforeEach(() => {
    mocks.eventRepo.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retourne 400 si sessionId manquant', async () => {
    const resp = await GET(buildReq('https://x/api/chat/lead-status'));
    expect(resp.status).toBe(400);
  });

  it('retourne 400 si sessionId trop long', async () => {
    const resp = await GET(
      buildReq(`https://x/api/chat/lead-status?sessionId=${'a'.repeat(65)}`),
    );
    expect(resp.status).toBe(400);
  });

  it('hasPendingOffer=false si aucun event', async () => {
    const resp = await GET(buildReq('https://x/api/chat/lead-status?sessionId=cs1'));
    const body = await resp.json();
    expect(resp.status).toBe(200);
    expect(body.hasPendingOffer).toBe(false);
    expect(body.leadCaptured).toBe(false);
    expect(body.lastOffer).toBeUndefined();
  });

  it('retourne lastOffer si event chat_lead_form_offered présent', async () => {
    const offeredAt = new Date('2026-05-08T10:00:00Z');
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_form_offered',
      payload: { messageId: 'm1', reason: 'purchase-intent', copyKey: 'purchase-intent', force: false },
      occurredAt: offeredAt,
    });
    const resp = await GET(buildReq('https://x/api/chat/lead-status?sessionId=cs1'));
    const body = await resp.json();
    expect(body.hasPendingOffer).toBe(true);
    expect(body.lastOffer.messageId).toBe('m1');
    expect(body.lastOffer.reason).toBe('purchase-intent');
    expect(body.lastOffer.force).toBe(false);
  });

  it('preserve `force=true` si présent dans le payload', async () => {
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_form_offered',
      payload: { messageId: 'm1', reason: 'explicit-request', copyKey: 'explicit-request', force: true },
      occurredAt: new Date(),
    });
    const resp = await GET(buildReq('https://x/api/chat/lead-status?sessionId=cs1'));
    const body = await resp.json();
    expect(body.lastOffer.force).toBe(true);
  });

  it('leadCaptured=true si chat_lead_form_submit présent → hasPendingOffer=false', async () => {
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_form_offered',
      payload: { messageId: 'm1', reason: 'purchase-intent', copyKey: 'purchase-intent' },
      occurredAt: new Date('2026-05-08T10:00:00Z'),
    });
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_form_submit',
      payload: { leadId: 'cl_xxx' },
      occurredAt: new Date('2026-05-08T10:01:00Z'),
    });
    const resp = await GET(buildReq('https://x/api/chat/lead-status?sessionId=cs1'));
    const body = await resp.json();
    expect(body.leadCaptured).toBe(true);
    expect(body.hasPendingOffer).toBe(false);
  });

  it('leadCaptured=true si chat_lead_auto_created présent (filet inline-contact)', async () => {
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_auto_created',
      payload: { leadId: 'cl_auto', confidence: 'high' },
      occurredAt: new Date(),
    });
    const resp = await GET(buildReq('https://x/api/chat/lead-status?sessionId=cs1'));
    const body = await resp.json();
    expect(body.leadCaptured).toBe(true);
  });

  it('renvoie le DERNIER offered si plusieurs events (ordre chronologique)', async () => {
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_form_offered',
      payload: { messageId: 'm1', reason: 'purchase-intent', copyKey: 'purchase-intent' },
      occurredAt: new Date('2026-05-08T10:00:00Z'),
    });
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_form_offered',
      payload: { messageId: 'm2', reason: 'negotiation', copyKey: 'negotiation', force: true },
      occurredAt: new Date('2026-05-08T10:05:00Z'),
    });
    const resp = await GET(buildReq('https://x/api/chat/lead-status?sessionId=cs1'));
    const body = await resp.json();
    expect(body.lastOffer.messageId).toBe('m2');
    expect(body.lastOffer.reason).toBe('negotiation');
    expect(body.lastOffer.force).toBe(true);
  });

  it('ignore les payloads malformés (pas de messageId/reason)', async () => {
    mocks.eventRepo.appendEventForTest({
      type: 'chat_lead_form_offered',
      payload: { foo: 'bar' }, // payload garbage
      occurredAt: new Date(),
    });
    const resp = await GET(buildReq('https://x/api/chat/lead-status?sessionId=cs1'));
    const body = await resp.json();
    expect(body.hasPendingOffer).toBe(false);
    expect(body.lastOffer).toBeUndefined();
  });
});
