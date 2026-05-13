/**
 * Tests pour GET /api/chat/health.
 *
 * Couvre la matrice service level :
 *  - killswitch env off → STATIC (5)
 *  - DB indisponible → STATIC (5)
 *  - runtime toggle off → STATIC (5)
 *  - aucun provider chat → KEYWORD_ONLY (4)
 *  - aucun provider embedding → RAG_OFF (3)
 *  - certains providers down → DEGRADED (2)
 *  - tout vert → NOMINAL (1)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    chatEnabled: true,
    chatActive: true,
    db: 'available' as 'available' | 'null',
    rows: [] as Array<{ kind: string; role: string; enabled: boolean }>,
    dbThrows: false,
  };
  const dbFactory = vi.fn(() => {
    if (state.db === 'null') return null;
    return {
      select: () => ({
        from: () => {
          if (state.dbThrows) throw new Error('db-fail');
          return Promise.resolve(state.rows);
        },
      }),
    };
  });
  return { state, dbFactory };
});

vi.mock('@/lib/chat/feature-flag', () => ({
  isChatEnabled: () => mocks.state.chatEnabled,
}));

vi.mock('@/lib/chat/runtime-setting', () => ({
  isChatActive: vi.fn(async () => mocks.state.chatActive),
}));

vi.mock('@/lib/chat/db/client', () => ({
  chatDb: mocks.dbFactory,
}));

vi.mock('@/lib/chat/db/schema', () => ({
  chatProviderConfig: { kind: 'kind', role: 'role', enabled: 'enabled' },
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET } from './route';

beforeEach(() => {
  mocks.state.chatEnabled = true;
  mocks.state.chatActive = true;
  mocks.state.db = 'available';
  mocks.state.dbThrows = false;
  mocks.state.rows = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/chat/health', () => {
  it('killswitch env off → STATIC (5)', async () => {
    mocks.state.chatEnabled = false;
    const res = await GET();
    const body = await res.json();
    expect(body.serviceLevel).toBe(5);
    expect(body.chatEnabled).toBe(false);
    expect(body.db).toBe('unavailable');
  });

  it('DB nulle (DATABASE_URL absent) → STATIC (5)', async () => {
    mocks.state.db = 'null';
    const res = await GET();
    const body = await res.json();
    expect(body.serviceLevel).toBe(5);
    expect(body.chatEnabled).toBe(true);
    expect(body.db).toBe('unavailable');
  });

  it('runtime toggle off → STATIC (5)', async () => {
    mocks.state.chatActive = false;
    mocks.state.rows = [
      { kind: 'openai', role: 'chat', enabled: true },
      { kind: 'openai', role: 'embedding', enabled: true },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.serviceLevel).toBe(5);
    expect(body.chatActive).toBe(false);
  });

  it('aucun provider chat configuré → KEYWORD_ONLY (4)', async () => {
    mocks.state.rows = [{ kind: 'openai', role: 'embedding', enabled: true }];
    const res = await GET();
    const body = await res.json();
    expect(body.serviceLevel).toBe(4);
  });

  it('provider chat OK mais pas d\'embedding → RAG_OFF (3)', async () => {
    mocks.state.rows = [{ kind: 'openai', role: 'chat', enabled: true }];
    const res = await GET();
    const body = await res.json();
    expect(body.serviceLevel).toBe(3);
  });

  it('un provider chat down sur deux configurés → DEGRADED (2)', async () => {
    mocks.state.rows = [
      { kind: 'openai', role: 'chat', enabled: true },
      { kind: 'anthropic', role: 'chat', enabled: false },
      { kind: 'openai', role: 'embedding', enabled: true },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.serviceLevel).toBe(2);
    expect(body.providers.chat).toEqual({ openai: 'ok', anthropic: 'disabled' });
  });

  it('tout vert → NOMINAL (1)', async () => {
    mocks.state.rows = [
      { kind: 'openai', role: 'chat', enabled: true },
      { kind: 'anthropic', role: 'chat', enabled: true },
      { kind: 'openai', role: 'embedding', enabled: true },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.serviceLevel).toBe(1);
    expect(body.db).toBe('ok');
    expect(body.providers.chat).toEqual({ openai: 'ok', anthropic: 'ok' });
    expect(body.providers.embedding).toEqual({ openai: 'ok' });
  });

  it('échec DB pendant la lecture → STATIC (5) sans throw', async () => {
    mocks.state.dbThrows = true;
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.serviceLevel).toBe(5);
    expect(body.db).toBe('unavailable');
  });

  it('réponse no-store cache header', async () => {
    mocks.state.rows = [
      { kind: 'openai', role: 'chat', enabled: true },
      { kind: 'openai', role: 'embedding', enabled: true },
    ];
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
