import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/mail/automation/runner', () => ({
  tickAutomation: vi.fn(),
}));
vi.mock('@/lib/mail/automation/resume', () => ({
  sweepWaitForEventTimeouts: vi.fn().mockResolvedValue(0),
}));
vi.mock('@/lib/mail/automation/event-dispatcher', () => ({
  dispatchEventTriggers: vi.fn().mockResolvedValue({
    automations: 0,
    eventsScanned: 0,
    enrolled: 0,
    deduped: 0,
    conditionBlocked: 0,
  }),
}));

import { POST } from '../route';
import { tickAutomation } from '@/lib/mail/automation/runner';

const CRON_SECRET = process.env.CRON_SECRET ?? 'c'.repeat(32);

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/cron/email-automation', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/cron/email-automation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects without auth', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('runs tick and returns result', async () => {
    vi.mocked(tickAutomation).mockResolvedValue({
      picked: 3,
      advanced: 1,
      completed: 1,
      errored: 1,
      orphansRearmed: 0,
      orphansErrored: 0,
      durationMs: 45,
    });
    const res = await POST(makeReq({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, picked: 3, advanced: 1, errored: 1 });
  });

  it('returns 500 on tick failure', async () => {
    vi.mocked(tickAutomation).mockRejectedValue(new Error('boom'));
    const res = await POST(makeReq({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(500);
  });
});
