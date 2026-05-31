/**
 * Integration tests for POST /api/cron/email-outbox.
 *
 * The endpoint :
 *   - rejects requests without/with bad Bearer auth (401)
 *   - calls pickAndProcessBatch and returns its result as JSON
 *   - returns 500 with structured body if the batch throws
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/mail/outbox', () => ({
  pickAndProcessBatch: vi.fn(),
}));

import { POST } from '../route';
import { pickAndProcessBatch } from '@/lib/mail/outbox';

const CRON_SECRET = process.env.CRON_SECRET ?? 'c'.repeat(32);

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/cron/email-outbox', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/cron/email-outbox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without Authorization', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong Bearer', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 + result when auth OK and batch succeeds', async () => {
    vi.mocked(pickAndProcessBatch).mockResolvedValue({
      picked: 5,
      succeeded: 4,
      failed: 1,
      dlq: 0,
      durationMs: 123,
    });
    const res = await POST(makeReq({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      picked: 5,
      succeeded: 4,
      failed: 1,
      dlq: 0,
    });
  });

  it('returns 500 with structured error when batch throws', async () => {
    vi.mocked(pickAndProcessBatch).mockRejectedValue(new Error('DB down'));
    const res = await POST(makeReq({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('DB down');
  });

  it('uses constant-time comparison-equivalent (we never echo the secret)', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer foo' }));
    const text = await res.text();
    expect(text.includes(CRON_SECRET)).toBe(false);
  });
});
