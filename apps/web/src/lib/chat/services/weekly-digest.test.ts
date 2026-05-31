/**
 * CHAT-067 — Tests du builder de digest hebdo (pure function).
 *
 * On valide :
 *  - le summary trie correctement par outcome / trigger
 *  - le subject change quand des hot pending existent
 *  - les leads pending non-hot ne comptent pas comme hot
 *  - hotPendingSample est plafonné à 5
 *  - le body inclut les compteurs + lien admin
 *  - le adminBaseUrl avec trailing slash est nettoyé
 *  - sans baseUrl → lien relatif /admin/chat/leads
 */
import { describe, expect, it } from 'vitest';

import type { ChatLeadRow } from '../db/schema';
import { buildWeeklyDigest, summarizeWeeklyLeads } from './weekly-digest';

function lead(over: Partial<ChatLeadRow> = {}): ChatLeadRow {
  return {
    id: `cl_${Math.random().toString(36).slice(2, 8)}`,
    sessionId: 'cs_x',
    firstName: 'Sara',
    phoneE164: '+212600000000',
    phoneRaw: '0600000000',
    triggerReason: 'purchase-intent',
    outcome: 'pending',
    language: 'fr',
    intentAtCapture: 'purchase-intent',
    page: '/produit/serum',
    referrer: null,
    webhookStatus: 'sent',
    webhookAttempts: 1,
    handledBy: null,
    consentVersion: 'v1',
    createdAt: new Date('2026-05-10T10:00:00Z'),
    triggeringMessageId: null,
    visitorId: 'visitor-1',
    fingerprintHash: null,
    note: null,
    utm: null,
    snapshotMessages: null,
    consentAt: new Date('2026-05-10T10:00:00Z'),
    webhookLastError: null,
    webhookSentAt: new Date('2026-05-10T10:00:01Z'),
    handledAt: null,
    ...over,
  } as ChatLeadRow;
}

describe('summarizeWeeklyLeads — handling time KPI', () => {
  it('ne calcule pas de KPI quand aucun lead handledAt', () => {
    const s = summarizeWeeklyLeads([
      lead({ outcome: 'pending' }),
      lead({ outcome: 'pending' }),
    ]);
    expect(s.handledCount).toBe(0);
    expect(s.medianHandlingMinutes).toBeNull();
    expect(s.p90HandlingMinutes).toBeNull();
  });

  it('calcule la médiane et le p90 sur les leads handledAt non-null', () => {
    const created = new Date('2026-05-10T10:00:00Z');
    // Délais en minutes : 5, 10, 15, 20, 30, 45, 60, 90, 120, 240
    const minutes = [5, 10, 15, 20, 30, 45, 60, 90, 120, 240];
    const leads = minutes.map((delta) =>
      lead({
        outcome: 'reached',
        createdAt: created,
        handledAt: new Date(created.getTime() + delta * 60_000),
      }),
    );
    const s = summarizeWeeklyLeads(leads);
    expect(s.handledCount).toBe(10);
    // Médiane (idx Math.floor(0.5 * 10) = 5 → 45)
    expect(s.medianHandlingMinutes).toBe(45);
    // p90 (idx Math.floor(0.9 * 10) = 9 → 240)
    expect(s.p90HandlingMinutes).toBe(240);
  });

  it('ignore les handledAt antérieurs au createdAt (clock skew)', () => {
    const created = new Date('2026-05-10T10:00:00Z');
    const s = summarizeWeeklyLeads([
      lead({
        outcome: 'reached',
        createdAt: created,
        handledAt: new Date(created.getTime() - 60_000),
      }),
      lead({
        outcome: 'reached',
        createdAt: created,
        handledAt: new Date(created.getTime() + 30 * 60_000),
      }),
    ]);
    expect(s.handledCount).toBe(1);
    expect(s.medianHandlingMinutes).toBe(30);
  });
});

describe('summarizeWeeklyLeads', () => {
  it('compte chaque outcome et trigger', () => {
    const s = summarizeWeeklyLeads([
      lead({ outcome: 'pending', triggerReason: 'purchase-intent' }),
      lead({ outcome: 'pending', triggerReason: 'b2b' }),
      lead({ outcome: 'converted', triggerReason: 'explicit-request' }),
      lead({ outcome: 'reached', triggerReason: 'inline-contact' }),
      lead({ outcome: 'no-answer', triggerReason: 'after-hours' }),
      lead({ outcome: 'discarded', triggerReason: 'frustration' }),
    ]);
    expect(s.total).toBe(6);
    expect(s.pending).toBe(2);
    expect(s.converted).toBe(1);
    expect(s.reached).toBe(1);
    expect(s.noAnswer).toBe(1);
    expect(s.discarded).toBe(1);
    expect(s.byTrigger['purchase-intent']).toBe(1);
    expect(s.byTrigger['b2b']).toBe(1);
  });

  it('ne marque hotPending QUE pour purchase-intent / explicit-request / inline-contact', () => {
    const s = summarizeWeeklyLeads([
      lead({ outcome: 'pending', triggerReason: 'purchase-intent' }),
      lead({ outcome: 'pending', triggerReason: 'explicit-request' }),
      lead({ outcome: 'pending', triggerReason: 'inline-contact' }),
      lead({ outcome: 'pending', triggerReason: 'after-hours' }),
      lead({ outcome: 'pending', triggerReason: 'b2b' }),
    ]);
    expect(s.pending).toBe(5);
    expect(s.hotPending).toBe(3);
  });
});

describe('buildWeeklyDigest', () => {
  const generatedAt = new Date('2026-05-13T07:00:00Z');

  it('produit un sujet "hot pending" quand au moins un pending hot', () => {
    const rendered = buildWeeklyDigest({
      leads: [lead({ outcome: 'pending', triggerReason: 'purchase-intent' })],
      generatedAt,
    });
    expect(rendered.subject).toContain('1 hot pending');
  });

  it('produit un sujet date-only sans hot pending', () => {
    const rendered = buildWeeklyDigest({
      leads: [lead({ outcome: 'converted', triggerReason: 'purchase-intent' })],
      generatedAt,
    });
    expect(rendered.subject).toContain('2026-05-13');
    expect(rendered.subject).not.toContain('hot pending');
  });

  it('embarque les compteurs dans le body', () => {
    const rendered = buildWeeklyDigest({
      leads: [
        lead({ outcome: 'pending', triggerReason: 'purchase-intent' }),
        lead({ outcome: 'converted', triggerReason: 'explicit-request' }),
      ],
      generatedAt,
    });
    expect(rendered.body).toContain('Total leads      : 2');
    expect(rendered.body).toContain('Pending      : 1');
    expect(rendered.body).toContain('Converted    : 1');
  });

  it('plafonne hot pending sample à 5', () => {
    const leads: ChatLeadRow[] = Array.from({ length: 8 }, (_, i) =>
      lead({
        outcome: 'pending',
        triggerReason: 'purchase-intent',
        firstName: `Lead${i}`,
      }),
    );
    const rendered = buildWeeklyDigest({ leads, generatedAt });
    const sampleLines = rendered.body
      .split('\n')
      .filter((l) => l.includes(' · '));
    expect(sampleLines).toHaveLength(5);
  });

  it('affiche la section "Temps de prise en charge" quand handledCount > 0', () => {
    const created = new Date('2026-05-10T10:00:00Z');
    const rendered = buildWeeklyDigest({
      leads: [
        lead({
          outcome: 'reached',
          createdAt: created,
          handledAt: new Date(created.getTime() + 90 * 60_000),
        }),
      ],
      generatedAt,
    });
    expect(rendered.body).toContain('Temps de prise en charge (1 traités)');
    // 90 min → "1h30"
    expect(rendered.body).toContain('1h30');
  });

  it('omet la section "Temps de prise en charge" quand aucun handled', () => {
    const rendered = buildWeeklyDigest({
      leads: [lead({ outcome: 'pending' })],
      generatedAt,
    });
    expect(rendered.body).not.toContain('Temps de prise en charge');
  });

  it('embarque le lien admin avec baseUrl (trailing slash strip)', () => {
    const rendered = buildWeeklyDigest({
      leads: [],
      generatedAt,
      adminBaseUrl: 'https://femiglow.local/',
    });
    expect(rendered.body).toContain('https://femiglow.local/admin/chat/leads');
    expect(rendered.body).not.toContain('femiglow.local//admin');
  });

  it('fallback lien relatif quand pas de baseUrl', () => {
    const rendered = buildWeeklyDigest({ leads: [], generatedAt });
    expect(rendered.body).toContain('/admin/chat/leads');
  });

  it('preheader vide-state quand 0 lead', () => {
    const rendered = buildWeeklyDigest({ leads: [], generatedAt });
    expect(rendered.preheader).toBe('Aucun lead chat cette semaine.');
  });
});
