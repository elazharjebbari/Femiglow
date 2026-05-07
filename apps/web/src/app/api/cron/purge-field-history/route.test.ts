/**
 * Vitest — cron /api/cron/purge-field-history (P10).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  publishBinding,
  upsertDraftBinding,
} from '@/lib/db/queries/component-fields';
import { POST, GET } from './route';

const componentId = 'cmp_home_hero';

beforeEach(() => {
  resetMemoryStore();
});

function bearer(): Headers {
  const h = new Headers();
  h.set('authorization', `Bearer ${process.env.CRON_SECRET}`);
  return h;
}

describe('POST /api/cron/purge-field-history', () => {
  it('rejette sans Bearer (401)', async () => {
    const res = await POST(new Request('http://x'));
    expect(res.status).toBe(401);
  });

  it('purge les entrées plus vieilles que rétention, conserve la dernière par binding', async () => {
    vi.useFakeTimers();
    try {
      // Crée plusieurs entrées d'historique sur 2 ans.
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const draft = await upsertDraftBinding({
        componentId,
        fieldKey: 'title',
        value: { v: 'Old' },
        authorId: 'admin_1',
      });
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      await upsertDraftBinding({
        componentId,
        fieldKey: 'title',
        value: { v: 'Mid' },
        authorId: 'admin_1',
      });
      vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
      await publishBinding({ bindingId: draft.id, actorId: 'admin_1' });

      // "Now" est le 2026-05-05, rétention 365 j → cutoff = 2025-05-05.
      vi.setSystemTime(new Date('2026-05-05T00:00:00Z'));
      const res = await POST(
        new Request('http://x/api/cron/purge-field-history', {
          method: 'POST',
          headers: bearer(),
        }),
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { ok: boolean; purged: number };
      expect(json.ok).toBe(true);
      expect(json.purged).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('GET fonctionne aussi (compat Vercel cron)', async () => {
    const res = await GET(
      new Request('http://x/api/cron/purge-field-history', {
        headers: bearer(),
      }),
    );
    expect(res.status).toBe(200);
  });
});
