/**
 * Tests pure functions de `lead-sla.ts`.
 *
 * On couvre :
 *  - formatLeadAge sur tous les seuils (min, heure, jour)
 *  - clamp à 0 si createdAt > now (clock skew)
 *  - isHotPendingOverdue ne flag QUE pending + trigger hot + âge >= SLA
 *  - SLA personnalisé respecté
 */
import { describe, expect, it } from 'vitest';

import type { ChatLeadRow } from '../db/schema';
import { formatLeadAge, isHotPendingOverdue } from './lead-sla';

describe('formatLeadAge', () => {
  const now = new Date('2026-05-13T20:00:00Z');

  it('renvoie "Nm" pour moins d\'une heure', () => {
    expect(formatLeadAge(new Date('2026-05-13T19:55:00Z'), now)).toBe('5m');
    expect(formatLeadAge(new Date('2026-05-13T19:01:00Z'), now)).toBe('59m');
  });

  it('renvoie "Nh" pour pile une heure, "NhMM" sinon', () => {
    expect(formatLeadAge(new Date('2026-05-13T19:00:00Z'), now)).toBe('1h');
    expect(formatLeadAge(new Date('2026-05-13T18:30:00Z'), now)).toBe('1h30');
  });

  it('renvoie "Nj" pour pile N jours, "NjHH" sinon', () => {
    expect(formatLeadAge(new Date('2026-05-12T20:00:00Z'), now)).toBe('1j');
    expect(formatLeadAge(new Date('2026-05-12T18:00:00Z'), now)).toBe('1j02');
    expect(formatLeadAge(new Date('2026-05-08T20:00:00Z'), now)).toBe('5j');
  });

  it('clamp à 0 si createdAt > now (clock skew)', () => {
    expect(formatLeadAge(new Date('2026-05-14T00:00:00Z'), now)).toBe('0m');
  });
});

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
    createdAt: new Date('2026-05-13T15:00:00Z'),
    triggeringMessageId: null,
    visitorId: 'visitor-1',
    fingerprintHash: null,
    note: null,
    utm: null,
    snapshotMessages: null,
    consentAt: new Date('2026-05-13T15:00:00Z'),
    webhookLastError: null,
    webhookSentAt: null,
    handledAt: null,
    ...over,
  } as ChatLeadRow;
}

describe('isHotPendingOverdue', () => {
  const now = new Date('2026-05-13T20:00:00Z');

  it('vrai si pending + trigger hot + âge >= 4h', () => {
    expect(
      isHotPendingOverdue(
        lead({ outcome: 'pending', triggerReason: 'purchase-intent', createdAt: new Date('2026-05-13T16:00:00Z') }),
        now,
      ),
    ).toBe(true);
  });

  it('faux si âge < SLA (3h59)', () => {
    expect(
      isHotPendingOverdue(
        lead({ createdAt: new Date('2026-05-13T16:01:00Z') }),
        now,
      ),
    ).toBe(false);
  });

  it('faux si trigger non-hot (after-hours)', () => {
    expect(
      isHotPendingOverdue(
        lead({ triggerReason: 'after-hours', createdAt: new Date('2026-05-13T10:00:00Z') }),
        now,
      ),
    ).toBe(false);
  });

  it('faux si outcome != pending', () => {
    expect(
      isHotPendingOverdue(
        lead({ outcome: 'reached', createdAt: new Date('2026-05-13T10:00:00Z') }),
        now,
      ),
    ).toBe(false);
  });

  it('respecte un SLA personnalisé', () => {
    expect(
      isHotPendingOverdue(
        lead({ createdAt: new Date('2026-05-13T18:30:00Z') }),
        now,
        1,
      ),
    ).toBe(true);
  });
});
