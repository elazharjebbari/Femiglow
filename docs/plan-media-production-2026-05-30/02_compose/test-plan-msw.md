# Compose (montage vidéo) — MSW plan (ffmpeg-binary boundary + no-network proof)

> Quality bar §6: all provider HTTP is mocked via **MSW** using the project's
> `@/test/msw/server` (idempotent `listen`/`close`, see
> `apps/web/src/test/msw/server.ts`). **Never** `vi.stubGlobal('fetch')`.
>
> **Compose is special: it has NO external HTTP.** Its only I/O boundary is the
> **local ffmpeg binary** (`fluent-ffmpeg` + `ffmpeg-static`) and the filesystem.
> So this MSW plan (a) registers **no** handlers and runs MSW with
> `onUnhandledRequest:'error'` purely to **prove** every compose path makes
> **zero** network calls, and (b) documents the **ffmpeg-binary mock** that stands
> in for the real encoder. Tasks MP-CO-14 / MP-CO-02 / MP-CO-03 / MP-CO-01.

## 1. There are no provider endpoints

| Provider | Method | URL |
|---|---|---|
| — (none) | — | Compose contacts **no host**. |

The byte-copy (mock) and the ffmpeg mux (live) both run entirely against the local
ffmpeg binary + the media filesystem. Any HTTP request originating from a compose
test is a **regression** and must fail the test.

## 2. The ffmpeg-binary boundary mock — `compose.test.ts` shape (reused)

Compose's testable seam is the ffmpeg call, not a network call. Mock it exactly as
the existing `src/lib/ai-engine/nodes/compose.test.ts` does, extended with
error/kill hooks:

```ts
vi.mock('ffmpeg-static', () => ({ default: '/usr/bin/ffmpeg' }));

vi.mock('fluent-ffmpeg', () => {
  // a per-test switch lets a case force the 'error' event instead of 'end'
  let nextOutcome: 'end' | 'error' | 'hang' = 'end';
  const setOutcome = (o: typeof nextOutcome) => { nextOutcome = o; };
  const cmd = {
    input: vi.fn().mockReturnThis(),
    complexFilter: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    videoCodec: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    size: vi.fn().mockReturnThis(),
    save: vi.fn().mockReturnThis(),
    kill: vi.fn(),                         // assert SIGKILL on timeout (E-CO-8)
    on: vi.fn(function (this: Record<string, unknown>, event: string, cb: (e?: unknown) => void) {
      if (nextOutcome === 'end' && event === 'end') setTimeout(() => cb(), 0);
      if (nextOutcome === 'error' && event === 'error') setTimeout(() => cb(new Error('ffmpeg boom')), 0);
      // 'hang' registers neither → the core's withTimeout fires (driven by fake timers)
      return this;
    }),
  };
  const ffmpeg = vi.fn(() => cmd);
  (ffmpeg as Record<string, unknown>).setFfmpegPath = vi.fn();
  (ffmpeg as Record<string, unknown>).__setOutcome = setOutcome;
  return { default: ffmpeg };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mp4 bytes')),  // null variant → source missing
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    unlink: vi.fn().mockResolvedValue(undefined),                   // assert temp cleanup (E-CO-10)
  };
});
```

## 3. Standard MSW lifecycle (every compose integration file) — purely a guard

```ts
import { server } from '@/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));  // first listen wins (idempotent)
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

No handlers are registered. `onUnhandledRequest: 'error'` is the crux: should any
compose code ever issue an HTTP request, MSW throws and fails the test — proving
silence.

## 4. Assertions per path

### mock mode (service + route) — NO network, byte-copy
```ts
// compose-draft-video.test.ts > mode=mock → byte-copy composed video, no provider call
const seen: string[] = [];
server.events.on('request:start', ({ request }) => seen.push(request.url));
const res = await composeDraftVideo({ draftId, actorId: 'a', mode: 'mock' });
expect(res.provider).toBe('compose:mock');
expect(res.costCents).toBe(0);
expect(seen).toEqual([]);                          // zero HTTP — compose has no providers
// and: the ffmpeg mux was NOT used in mock — only a byte-copy
expect((ffmpeg as any).mock.results[0]?.value.save).not.toHaveBeenCalled?.();
```

### live mux — still NO network (ffmpeg is local)
```ts
// compose-media-bundle.test.ts > live + voiceover + music => amix inputs=2, no fetch
const seen: string[] = [];
server.events.on('request:start', ({ request }) => seen.push(request.url));
const out = await composeMediaBundle({ jobId, primaryVideo, voiceover, music, mode: 'live' });
expect(out.tracks).toEqual({ hasVoiceover: true, hasMusic: true, hasSubtitles: false });
expect(seen).toEqual([]);                          // ffmpeg is a binary, not a host
```

### no primary video — NO network, 409
```ts
// getDraftBundle returns a bundle WITHOUT primary_video
await expect(composeDraftVideo({ draftId, actorId: 'a', mode: 'mock' }))
  .rejects.toMatchObject({ code: 'invalid_state', status: 409 });
expect(seen).toEqual([]);                          // rejected before any ffmpeg/IO
```

### ffmpeg error (live) — upstream_failed (502), temp cleaned, NO network
```ts
(ffmpeg as any).__setOutcome('error');
await expect(composeDraftVideo({ draftId, actorId: 'a', mode: 'live' }))
  .rejects.toMatchObject({ code: 'upstream_failed' });
expect(fs.unlink).toHaveBeenCalled();              // partial output cleaned
expect(seen).toEqual([]);
```

### timeout (live) — kills ffmpeg, upstream_failed, NO network
```ts
vi.useFakeTimers();
(ffmpeg as any).__setOutcome('hang');
const p = composeDraftVideo({ draftId, actorId: 'a', mode: 'live' });
await vi.advanceTimersByTimeAsync(90_000);         // trip the core's withTimeout
await expect(p).rejects.toMatchObject({ code: 'upstream_failed' });
const cmd = (ffmpeg as any).mock.results.at(-1)?.value;
expect(cmd.kill).toHaveBeenCalledWith('SIGKILL');
expect(fs.unlink).toHaveBeenCalled();
expect(seen).toEqual([]);
vi.useRealTimers();
```

### missing source (live) — upstream_failed, no writeFile, NO network
```ts
(fs.readFile as any).mockResolvedValueOnce(null);  // or mockRejectedValueOnce
await expect(composeDraftVideo({ draftId, actorId: 'a', mode: 'live' }))
  .rejects.toMatchObject({ code: 'upstream_failed' });
expect(fs.writeFile).not.toHaveBeenCalled();
expect(seen).toEqual([]);
```

## 5. Route-level no-network proof (MP-CO-03)

`compose.route.test.ts > 409 invalid_state when no primary video` mounts the
server with `onUnhandledRequest:'error'`, mocks the cookie + `composeDraftVideo`
to throw `invalid_state`, drives `POST`, and asserts status `409` + zero captured
requests.

## 6. Why MSW (not fetch stub) even though compose has no HTTP

- A `fetch` stub would **mask** a future regression that adds a network call to a
  compose path (e.g. a cloud transcoder). MSW's `onUnhandledRequest:'error'`
  **fails loudly** the moment any request appears, locking in the "compose makes no
  network call" invariant.
- Matches the repo's 35+ existing MSW files and the idempotent `server` wrapper, so
  the compose suite composes cleanly with sibling suites (`tts.ts`, etc.) that DO
  use handlers.
