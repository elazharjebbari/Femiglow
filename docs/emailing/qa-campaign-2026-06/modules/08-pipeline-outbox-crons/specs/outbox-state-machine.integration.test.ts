/**
 * PIP-INT-001/003/004/005/010/013/040/117 — machine d'états outbox.
 *
 * Chaque transition LÉGALE est exercée, chaque transition ILLÉGALE est prouvée
 * impossible (le claim n'inclut que pending/failed). Les oracles CIBLE marqués
 * [RED] documentent les bugs F-082/083 (attempts gonflé sur succès,
 * SmtpNotConfigured sans nextRetry).
 *
 * Harnais : style repo (mock @/lib/db/client + transport stub via vi.mock du
 * client SMTP), makeFakeDrizzle pour inspecter les .set() de chaque UPDATE. La
 * version "vraie DB" (cf. 05-conventions §4) remplacerait le fake par testSql ;
 * la logique d'oracle est identique.
 *
 * Réf : src/lib/mail/outbox.ts, client.ts ; inventaire F-082, F-083, F-081.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle, type FakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', () => ({ db: vi.fn() }));

// Transport SMTP stub : modes ok / down / refused.
const sendMail = vi.fn();
const verify = vi.fn();
vi.mock('@/lib/mail/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mail/client')>('@/lib/mail/client');
  return {
    ...actual,
    getTransporter: () => ({ sendMail, verify }),
  };
});

import { db as getDb } from '@/lib/db/client';
import { attemptSend } from '@/lib/mail/outbox';
import { SmtpNotConfiguredError } from '@/lib/mail/client';

function outboxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'eo-1',
    idempotency_key: 'idem-1',
    template: 'order-confirmation',
    template_version: 1,
    to_email: 'kaoutar@exemple.test',
    to_name: 'Kaoutar',
    from_email: 'info@femiglow-maroc.com',
    reply_to: null,
    subject: 'Confirmation',
    payload_json: {},
    html_snapshot: '<html>ok</html>',
    text_snapshot: 'ok',
    status: 'pending',
    attempts: 0,
    max_attempts: 5,
    next_retry: null,
    scheduled_for: null,
    created_at: new Date('2026-06-15T10:00:00Z'),
    updated_at: new Date('2026-06-15T10:00:00Z'),
    // camelCase aussi (attemptSend lit le claim returning typé)
    htmlSnapshot: '<html>ok</html>',
    textSnapshot: 'ok',
    fromEmail: 'info@femiglow-maroc.com',
    toEmail: 'kaoutar@exemple.test',
    toName: 'Kaoutar',
    replyTo: null,
    attempts_: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('outbox — transitions légales', () => {
  it('PIP-INT-001 + 003 : pending → sending → sent (succès) + attempts CIBLE non gonflé [RED]', async () => {
    sendMail.mockResolvedValue({ messageId: '<m1@x>', response: '250 OK' });
    const claimRow = { ...outboxRow({ status: 'pending', attempts: 0 }) };
    const drizzle = makeFakeDrizzle({ updateReturning: [claimRow] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await attemptSend('eo-1');

    // 1er update = claim -> status sending.
    const claim = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(claim.status).toBe('sending');
    // dernier update = succès -> status sent.
    const done = drizzle.calls.update.at(-1)!.set as Record<string, unknown>;
    expect(done.status).toBe('sent');
    expect(done.smtpMessageId).toBe('<m1@x>');
    // event 'sent' inséré.
    expect(drizzle.calls.insert.some((i) => (i.values as { type?: string }).type === 'sent')).toBe(true);
    // ORACLE CIBLE [RED] : un succès ne doit PAS incrémenter attempts.
    // En l'état, deliverRow fait attempts: (row.attempts ?? 0) + 1 sur succès.
    expect(done.attempts, 'attempts ne doit pas être incrémenté sur succès (F-083)').toBe(0);
  });

  it('PIP-INT-004 : sending → failed sur erreur transitoire, next_retry posé', async () => {
    sendMail.mockRejectedValue(new Error('ECONNRESET'));
    const drizzle = makeFakeDrizzle({ updateReturning: [outboxRow({ status: 'pending', attempts: 0 })] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await attemptSend('eo-1').catch(() => undefined);
    const fail = drizzle.calls.update.at(-1)!.set as Record<string, unknown>;
    expect(fail.status).toBe('failed');
    expect(fail.attempts).toBe(1);
    expect(fail.nextRetry).toBeInstanceOf(Date); // backoff posé -> reprise par le cron
  });

  it('PIP-INT-005 : sending → dlq quand attempts atteint MAX', async () => {
    sendMail.mockRejectedValue(new Error('hard fail'));
    const drizzle = makeFakeDrizzle({ updateReturning: [outboxRow({ status: 'failed', attempts: 4 })] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await attemptSend('eo-1').catch(() => undefined);
    const set = drizzle.calls.update.at(-1)!.set as Record<string, unknown>;
    expect(set.status).toBe('dlq');
    expect(set.nextRetry).toBeNull();
  });
});

describe('outbox — transitions illégales rejetées', () => {
  it('PIP-INT-010 + 013 : claim d’une ligne non-(pending|failed) ne fait rien', async () => {
    // claim returning vide -> aucune action (déjà terminal ou claimée ailleurs).
    const drizzle = makeFakeDrizzle({ updateReturning: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await attemptSend('eo-already-sent');
    // Le claim a tenté un UPDATE filtré sur inArray(status,[pending,failed]) mais
    // n'a rien retourné -> pas de sendMail, pas de 2e update.
    expect(sendMail).not.toHaveBeenCalled();
    expect(drizzle.calls.update).toHaveLength(1); // seulement le claim no-op
  });
});

describe('outbox — SmtpNotConfigured (PIP-INT-117) [RED]', () => {
  it('config error → failed AVEC nextRetry (pas de busy-loop)', async () => {
    // Force getTransporter à jeter SmtpNotConfiguredError.
    const mod = await import('@/lib/mail/client');
    vi.spyOn(mod, 'getTransporter').mockImplementation(() => {
      throw new SmtpNotConfiguredError(['SMTP_USER']);
    });
    const drizzle = makeFakeDrizzle({ updateReturning: [outboxRow({ status: 'pending', attempts: 0 })] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await attemptSend('eo-1').catch(() => undefined);
    const set = drizzle.calls.update.at(-1)!.set as Record<string, unknown>;
    expect(set.status).toBe('failed');
    // ORACLE CIBLE [RED] : deliverRow met failed SANS nextRetry -> re-claim immédiat
    // (next_retry IS NULL) en boucle. La cible pose un backoff.
    expect(set.nextRetry, 'nextRetry doit être posé pour éviter le busy-loop (F-081)').toBeInstanceOf(Date);
  });
});

describe('outbox — reaper sending orphelin (PIP-INT-031/033) [RED]', () => {
  it('documente l’absence de reaper : une ligne sending n’est jamais reprise', () => {
    // Le claim (attemptSend + CTE batch) filtre status IN (pending,failed).
    // Une ligne laissée en 'sending' après un crash n'est donc jamais re-sélectionnée.
    // ORACLE CIBLE : un reapStaleSending(threshold) remet pending/failed les
    // 'sending' anciens. Marqueur RED jusqu'au fix (cf. test-plan expect_red).
    const claimSelectsOnlyPendingFailed = true; // cf. outbox.ts l.45 et l.90
    const reaperExists = false; // aucun reaper dans outbox.ts
    expect(claimSelectsOnlyPendingFailed).toBe(true);
    expect(reaperExists, 'reaper des sending orphelins absent (F-082)').toBe(true);
  });
});
