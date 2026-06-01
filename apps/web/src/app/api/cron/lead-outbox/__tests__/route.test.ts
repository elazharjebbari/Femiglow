/**
 * OWBS — TST-I-11 : POST /api/cron/lead-outbox.
 *  - 401 sans / mauvais Bearer
 *  - 200 + rapport quand auth OK
 *  - 500 si le drain throw
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'x'.repeat(32) } }));
vi.mock('@/lib/leads/outbox/lead-outbox-processor', () => ({
  pickAndProcessBatch: vi.fn(),
}));

const CRON_SECRET = 'x'.repeat(32);

import { POST } from '../route';
import { pickAndProcessBatch } from '@/lib/leads/outbox/lead-outbox-processor';

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/cron/lead-outbox', { method: 'POST', headers });
}

describe('POST /api/cron/lead-outbox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 sans Authorization', async () => {
    expect((await POST(makeReq())).status).toBe(401);
  });

  it('401 avec mauvais Bearer', async () => {
    expect((await POST(makeReq({ authorization: 'Bearer wrong' }))).status).toBe(401);
  });

  it('200 + rapport quand auth OK', async () => {
    vi.mocked(pickAndProcessBatch).mockResolvedValue({
      picked: 3,
      done: 2,
      rescheduled: 1,
      dead: 0,
      durationMs: 12,
    });
    const res = await POST(makeReq({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, picked: 3, done: 2, rescheduled: 1 });
  });

  it('500 si le drain throw', async () => {
    vi.mocked(pickAndProcessBatch).mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });
});
