# F01 — Plan de tests vitest

Plan détaillé des tests vitest (unit + integration + component) à implémenter.

## Suite Unit — `useFeatureFlag.test.ts`

```typescript
// apps/web/src/lib/chat/feature-flag.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFeatureFlag, _resetCache } from './feature-flag';

vi.mock('@/lib/db/client', () => ({ db: mockDb }));

describe('useFeatureFlag', () => {
  beforeEach(() => _resetCache());

  it('returns true when env CHAT_ENABLED=true and DB toggle=true', async () => {
    process.env.CHAT_ENABLED = 'true';
    mockDb.select.mockResolvedValue([{ key: 'chat_enabled', value: { enabled: true } }]);

    expect(await useFeatureFlag('CHAT_ENABLED')).toBe(true);
  });

  it('returns false when env=false even if DB toggle=true', async () => {
    process.env.CHAT_ENABLED = 'false';
    mockDb.select.mockResolvedValue([{ key: 'chat_enabled', value: { enabled: true } }]);

    expect(await useFeatureFlag('CHAT_ENABLED')).toBe(false);
  });

  it('caches result for 30s', async () => {
    mockDb.select.mockResolvedValue([{ value: { enabled: true } }]);
    await useFeatureFlag('CHAT_ENABLED');
    await useFeatureFlag('CHAT_ENABLED'); // 2nd call
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('refetches after cache TTL expires', async () => {
    vi.useFakeTimers();
    mockDb.select.mockResolvedValue([{ value: { enabled: true } }]);
    await useFeatureFlag('CHAT_ENABLED');
    vi.advanceTimersByTime(31_000);
    await useFeatureFlag('CHAT_ENABLED');
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it('returns false (safe default) on DB error', async () => {
    mockDb.select.mockRejectedValue(new Error('DB down'));
    expect(await useFeatureFlag('CHAT_ENABLED')).toBe(false);
  });
});
```

## Suite Integration — `chat-session-route.integration.test.ts`

```typescript
// apps/web/src/app/api/chat/session/route.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDb, resetTestDb, teardownTestDb } from '@/test/db/test-db';
import { POST } from './route';
import { chatSession, chatRuntimeSetting } from '@/lib/db/schema';
import { server } from '@/test/msw/server';

beforeAll(async () => {
  await getTestDb();
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(async () => {
  await resetTestDb();
  // Seed chat_enabled=true
  const { db } = await getTestDb();
  await db.insert(chatRuntimeSetting).values({
    key: 'chat_enabled',
    value: { enabled: true },
  });
});
afterAll(async () => {
  await teardownTestDb();
  server.close();
});

describe('POST /api/chat/session — integration', () => {
  it('creates session row + returns sessionId/visitorId', async () => {
    const request = new Request('http://localhost/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageUrl: '/kit', language: 'fr-MA' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionId).toMatch(/^cs_/);
    expect(body.visitorId).toMatch(/^aid_/);
    expect(body.language).toBe('fr-MA');

    // Vérif DB
    const { db } = await getTestDb();
    const rows = await db.select().from(chatSession);
    expect(rows).toHaveLength(1);
    expect(rows[0].pageUrl).toBe('/kit');
  });

  it('reuses session when visitor_id cookie matches existing active session', async () => {
    const { db } = await getTestDb();
    const existing = chatSessionFactory.build({ visitorId: 'aid_known' });
    await db.insert(chatSession).values(existing);

    const request = new Request('http://localhost/api/chat/session', {
      method: 'POST',
      headers: { 'Cookie': `visitor_id=aid_known` },
      body: JSON.stringify({ pageUrl: '/kit' }),
    });

    const response = await POST(request);
    const body = await response.json();
    expect(body.sessionId).toBe(existing.id); // ⬅ même session

    const rows = await db.select().from(chatSession);
    expect(rows).toHaveLength(1); // pas de nouvelle insertion
  });

  it('returns 503 when chat_enabled=false', async () => {
    const { db } = await getTestDb();
    await db.update(chatRuntimeSetting)
      .set({ value: { enabled: false } })
      .where(eq(chatRuntimeSetting.key, 'chat_enabled'));

    const response = await POST(new Request('http://localhost/api/chat/session', {
      method: 'POST',
      body: JSON.stringify({ pageUrl: '/kit' }),
    }));

    expect(response.status).toBe(503);
  });

  it('validates input — pageUrl required', async () => {
    const response = await POST(new Request('http://localhost/api/chat/session', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'invalid_input',
    });
  });
});
```

## Suite Component — `ChatWidgetDeferred.test.tsx`

```typescript
// apps/web/src/components/chat/ChatWidgetDeferred.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatWidgetDeferred } from './ChatWidgetDeferred';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

expect.extend(toHaveNoViolations);

describe('<ChatWidgetDeferred />', () => {
  beforeEach(() => {
    // Default MSW handler: session create OK
    server.use(
      http.post('/api/chat/session', () => HttpResponse.json({
        sessionId: 'cs_test', visitorId: 'aid_test', language: 'fr-MA',
      })),
    );
  });

  it('renders stub initially, then mounts ChatWidget after idle', async () => {
    const { container } = render(<ChatWidgetDeferred pageContext={{ url: '/kit' }} />);

    // Initial stub
    expect(container.querySelector('[data-chat-stub]')).toBeInTheDocument();

    // Wait for ChatWidget to lazy-load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ouvrir le chat/i })).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('hides launcher when CHAT_ENABLED=false', async () => {
    vi.stubEnv('NEXT_PUBLIC_CHAT_ENABLED', 'false');
    render(<ChatWidgetDeferred pageContext={{ url: '/kit' }} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /ouvrir le chat/i })).not.toBeInTheDocument();
    });
  });

  it('retries POST /session on 500 (2 retries with exp backoff)', async () => {
    let calls = 0;
    server.use(
      http.post('/api/chat/session', () => {
        calls++;
        if (calls < 3) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({ sessionId: 'cs_ok', visitorId: 'aid_ok' });
      }),
    );

    render(<ChatWidgetDeferred pageContext={{ url: '/kit' }} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ouvrir le chat/i })).toBeInTheDocument();
    }, { timeout: 8000 });

    expect(calls).toBe(3);
  });

  it('has no axe violations', async () => {
    const { container } = render(<ChatWidgetDeferred pageContext={{ url: '/kit' }} />);
    await waitFor(() => screen.getByRole('button', { name: /ouvrir le chat/i }));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('launcher is positioned bottom-right by default (fr-MA)', async () => {
    render(<ChatWidgetDeferred pageContext={{ url: '/kit', language: 'fr-MA' }} />);
    const launcher = await screen.findByRole('button', { name: /ouvrir le chat/i });
    const styles = window.getComputedStyle(launcher);
    // Vérifier via classe ou style
    expect(launcher).toHaveClass(/right-0|right-4/);
  });

  it('launcher is positioned bottom-left for ar-MA (RTL)', async () => {
    render(<ChatWidgetDeferred pageContext={{ url: '/kit', language: 'ar-MA' }} />);
    const launcher = await screen.findByRole('button', { name: /افتح|ouvrir/i });
    expect(launcher).toHaveClass(/left-0|left-4/);
  });

  it('respects prefers-reduced-motion (no fade-in animation)', async () => {
    // Stub matchMedia
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });

    render(<ChatWidgetDeferred pageContext={{ url: '/kit' }} />);
    const launcher = await screen.findByRole('button', { name: /ouvrir le chat/i });
    expect(launcher.className).not.toMatch(/animate-fade-in/);
  });

  it('opens panel on launcher click', async () => {
    const user = userEvent.setup();
    render(<ChatWidgetDeferred pageContext={{ url: '/kit' }} />);
    const launcher = await screen.findByRole('button', { name: /ouvrir le chat/i });
    await user.click(launcher);

    expect(await screen.findByRole('region', { name: /assistant femiglow/i })).toBeVisible();
  });

  it('error boundary catches lazy load failure', async () => {
    // Force lazy import to throw
    vi.mock('./ChatWidget', () => {
      throw new Error('Bundle load failed');
    });

    const { container } = render(<ChatWidgetDeferred pageContext={{ url: '/kit' }} />);
    await waitFor(() => {
      expect(container.querySelector('[data-chat-error]')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ouvrir le chat/i })).not.toBeInTheDocument();
    });
  });
});
```

## Référence aux tests E2E

Voir [playwright-suite.spec.md](playwright-suite.spec.md) pour les 4 specs Playwright.
