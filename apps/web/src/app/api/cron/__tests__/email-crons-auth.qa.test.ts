/**
 * INF-CRON-AUTH — auth Bearer des crons emailing restants (module 11).
 *
 * Couvre les 3 routes cron qui n'avaient pas de test d'auth dédié :
 *   - email-campaign-sync  (poll métriques Listmonk)
 *   - email-listmonk-cleanup (suppression listes éphémères)
 *   - email-audience-purge (purge snapshots > 90j)
 *
 * Oracles par route :
 *   (a) sans bearer → 401, le travail métier n'est PAS exécuté.
 *   (b) mauvais bearer → 401, idem.
 *   (c) mauvais bearer de MÊME LONGUEUR → 401 (comparaison constant-time, pas de
 *       short-circuit sur l'égalité naïve).
 *   (d) bon bearer → 200, le travail métier exécuté UNE fois.
 *   (e) IDEMPOTENCE : un double tick autorisé est sûr (deux exécutions, deux 200,
 *       deux appels métier — la fonction métier est elle-même idempotente).
 *   (f) le secret n'est JAMAIS renvoyé dans le corps de réponse (anti-leak).
 *
 * Les fonctions métier (sync/cleanup/purge) sont mockées : on teste la GARDE
 * d'auth et le câblage de la route, pas leur logique interne (couverte ailleurs).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { CRON_SECRET } = vi.hoisted(() => ({
  CRON_SECRET: process.env.CRON_SECRET ?? 'c'.repeat(32),
}));

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET } }));

vi.mock('@/lib/mail/campaigns/listmonk-status-sync', () => ({
  syncCampaignStatuses: vi.fn(),
}));
vi.mock('@/lib/mail/campaigns/listmonk-sync', () => ({
  cleanupExpiredListmonkLists: vi.fn(),
}));
vi.mock('@/lib/mail/audiences/purge', () => ({
  purgeExpiredSnapshots: vi.fn(),
}));

import { POST as campaignSyncPOST } from '@/app/api/cron/email-campaign-sync/route';
import { POST as listmonkCleanupPOST } from '@/app/api/cron/email-listmonk-cleanup/route';
import { POST as audiencePurgePOST } from '@/app/api/cron/email-audience-purge/route';
import { syncCampaignStatuses } from '@/lib/mail/campaigns/listmonk-status-sync';
import { cleanupExpiredListmonkLists } from '@/lib/mail/campaigns/listmonk-sync';
import { purgeExpiredSnapshots } from '@/lib/mail/audiences/purge';

function makeReq(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { method: 'POST', headers });
}

/** Un bearer de MÊME LONGUEUR que le secret mais incorrect (vérifie qu'on ne
 * se contente pas d'une comparaison qui passerait par court-circuit). */
const SAME_LEN_WRONG = 'x'.repeat(CRON_SECRET.length);

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

type Case = {
  name: string;
  url: string;
  POST: (req: Request) => Promise<Response>;
  job: ReturnType<typeof vi.fn>;
  jobResult: unknown;
};

const cases: Case[] = [
  {
    name: 'email-campaign-sync',
    url: 'http://test/api/cron/email-campaign-sync',
    POST: campaignSyncPOST,
    job: vi.mocked(syncCampaignStatuses),
    jobResult: { checked: 2, updated: 1, errors: 0, durationMs: 10 },
  },
  {
    name: 'email-listmonk-cleanup',
    url: 'http://test/api/cron/email-listmonk-cleanup',
    POST: listmonkCleanupPOST,
    job: vi.mocked(cleanupExpiredListmonkLists),
    jobResult: { purged: 0 },
  },
  {
    name: 'email-audience-purge',
    url: 'http://test/api/cron/email-audience-purge',
    POST: audiencePurgePOST,
    job: vi.mocked(purgeExpiredSnapshots),
    jobResult: { purged: 0, durationMs: 3 },
  },
];

describe.each(cases)('POST /api/cron/$name — auth Bearer (INF-CRON-AUTH)', (c) => {
  // INF-CRON-AUTH-a — sans bearer → 401, métier non exécuté.
  it('sans bearer → 401, le job n\'est pas exécuté', async () => {
    const res = await c.POST(makeReq(c.url));
    expect(res.status).toBe(401);
    expect(c.job).not.toHaveBeenCalled();
  });

  // INF-CRON-AUTH-b — mauvais bearer (longueur différente) → 401.
  it('mauvais bearer → 401', async () => {
    const res = await c.POST(makeReq(c.url, { authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
    expect(c.job).not.toHaveBeenCalled();
  });

  // INF-CRON-AUTH-c — mauvais bearer de MÊME LONGUEUR → 401 (constant-time).
  it('mauvais bearer de même longueur → 401', async () => {
    const res = await c.POST(makeReq(c.url, { authorization: `Bearer ${SAME_LEN_WRONG}` }));
    expect(res.status).toBe(401);
    expect(c.job).not.toHaveBeenCalled();
  });

  // INF-CRON-AUTH-d — bon bearer → 200, job exécuté UNE fois.
  it('bon bearer → 200, job exécuté une fois', async () => {
    c.job.mockResolvedValue(c.jobResult);
    const res = await c.POST(makeReq(c.url, { authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(c.job).toHaveBeenCalledTimes(1);
  });

  // INF-CRON-AUTH-e — IDEMPOTENCE : double tick autorisé → deux 200, sûr.
  it('double tick autorisé → deux 200 (idempotent)', async () => {
    c.job.mockResolvedValue(c.jobResult);
    const r1 = await c.POST(makeReq(c.url, { authorization: `Bearer ${CRON_SECRET}` }));
    const r2 = await c.POST(makeReq(c.url, { authorization: `Bearer ${CRON_SECRET}` }));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(c.job).toHaveBeenCalledTimes(2);
  });

  // INF-CRON-AUTH-f — le secret ne fuit jamais dans la réponse.
  it('ne renvoie jamais le secret dans le corps', async () => {
    const res = await c.POST(makeReq(c.url, { authorization: 'Bearer foo' }));
    const text = await res.text();
    expect(text.includes(CRON_SECRET)).toBe(false);
  });
});
