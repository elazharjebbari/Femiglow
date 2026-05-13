/**
 * CHAT-067 — Tests `GET /api/cron/chat/weekly-digest`.
 *
 * On valide :
 *  - 401 si Bearer manquant / mauvais
 *  - 200 + skipped si CHAT_DIGEST_RECIPIENT absent
 *  - 200 + listChatLeads appelé avec une fenêtre 7 jours
 *  - 500 si le provider email renvoie ok:false
 *  - subject "hot pending" remonte bien dans le payload sent
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/admin/queries', () => ({
  adminQueries: {
    listChatLeads: vi.fn(),
  },
}));

vi.mock('@/lib/rituals/email-provider', () => ({
  getEmailProvider: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    CRON_SECRET: 'unit-cron-secret-1234567890abcdef',
    CHAT_DIGEST_RECIPIENT: 'care@femiglow.local',
    CHAT_DIGEST_FROM: 'FemiGlow Chat <chat@femiglow.local>',
    NEXT_PUBLIC_SITE_URL: 'https://femiglow.local',
  },
}));

import { adminQueries } from '@/lib/chat/admin/queries';
import { env } from '@/lib/env';
import { getEmailProvider } from '@/lib/rituals/email-provider';
import { GET } from './route';

const listMock = adminQueries.listChatLeads as unknown as ReturnType<typeof vi.fn>;
const providerMock = getEmailProvider as unknown as ReturnType<typeof vi.fn>;

function makeReq(authorized = true): NextRequest {
  const headers = new Headers();
  if (authorized) headers.set('authorization', `Bearer ${env.CRON_SECRET}`);
  return new NextRequest('http://localhost/api/cron/chat/weekly-digest', { headers });
}

function lead(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cl_1',
    sessionId: 'cs_1',
    firstName: 'Sara',
    phoneE164: '+212600000000',
    triggerReason: 'purchase-intent',
    outcome: 'pending',
    language: 'fr',
    page: '/produit',
    referrer: null,
    intentAtCapture: 'purchase-intent',
    webhookStatus: 'sent',
    webhookAttempts: 1,
    handledBy: null,
    consentVersion: 'v1',
    createdAt: new Date('2026-05-13T10:00:00Z'),
    ...over,
  };
}

beforeEach(() => {
  (env as unknown as Record<string, unknown>).CHAT_DIGEST_RECIPIENT = 'care@femiglow.local';
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/cron/chat/weekly-digest', () => {
  it('renvoie 401 sans bearer valide', async () => {
    const res = await GET(makeReq(false));
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('renvoie 200 + skipped si pas de recipient configuré', async () => {
    (env as unknown as Record<string, unknown>).CHAT_DIGEST_RECIPIENT = undefined;
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; skipped: boolean };
    expect(body).toEqual({ ok: true, skipped: true, reason: 'no-recipient' });
    expect(listMock).not.toHaveBeenCalled();
  });

  it('liste les leads sur une fenêtre 7 jours et envoie l\'email', async () => {
    listMock.mockResolvedValueOnce([lead(), lead({ id: 'cl_2', outcome: 'converted' })]);
    const sendMock = vi.fn().mockResolvedValueOnce({ ok: true, messageId: 'msg_1' });
    providerMock.mockReturnValueOnce({ name: 'noop', send: sendMock });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; total: number };
    expect(body.ok).toBe(true);
    expect(body.total).toBe(2);

    const call = listMock.mock.calls[0]![0] as { fromDate: Date; toDate: Date; limit: number };
    expect(call.fromDate).toBeInstanceOf(Date);
    expect(call.toDate).toBeInstanceOf(Date);
    expect(call.toDate.getTime() - call.fromDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(call.limit).toBe(1000);

    expect(sendMock).toHaveBeenCalledOnce();
    const payload = sendMock.mock.calls[0]![0] as { to: string; rendered: { subject: string } };
    expect(payload.to).toBe('care@femiglow.local');
    expect(payload.rendered.subject).toContain('hot pending');
  });

  it('renvoie 500 si le provider renvoie ok:false', async () => {
    listMock.mockResolvedValueOnce([]);
    providerMock.mockReturnValueOnce({
      name: 'resend',
      send: vi.fn().mockResolvedValueOnce({ ok: false, error: 'boom' }),
    });
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe('boom');
  });
});
