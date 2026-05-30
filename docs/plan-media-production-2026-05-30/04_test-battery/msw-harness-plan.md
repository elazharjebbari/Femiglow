# MSW harness plan (MP-TB) — consolidated

> The single, consolidated view of the MSW handler set for the whole media
> program, plus the no-network proof discipline. It unifies the three feature MSW
> plans:
> [`../01_voiceover/test-plan-msw.md`](../01_voiceover/test-plan-msw.md) ·
> [`../02_compose/test-plan-msw.md`](../02_compose/test-plan-msw.md) ·
> [`../03_subtitles/test-plan-msw.md`](../03_subtitles/test-plan-msw.md).
>
> Rule (ground-truth §6): all provider HTTP via **MSW** through
> `apps/web/src/test/msw/server.ts` (idempotent `listen`/`close`, ARC-004 — first
> `listen` wins). **Never** `vi.stubGlobal('fetch')`. Every integration/node file
> runs `server.listen({ onUnhandledRequest: 'error' })`.

---

## 1. The complete provider-endpoint inventory

| Feature | New handler file | Provider | Method | URL | Reached only when |
|---|---|---|---|---|---|
| Voice-over | `apps/web/src/test/msw/handlers/tts.ts` | OpenAI TTS | POST | `https://api.openai.com/v1/audio/speech` | `live` + key + engine tts.default=openai |
| Voice-over | (same) | ElevenLabs | POST | `https://api.elevenlabs.io/v1/text-to-speech/:voiceId` | `live` + key + tts.default=elevenlabs |
| Subtitles | `apps/web/src/test/msw/handlers/subtitles-refine.ts` | OpenAI Chat | POST | `https://api.openai.com/v1/chat/completions` | `refine:true` + `live` + key |
| Compose | **none** | — | — | **no host at all** | never (ffmpeg-local only) |

That is the **entire** network surface of the program. Any request outside this
table from a media-production test is a regression.

## 2. Handler sets (verbatim from the feature plans)

### `tts.ts` (MP-VO-12 → TB-VO-051)

`ttsHandlers = { openaiOk, openai500, openai401, elevenOk, eleven500 }` —
`openaiOk`/`elevenOk` return `HttpResponse.arrayBuffer(WAV.buffer, { headers: {
'content-type': 'audio/mpeg' } })` with `WAV = Uint8Array([0x52,0x49,0x46,0x46])`
('RIFF' stub); `*500` return `HttpResponse.text(..., { status: 500 })`;
`openai401` returns `HttpResponse.json({ error }, { status: 401 })`. Imported from
`@/test/msw/server` (`http`, `HttpResponse` re-exported there).

### `subtitles-refine.ts` (MP-SU-16 → TB-SU-113)

`subtitleRefineHandlers = { openaiOk, openai500, openai401 }` — `openaiOk`
returns a chat-completions JSON whose `choices[0].message.content` is
`JSON.stringify({ lines: [...] })`; `*500`/`*401` mirror the TTS error handlers.

### Compose — no handlers

Compose registers **zero** handlers; MSW runs purely as a tripwire (§4).

## 3. Standard lifecycle (every integration/node file)

```ts
import { server } from '@/test/msw/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));  // first listen wins
afterEach(() => server.resetHandlers());                          // no handler bleed across cases
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is the crux: an unexpected request **throws** and
fails the test. `resetHandlers()` after each case guarantees handler isolation
(P4 concurrency).

## 4. How mock / no-key prove zero network

For `mock` and `live-no-key` the test registers **no** handler and asserts a
`request:start` spy is empty — a belt-and-suspenders proof on top of
`onUnhandledRequest:'error'`:

```ts
const seen: string[] = [];
server.events.on('request:start', ({ request }) => seen.push(request.url));
const res = await generateVoiceoverForDraft({ draftId, actorId: 'a', mode: 'mock' });
expect(res.provider).toBe('mock');
expect(res.costCents).toBe(0);
expect(seen.filter((u) => u.includes('openai.com') || u.includes('elevenlabs.io'))).toEqual([]);
```

No-key (409 before any I/O):
```ts
// resolveProviderCredential mocked -> undefined
await expect(generateVoiceoverForDraft({ draftId, actorId: 'a', mode: 'live' }))
  .rejects.toMatchObject({ code: 'invalid_state', status: 409 });
expect(seen).toEqual([]);   // had it fetched, onUnhandledRequest:'error' would have thrown first
```

These map to matrix rows **TB-VO-052**, **TB-VO-014/016/028**,
**TB-SU-031/047/051/053/066/070/114** and the compose §6 rows.

Exactly-one-call (live+key): a counter spy asserts `count === 1`
(`TB-VO-017/059`, `TB-SU-033`) — guards against double-calling and retry storms.

## 5. Compose asserts no network (ffmpeg is local, not a host)

Compose's only boundary is the ffmpeg binary, mocked like the existing
`compose.test.ts` (strategy §4): `vi.mock('fluent-ffmpeg')` with a per-test
outcome switch (`end | error | hang`), `kill: vi.fn()` (SIGKILL on timeout),
`vi.mock('node:fs/promises')` with `unlink: vi.fn()` (temp cleanup) and a
`readFile` null-variant (missing source), `vi.mock('ffmpeg-static')`,
`vi.mock('sharp')`. Over the whole compose suite MSW runs with no handlers, and
**every** path asserts `seen === []` (`TB-CO-001`, `TB-CO-020`, `TB-CO-062`).
A `fetch` stub would mask a future cloud-transcoder regression — MSW fails loudly
instead.

## 6. Route-level no-network proofs

Each generate route's no-key/refine-no-key case mounts the server with
`onUnhandledRequest:'error'`, mocks the cookie to `live` and
`resolveProviderCredential → undefined`, drives the exported `POST`, and asserts
`409` + zero captured requests (`TB-VO-028`, `TB-SU-070`). The compose route's
no-primary-video case asserts `409` + zero requests (`TB-CO-039`). The default
subtitles route body (`refine` omitted) asserts `200` with zero captured requests.

## 7. Coexistence with the existing suite

The new handler files compose cleanly with the repo's ~35 existing MSW files
because the shared `server` wrapper makes `listen`/`close` idempotent (ARC-004).
The new suites never call the raw `setupServer`; they always import the wrapped
`server`. Handlers are added per-case with `server.use(...)` and torn down by the
standard `afterEach(resetHandlers)`.
