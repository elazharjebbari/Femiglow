/**
 * CHAT-066 — Tests du builder du dashboard Care.
 *
 * On valide :
 *  - hot pending vs hot overdue (SLA 4h)
 *  - ratio hotOverdue/hotPending sans NaN
 *  - dénombrement frustration 24h / 7j + sessions distinctes
 *  - clamp événements hors fenêtre 7j
 */
import { describe, expect, it } from 'vitest';

import type { ChatLeadRow } from '../db/schema';
import { summarizeCare } from './care-overview';

function lead(over: Partial<ChatLeadRow> = {}): ChatLeadRow {
  return {
    id: 'cl_x',
    sessionId: 'cs_x',
    firstName: 'Sara',
    phoneE164: '+212600000000',
    phoneRaw: '0600000000',
    triggerReason: 'purchase-intent',
    outcome: 'pending',
    language: 'fr',
    intentAtCapture: 'purchase-intent',
    page: '/',
    referrer: null,
    webhookStatus: 'sent',
    webhookAttempts: 1,
    handledBy: null,
    consentVersion: 'v1',
    createdAt: new Date('2026-05-13T20:00:00Z'),
    triggeringMessageId: null,
    visitorId: 'visitor-1',
    fingerprintHash: null,
    note: null,
    utm: null,
    snapshotMessages: null,
    consentAt: new Date('2026-05-13T20:00:00Z'),
    webhookLastError: null,
    webhookSentAt: null,
    handledAt: null,
    ...over,
  } as ChatLeadRow;
}

describe('summarizeCare — leads', () => {
  const now = new Date('2026-05-13T20:00:00Z');

  it("compte hot pending et hot overdue séparément", () => {
    const s = summarizeCare({
      pendingLeads: [
        lead({ id: 'l1', triggerReason: 'purchase-intent', createdAt: new Date('2026-05-13T19:30:00Z') }),
        lead({ id: 'l2', triggerReason: 'explicit-request', createdAt: new Date('2026-05-13T15:00:00Z') }),
        lead({ id: 'l3', triggerReason: 'after-hours', createdAt: new Date('2026-05-13T10:00:00Z') }),
      ],
      frustrationEvents: [],
      now,
    });
    expect(s.pendingTotal).toBe(3);
    expect(s.hotPending).toBe(2);
    expect(s.hotOverdue).toBe(1);
    expect(s.hotOverdueRatio).toBeCloseTo(0.5);
  });

  it("renvoie 0 pour hotOverdueRatio quand aucun hot pending (pas de NaN)", () => {
    const s = summarizeCare({
      pendingLeads: [lead({ triggerReason: 'after-hours' })],
      frustrationEvents: [],
      now,
    });
    expect(s.hotPending).toBe(0);
    expect(s.hotOverdueRatio).toBe(0);
  });

  it("respecte un SLA personnalisé", () => {
    const s = summarizeCare({
      pendingLeads: [
        lead({ createdAt: new Date('2026-05-13T18:30:00Z') }),
      ],
      frustrationEvents: [],
      now,
      slaHours: 1,
    });
    expect(s.hotOverdue).toBe(1);
  });
});

describe('summarizeCare — frustration', () => {
  const now = new Date('2026-05-13T20:00:00Z');

  it("compte distinctement 24h vs 7j + sessions uniques", () => {
    const s = summarizeCare({
      pendingLeads: [],
      frustrationEvents: [
        { sessionId: 'cs_a', occurredAt: new Date('2026-05-13T19:00:00Z') },
        { sessionId: 'cs_a', occurredAt: new Date('2026-05-13T19:30:00Z') },
        { sessionId: 'cs_b', occurredAt: new Date('2026-05-13T10:00:00Z') },
        { sessionId: 'cs_c', occurredAt: new Date('2026-05-10T20:00:00Z') },
        { sessionId: 'cs_d', occurredAt: new Date('2026-05-01T20:00:00Z') }, // hors 7j
      ],
      now,
    });
    expect(s.frustration24h).toBe(3);
    expect(s.frustration7d).toBe(4);
    expect(s.frustrationSessions7d).toBe(3);
  });

  it("zéro events → 0 partout", () => {
    const s = summarizeCare({ pendingLeads: [], frustrationEvents: [], now });
    expect(s.frustration24h).toBe(0);
    expect(s.frustration7d).toBe(0);
    expect(s.frustrationSessions7d).toBe(0);
  });
});
