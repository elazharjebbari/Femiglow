# F08 — Plan tests combiné (vitest + Playwright + MSW)

## A. Tests vitest — Unit `sse-reader.ts`

```typescript
// apps/web/src/components/chat/sse-reader.test.ts
import { describe, it, expect } from 'vitest';
import { parseSseStream } from './sse-reader';

function makeStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe('parseSseStream', () => {
  it('parses well-formed event', async () => {
    const stream = makeStream(`event: chunk\ndata: {"text":"Bonjour"}\n\n`);
    const events: any[] = [];
    for await (const e of parseSseStream(stream)) events.push(e);
    expect(events).toEqual([{ event: 'chunk', data: { text: 'Bonjour' } }]);
  });

  it('handles multiple events in one chunk', async () => {
    const stream = makeStream(
      `event: chunk\ndata: {"text":"A"}\n\nevent: chunk\ndata: {"text":"B"}\n\nevent: end\ndata: {}\n\n`
    );
    const events = [];
    for await (const e of parseSseStream(stream)) events.push(e);
    expect(events).toHaveLength(3);
    expect(events[2].event).toBe('end');
  });

  it('skips empty heartbeat lines', async () => {
    const stream = makeStream(`:\n\nevent: chunk\ndata: {"text":"A"}\n\n`);
    const events = [];
    for await (const e of parseSseStream(stream)) events.push(e);
    expect(events).toHaveLength(1);
  });

  it('handles malformed JSON gracefully', async () => {
    const stream = makeStream(`event: chunk\ndata: not-json{{\n\n`);
    const events: any[] = [];
    const warns: string[] = [];
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation((m) => warns.push(m));
    for await (const e of parseSseStream(stream)) events.push(e);
    expect(events).toHaveLength(0);
    expect(warns.length).toBeGreaterThan(0);
    consoleWarn.mockRestore();
  });

  it('respects abort signal', async () => {
    const stream = makeStream(
      `event: chunk\ndata: {"text":"A"}\n\nevent: chunk\ndata: {"text":"B"}\n\n`
    );
    const controller = new AbortController();
    const events: any[] = [];

    setTimeout(() => controller.abort(), 10);

    try {
      for await (const e of parseSseStream(stream, { signal: controller.signal })) {
        events.push(e);
        await new Promise((r) => setTimeout(r, 20)); // simulate slow
      }
    } catch (e: any) {
      expect(e.name).toBe('AbortError');
    }
    expect(events.length).toBeLessThan(2);
  });

  it('parses 1000 chunks in <50ms', async () => {
    const lines = Array.from({ length: 1000 }, (_, i) =>
      `event: chunk\ndata: {"text":"chunk${i}"}\n\n`,
    ).join('');
    const stream = makeStream(lines);
    const start = performance.now();
    let count = 0;
    for await (const _ of parseSseStream(stream)) count++;
    const elapsed = performance.now() - start;
    expect(count).toBe(1000);
    expect(elapsed).toBeLessThan(50);
  });
});
```

## B. Tests vitest — Component `use-chat-send.test.tsx`

```typescript
// apps/web/src/components/chat/hooks/use-chat-send.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import { useChatSend } from './use-chat-send';
import { makeSseStream } from '@/test/msw/helpers/make-sse-stream';

describe('useChatSend', () => {
  beforeEach(() => {
    // Simule humanize désactivé en test
    vi.stubEnv('NEXT_PUBLIC_TEST_MODE', 'true');
  });

  it('opens SSE stream on send + appends chunks', async () => {
    server.use(
      http.post('/api/chat/message', () => new HttpResponse(makeSseStream([
        { event: 'start', data: { messageId: 'm1', latency: 100 } },
        { event: 'chunk', data: { text: 'Bonjour ' } },
        { event: 'chunk', data: { text: 'visiteur' } },
        { event: 'end', data: { messageId: 'm1', usage: { tokensIn: 5, tokensOut: 3, cost: 0.01 } } },
      ]), {
        headers: { 'Content-Type': 'text/event-stream' },
      })),
    );

    const { result } = renderHook(() => useChatSend({ sessionId: 'cs_test' }));

    await act(async () => {
      await result.current.send('Salut');
    });

    await waitFor(() => {
      expect(result.current.lastMessage?.content).toBe('Bonjour visiteur');
      expect(result.current.isSending).toBe(false);
    });
  });

  it('handles error event with toast', async () => {
    server.use(
      http.post('/api/chat/message', () => new HttpResponse(makeSseStream([
        { event: 'start', data: { messageId: 'm1' } },
        { event: 'error', data: { code: 'provider_failed', message: 'OpenAI 503' } },
      ]), {
        headers: { 'Content-Type': 'text/event-stream' },
      })),
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useChatSend({ sessionId: 'cs_test', onError }));

    await act(async () => {
      await result.current.send('Hi');
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'provider_failed' }),
      );
      expect(result.current.isSending).toBe(false);
    });
  });

  it('aborts in-flight stream on new send', async () => {
    let firstAbortReceived = false;
    server.use(
      http.post('/api/chat/message', async ({ request }) => {
        request.signal.addEventListener('abort', () => { firstAbortReceived = true; });
        // Slow stream
        await new Promise((r) => setTimeout(r, 5000));
        return new HttpResponse(null);
      }),
    );

    const { result } = renderHook(() => useChatSend({ sessionId: 'cs_test' }));

    act(() => { result.current.send('A'); }); // first call
    await new Promise((r) => setTimeout(r, 100));

    server.use(
      http.post('/api/chat/message', () => new HttpResponse(makeSseStream([
        { event: 'start', data: { messageId: 'm2' } },
        { event: 'chunk', data: { text: 'OK' } },
        { event: 'end', data: { messageId: 'm2' } },
      ]), {
        headers: { 'Content-Type': 'text/event-stream' },
      })),
    );

    await act(async () => {
      await result.current.send('B'); // second call → abort first
    });

    await waitFor(() => {
      expect(firstAbortReceived).toBe(true);
      expect(result.current.lastMessage?.content).toBe('OK');
    });
  });

  it('handles non-SSE response (500 HTML)', async () => {
    server.use(
      http.post('/api/chat/message', () => new HttpResponse('<html>500</html>', {
        status: 500, headers: { 'Content-Type': 'text/html' },
      })),
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useChatSend({ sessionId: 'cs_test', onError }));

    await act(async () => {
      await result.current.send('Hi');
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      expect(result.current.isSending).toBe(false);
    });
  });
});
```

## C. Tests vitest — Integration orchestrator-stream

```typescript
// apps/web/src/lib/chat/services/orchestrator-stream.integration.test.ts
describe('Orchestrator SSE stream contract', () => {
  it('emits start → chunk* → end in nominal flow', async () => {
    const events: any[] = [];
    const stream = orchestrator.handle({
      sessionId: 'cs_test',
      content: 'Bonjour',
    });
    for await (const e of stream) events.push(e);

    expect(events[0].event).toBe('start');
    expect(events.filter((e) => e.event === 'chunk').length).toBeGreaterThan(0);
    expect(events[events.length - 1].event).toBe('end');
  });

  it('emits ONLY events declared in ChatStreamEvent Zod schema (regression for C5)', async () => {
    const events: any[] = [];
    server.use(
      http.post('https://api.openai.com/v1/moderations',
        () => HttpResponse.json({ results: [{ flagged: true }] })),
    );

    const stream = orchestrator.handle({ sessionId: 'cs_test', content: 'bad content' });
    for await (const e of stream) events.push(e);

    const allowedEvents = ['start', 'chunk', 'source', 'end', 'error', 'lead-form-offer'];
    for (const e of events) {
      expect(allowedEvents).toContain(e.event); // ⬅ message_complete proscrit
    }
  });

  it('aborts upstream provider when client disconnects (regression for R5)', async () => {
    let openaiAborted = false;
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', ({ request }) => {
        request.signal.addEventListener('abort', () => { openaiAborted = true; });
        return new HttpResponse(makeSseStream([/* slow */]), {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    const controller = new AbortController();
    const stream = orchestrator.handle({
      sessionId: 'cs_test', content: 'Salut', signal: controller.signal,
    });

    const reader = (async () => {
      const events = [];
      for await (const e of stream) {
        events.push(e);
        if (events.length === 1) controller.abort(); // abort after first event
      }
      return events;
    })();

    await reader;
    await new Promise((r) => setTimeout(r, 100));
    expect(openaiAborted).toBe(true);
  });
});
```

## D. Tests Playwright — E2E

```typescript
// apps/web/e2e/visitor/chat-streaming.spec.ts
import { test, expect } from '@playwright/test';
import { ChatWidgetPOM } from '../pom/chat-widget.pom';

test.describe('F08 — SSE streaming', () => {
  test('@smoke @critical visitor sees streaming chunks', async ({ page }) => {
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();
    await widget.sendMessage('Combien coûte le kit ?');

    // Wait for first chunk visible
    await expect(widget.lastAssistantMessage()).toBeVisible({ timeout: 5000 });

    // Wait for full reply
    await widget.waitForAssistantReply();
    const text = await widget.lastAssistantMessage().textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(20);
  });

  test('@critical visitor cancels mid-stream', async ({ page }) => {
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    // Set up intercept BEFORE send
    let cancelled = false;
    await page.route('/api/chat/message', async (route) => {
      route.request().signal().addEventListener('abort', () => { cancelled = true; });
      // Slow stream
      await new Promise((r) => setTimeout(r, 100));
      route.continue();
    });

    await widget.sendMessage('Question longue à répondre');
    await page.getByRole('button', { name: /annuler/i }).click();

    await page.waitForTimeout(200);
    expect(cancelled).toBe(true);
  });
});
```

## E. MSW handlers spécifiques

Voir [msw-handlers.md](msw-handlers.md).

## Récapitulatif

- ~6 tests unit `sse-reader`
- ~5 tests integration orchestrator
- ~9 tests component `useChatSend`
- ~3 tests E2E
- 5 MSW variants
- **Total ~28 cas couverts** (P0 critique inclus)
