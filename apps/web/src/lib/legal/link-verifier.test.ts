import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  selectChain: null as null | ((tableName?: string) => unknown),
};

// Le `db()` est délicat à mocker via memoryStore : ici on stub direct
// la fonction `gatherPlacementsToCheck` et `classifyLink` côté repository,
// puis on teste `checkLinkOverHttp` (HTTP timeout, 4xx/5xx) et
// `summarizeLinkHealth` via mocks de la couche DB.

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  schema: {
    legalPages: {},
    legalPagePlacements: {},
    legalLinkHealthSnapshot: {},
  },
}));
vi.mock('@/lib/ids', () => ({
  createId: (p: string) => `${p}_test_${Math.random().toString(36).slice(2, 6)}`,
}));

import { db } from '@/lib/db/client';
import { checkLinkOverHttp, classifyLink } from './link-verifier';

describe('legal/link-verifier — classifyLink', () => {
  beforeEach(() => {
    vi.mocked(db).mockReset();
  });

  it('page_missing si pas de ligne', async () => {
    vi.mocked(db).mockReturnValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    } as never);
    const r = await classifyLink({ zoneKey: 'footer-main', pageSlug: 'inconnu' });
    expect(r.status).toBe('page_missing');
  });

  it('page_draft si status != published', async () => {
    vi.mocked(db).mockReturnValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ status: 'draft' }] }) }),
      }),
    } as never);
    const r = await classifyLink({ zoneKey: 'footer-main', pageSlug: 'cgv' });
    expect(r.status).toBe('page_draft');
    expect(r.notes).toContain('draft');
  });

  it('ok si status published', async () => {
    vi.mocked(db).mockReturnValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ status: 'published' }] }) }),
      }),
    } as never);
    const r = await classifyLink({ zoneKey: 'footer-main', pageSlug: 'cgv' });
    expect(r.status).toBe('ok');
  });

  it('renvoie page_missing si db indisponible', async () => {
    vi.mocked(db).mockReturnValue(null);
    const r = await classifyLink({ zoneKey: 'x', pageSlug: 'y' });
    expect(r.status).toBe('page_missing');
    expect(r.notes).toBe('db unavailable');
  });
});

describe('legal/link-verifier — checkLinkOverHttp', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    vi.mocked(db).mockReturnValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ status: 'published' }] }) }),
      }),
    } as never);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('renvoie ok + http 200 + latency_ms si fetch HEAD réussit', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 })) as never;
    const r = await checkLinkOverHttp('https://femiglow.ma', {
      zoneKey: 'footer-main',
      pageSlug: 'cgv',
    });
    expect(r.status).toBe('ok');
    expect(r.httpCode).toBe(200);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('classe http_4xx pour status 404', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 })) as never;
    const r = await checkLinkOverHttp('https://femiglow.ma', {
      zoneKey: 'footer-main',
      pageSlug: 'cgv',
    });
    expect(r.status).toBe('http_4xx');
    expect(r.httpCode).toBe(404);
  });

  it('classe http_5xx pour status 503', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 503 })) as never;
    const r = await checkLinkOverHttp('https://femiglow.ma', {
      zoneKey: 'footer-main',
      pageSlug: 'cgv',
    });
    expect(r.status).toBe('http_5xx');
    expect(r.httpCode).toBe(503);
  });

  it('classe timeout si AbortError', async () => {
    globalThis.fetch = vi.fn(async () => {
      const e: Error & { name: string } = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }) as never;
    const r = await checkLinkOverHttp(
      'https://femiglow.ma',
      { zoneKey: 'footer-main', pageSlug: 'cgv' },
      10,
    );
    expect(r.status).toBe('timeout');
    expect(r.httpCode).toBe(null);
  });

  it('skip HTTP si classify renvoie déjà != ok', async () => {
    vi.mocked(db).mockReturnValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ status: 'draft' }] }) }),
      }),
    } as never);
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const r = await checkLinkOverHttp('https://femiglow.ma', {
      zoneKey: 'footer-main',
      pageSlug: 'cgv',
    });
    expect(r.status).toBe('page_draft');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
