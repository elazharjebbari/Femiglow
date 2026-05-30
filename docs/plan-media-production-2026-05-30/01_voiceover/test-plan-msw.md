# Voice-over — MSW plan (provider HTTP + no-network proofs)

> Quality bar §6: all provider HTTP is mocked via **MSW** using the project's
> `@/test/msw/server` (idempotent `listen`/`close`, see
> `apps/web/src/test/msw/server.ts`). **Never** `vi.stubGlobal('fetch')`. The
> `mock` and `live-no-key` paths are proven to make **zero** network calls via
> `server.listen({ onUnhandledRequest: 'error' })`. Tasks MP-VO-12 / MP-VO-02 /
> MP-VO-03.

## 1. Provider endpoints the node core can hit (from generate-voiceover.ts)

| Provider | Method | URL |
|---|---|---|
| OpenAI TTS | POST | `https://api.openai.com/v1/audio/speech` |
| ElevenLabs | POST | `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` (default `EXAVITQu4vr4xnSDxMaL`) |

These are the **only** hosts the voice-over code may contact. The `mock` path uses
ffmpeg `anullsrc` and contacts **nothing**.

## 2. Handlers — `apps/web/src/test/msw/handlers/tts.ts` (MP-VO-12)

```ts
import { http, HttpResponse } from '@/test/msw/server';

const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // 'RIFF' stub bytes

export const ttsHandlers = {
  openaiOk: http.post('https://api.openai.com/v1/audio/speech', () =>
    HttpResponse.arrayBuffer(WAV.buffer, { headers: { 'content-type': 'audio/mpeg' } }),
  ),
  openai500: http.post('https://api.openai.com/v1/audio/speech', () =>
    HttpResponse.text('upstream boom', { status: 500 }),
  ),
  openai401: http.post('https://api.openai.com/v1/audio/speech', () =>
    HttpResponse.json({ error: 'invalid key' }, { status: 401 }),
  ),
  elevenOk: http.post('https://api.elevenlabs.io/v1/text-to-speech/:voiceId', () =>
    HttpResponse.arrayBuffer(WAV.buffer, { headers: { 'content-type': 'audio/mpeg' } }),
  ),
  eleven500: http.post('https://api.elevenlabs.io/v1/text-to-speech/:voiceId', () =>
    HttpResponse.text('boom', { status: 500 }),
  ),
};
```

## 3. Standard lifecycle (every voice-over integration file)

```ts
import { server } from '@/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));  // first listen wins (idempotent)
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is the crux: any unexpected HTTP throws and fails the
test. For the mock / no-key cases we register **no** handler, so a stray request
would error — proving silence.

## 4. Assertions per path

### mock mode (service + route) — NO network
```ts
// generate-voiceover-for-draft.test.ts > mode=mock → silent track, no provider call
// (no ttsHandlers registered)
const seen: string[] = [];
server.events.on('request:start', ({ request }) => seen.push(request.url));
const res = await generateVoiceoverForDraft({ draftId, actorId: 'a', mode: 'mock' });
expect(res.provider).toBe('mock');
expect(res.costCents).toBe(0);
expect(seen.filter((u) => u.includes('openai.com') || u.includes('elevenlabs.io'))).toEqual([]);
```

### live + no key — NO network, 409
```ts
// resolveProviderCredential mocked -> undefined
await expect(generateVoiceoverForDraft({ draftId, actorId: 'a', mode: 'live' }))
  .rejects.toMatchObject({ code: 'invalid_state', status: 409 });
// no handler registered => had it fetched, onUnhandledRequest:'error' would have thrown first
expect(seen).toEqual([]);   // zero requests
```

### live + key — exactly ONE provider call
```ts
// resolveProviderCredential -> 'sk-test'; engine tts.default = 'openai'
server.use(ttsHandlers.openaiOk);
let count = 0;
server.events.on('request:start', ({ request }) => {
  if (request.url.includes('api.openai.com')) count += 1;
});
const res = await generateVoiceoverForDraft({ draftId, actorId: 'a', mode: 'live' });
expect(count).toBe(1);
expect(res.provider).toBe('openai:tts-1');
```

### live + key + provider 5xx — upstream_failed (502)
```ts
server.use(ttsHandlers.openai500);
await expect(generateVoiceoverForDraft({ draftId, actorId: 'a', mode: 'live' }))
  .rejects.toMatchObject({ code: 'upstream_failed' });
```

### node core silent fallback (graph behavior) — 5xx but no throw
```ts
// synthesize-voiceover.test.ts > openai 5xx + onProviderError=silent_fallback => degraded silent track
server.use(ttsHandlers.openai500);
const out = await synthesizeVoiceover({ text: 'x', jobId: 'j', provider: 'openai', apiKey: 'sk', onProviderError: 'silent_fallback' });
expect(out.degraded).toBe(true);
expect(out.voiceover.provider).toBe('fallback');
```

## 5. Route-level no-network proof (MP-VO-03)

`generate-voiceover.route.test.ts > 409 invalid_state when cookie=live and no key
(no provider call)` mounts the server with `onUnhandledRequest:'error'`, mocks the
cookie to `live` and `resolveProviderCredential → undefined`, drives `POST`, and
asserts status `409` + zero captured requests.

## 6. Why MSW (not fetch stub)

- ffmpeg `anullsrc` (mock) uses no fetch — a `fetch` stub would hide a regression
  if someone later added a network call to the mock path. MSW's
  `onUnhandledRequest:'error'` **fails loudly** instead.
- Matches the repo's 35+ existing MSW files and the idempotent `server` wrapper.
