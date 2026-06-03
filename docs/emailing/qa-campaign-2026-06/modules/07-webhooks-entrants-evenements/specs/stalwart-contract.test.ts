/**
 * WHK-CT-001..021 — Contract tests Stalwart webhook (table-driven sur fixtures).
 *
 * Rejoue des payloads Stalwart RÉELS (capturés/anonymisés) contre la route
 * POST /api/mail/webhook/stalwart, via le helper fake-drizzle (pas de vraie
 * DB ici — la couche intégration DB est dans bounce-chain.integration.test.ts).
 *
 * Cible (écarts audit) : hard != soft, orphelin persisté, anti-rejeu,
 * payload tronqué -> 400 sans 500, transitions gardées.
 *
 * NOTE : à déposer sous
 *   apps/web/src/app/api/mail/webhook/stalwart/__tests__/contract.test.ts
 * Les fixtures vivent dans ../__fixtures__/ (cf. test-plan.yaml).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

const SECRET = 'ssssssssssssssssssssssssssssssssssssssss';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: { ...actual.env, FEMIGLOW_STALWART_WEBHOOK_SECRET: SECRET },
  };
});
vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { POST } from '@/app/api/mail/webhook/stalwart/route';

const OUTBOX_ROW = {
  id: 'outbox-1',
  toEmail: 'kaoutar@exemple.test',
  smtpMessageId: '<msg-42@femiglow-maroc.com>',
  status: 'sent' as const,
};

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/mail/webhook/stalwart', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'x-fg-webhook-token': SECRET,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

// Accesseurs typés sur les enregistrements fake-drizzle (values/set sont unknown).
const vals = (i: { values?: unknown }) => (i.values ?? {}) as Record<string, unknown>;
const sets = (u: { set?: unknown }) => (u.set ?? {}) as Record<string, unknown>;

// ── Fixtures inline (en prod : import des .json de __fixtures__) ──────────
const fixtures = {
  delivered: {
    event: 'delivery.delivered',
    messageId: '<msg-42@femiglow-maroc.com>',
    rcpt: 'kaoutar@exemple.test',
    ts: '2026-06-01T10:00:05Z',
  },
  bounceHard550: {
    event: 'delivery.failed',
    messageId: '<msg-42@femiglow-maroc.com>',
    rcpt: 'kaoutar@exemple.test',
    errorCode: 550,
    reason: '5.1.1 user unknown',
    ts: '2026-06-01T10:00:05Z',
  },
  bounceSoft452: {
    event: 'delivery.failed',
    messageId: '<msg-42@femiglow-maroc.com>',
    rcpt: 'kaoutar@exemple.test',
    errorCode: 452,
    reason: '4.2.2 mailbox full',
    ts: '2026-06-01T10:00:05Z',
  },
  bounce552: {
    event: 'delivery.failed',
    messageId: '<msg-42@femiglow-maroc.com>',
    errorCode: 552,
    reason: '5.2.2 over quota',
    ts: '2026-06-01T10:00:05Z',
  },
  bounce421: {
    event: 'delivery.failed',
    messageId: '<msg-42@femiglow-maroc.com>',
    errorCode: 421,
    reason: '4.7.0 service unavailable',
    ts: '2026-06-01T10:00:05Z',
  },
  queued: { event: 'queue.message-queued', messageId: '<msg-42@femiglow-maroc.com>', ts: '2026-06-01T10:00:00Z' },
  rescheduled: { event: 'queue.rescheduled', messageId: '<msg-42@femiglow-maroc.com>', ts: '2026-06-01T10:01:00Z' },
  unknownEvent: { event: 'acme.renew', whatever: 'noise' },
  authFailed: { event: 'auth.failed', user: 'x@y.z', ip: '1.2.3.4', ts: '2026-06-01T10:00:00Z' },
  noMessageId: { event: 'delivery.delivered', rcpt: 'k@x.test', ts: '2026-06-01T10:00:00Z' },
};

describe('Stalwart contract — auth & shape', () => {
  it('WHK-CT-015/016 : mauvais token -> 401', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [OUTBOX_ROW] }) as never);
    const res = await POST(req(fixtures.delivered, { 'x-fg-webhook-token': 'wrong' }) as never);
    expect(res.status).toBe(401);
  });

  it('WHK-CT-011 : payload tronqué (JSON partiel) -> 400 jamais 500', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle() as never);
    const res = await POST(req('{"event":"delivery.deli') as never);
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('WHK-CT-013 : event inconnu -> 200 ignored=unhandled-event', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle() as never);
    const res = await POST(req(fixtures.unknownEvent) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe('unhandled-event');
  });

  it('WHK-CT-014 : auth.failed -> 200 sans écriture outbox', async () => {
    const dz = makeFakeDrizzle();
    vi.mocked(getDb).mockReturnValue(dz as never);
    const res = await POST(req(fixtures.authFailed) as never);
    expect(res.status).toBe(200);
    expect(dz.calls.update).toHaveLength(0);
  });
});

describe('Stalwart contract — delivered', () => {
  it('WHK-CT-001 : delivered -> outbox.status=delivered + email_event', async () => {
    const dz = makeFakeDrizzle({ selectResult: [OUTBOX_ROW] });
    vi.mocked(getDb).mockReturnValue(dz as never);
    const res = await POST(req(fixtures.delivered) as never);
    expect(res.status).toBe(200);
    // outbox passé en delivered
    expect(dz.calls.update.some((u) => sets(u).status === 'delivered')).toBe(true);
    // un email_event delivered inséré
    expect(dz.calls.insert.some((i) => vals(i).type === 'delivered')).toBe(true);
  });
});

describe('Stalwart contract — bounce hard != soft (table-driven, anti W-SOFT)', () => {
  const cases = [
    { id: 'WHK-CT-002', name: 'bounceHard550', fixture: fixtures.bounceHard550, status: 'bounced_permanent', suppress: true },
    { id: 'WHK-CT-003', name: 'bounceSoft452', fixture: fixtures.bounceSoft452, status: 'bounced_soft', suppress: false },
    { id: 'WHK-CT-004', name: 'bounce552', fixture: fixtures.bounce552, status: 'bounced_permanent', suppress: true },
    { id: 'WHK-CT-005', name: 'bounce421', fixture: fixtures.bounce421, status: 'bounced_soft', suppress: false },
  ];
  it.each(cases)('$id : $name -> status=$status, suppression=$suppress', async ({ fixture, status, suppress }) => {
    const dz = makeFakeDrizzle({ selectResult: [OUTBOX_ROW] });
    vi.mocked(getDb).mockReturnValue(dz as never);
    const res = await POST(req(fixture) as never);
    expect(res.status).toBe(200);
    expect(dz.calls.update.some((u) => sets(u).status === status)).toBe(true);
    const supprInserted = dz.calls.insert.some((i) => vals(i).reason === 'hard_bounce');
    expect(supprInserted).toBe(suppress);
  });
});

describe('Stalwart contract — events neutres', () => {
  it('WHK-CT-007 : queued -> email_event queued, pas de changement status', async () => {
    const dz = makeFakeDrizzle({ selectResult: [OUTBOX_ROW] });
    vi.mocked(getDb).mockReturnValue(dz as never);
    await POST(req(fixtures.queued) as never);
    expect(dz.calls.insert.some((i) => vals(i).type === 'queued')).toBe(true);
    expect(dz.calls.update.some((u) => sets(u).status)).toBe(false);
  });

  it('WHK-CT-008 : rescheduled -> email_event retried', async () => {
    const dz = makeFakeDrizzle({ selectResult: [OUTBOX_ROW] });
    vi.mocked(getDb).mockReturnValue(dz as never);
    await POST(req(fixtures.rescheduled) as never);
    expect(dz.calls.insert.some((i) => vals(i).type === 'retried')).toBe(true);
  });
});

/**
 * WHK-CT-009/010 — orphelins. ÉTAT CIBLE : on persiste l'event au lieu du
 * 200 {ignored} muet. Ce test est ROUGE sur le code actuel (qui ignore) et
 * devient vert après le correctif W-ORPH. Marqué pour le runbook.
 */
describe('Stalwart contract — orphelins (CIBLE W-ORPH, rouge avant fix)', () => {
  it('WHK-CT-010 : messageId inconnu -> email_event orphelin persisté', async () => {
    const dz = makeFakeDrizzle({ selectResult: [] }); // 0 ligne outbox
    vi.mocked(getDb).mockReturnValue(dz as never);
    const res = await POST(req(fixtures.delivered) as never);
    expect(res.status).toBe(200);
    // CIBLE : un email_event orphelin (outboxId null / correlation=orphan).
    // fake-drizzle expose les inserts via calls.insert[].values.
    const orphan = dz.calls.insert.find(
      (i) => (i.values as { outboxId?: unknown } | undefined)?.outboxId == null
        && (i.values as { source?: unknown } | undefined)?.source === 'stalwart',
    );
    expect(orphan, "l'événement orphelin doit être persisté, pas jeté").toBeTruthy();
  });

  it('WHK-CT-009 : messageId absent -> orphelin persisté (no-message-id)', async () => {
    const dz = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(dz as never);
    const res = await POST(req(fixtures.noMessageId) as never);
    expect(res.status).toBe(200);
    const orphan = dz.calls.insert.find(
      (i) => (i.values as { outboxId?: unknown } | undefined)?.outboxId == null,
    );
    expect(orphan).toBeTruthy();
  });
});

/**
 * WHK-CT-021 — transition gardée : delivered ne ressuscite pas un
 * bounced_permanent. ÉTAT CIBLE (rouge avant fix de la garde de transition).
 */
describe('Stalwart contract — transition gardée (CIBLE)', () => {
  it('WHK-CT-021 : delivered après bounced_permanent ne régresse pas', async () => {
    const dz = makeFakeDrizzle({
      selectResult: [{ ...OUTBOX_ROW, status: 'bounced_permanent' }],
    });
    vi.mocked(getDb).mockReturnValue(dz as never);
    await POST(req(fixtures.delivered) as never);
    // Aucun UPDATE status=delivered sur une ligne déjà terminale.
    expect(dz.calls.update.some((u) => sets(u).status === 'delivered')).toBe(false);
  });
});
