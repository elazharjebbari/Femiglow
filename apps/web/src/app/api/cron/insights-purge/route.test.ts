import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { GET, POST } from './route';

beforeEach(() => {
  resetMemoryStore();
});

function bearer(secret = process.env.CRON_SECRET): Headers {
  const h = new Headers();
  h.set('authorization', `Bearer ${secret}`);
  return h;
}

describe('cron /api/cron/insights-purge', () => {
  it('401 sans Bearer', async () => {
    const res = await POST(new Request('http://x'));
    expect(res.status).toBe(401);
  });

  it('401 Bearer invalide', async () => {
    const h = new Headers();
    h.set('authorization', 'Bearer wrong');
    const res = await POST(new Request('http://x', { headers: h }));
    expect(res.status).toBe(401);
  });

  it('200 + purges renvoyés avec Bearer valide', async () => {
    const res = await POST(new Request('http://x', { headers: bearer() }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; purged: Record<string, number> };
    expect(body.ok).toBe(true);
    expect(body.purged).toBeDefined();
  });

  it('GET fonctionne aussi (compat Vercel cron)', async () => {
    const res = await GET(new Request('http://x', { headers: bearer() }));
    expect(res.status).toBe(200);
  });
});
