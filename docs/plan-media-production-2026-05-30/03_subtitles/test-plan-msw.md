# Subtitles — MSW plan (provider HTTP + no-network proofs)

> Quality bar §6: all provider HTTP is mocked via **MSW** using the project's
> `@/test/msw/server` (idempotent `listen`/`close`, see
> `apps/web/src/test/msw/server.ts`). **Never** `vi.stubGlobal('fetch')`. The crux of
> this feature: the **default** subtitle path (`refine:false`, and **all** mock-mode
> generation/save) is **pure string building** and makes **zero** network calls,
> proven via `server.listen({ onUnhandledRequest: 'error' })`. Only the optional
> `refine:true` (live + key) path may contact a provider. Tasks MP-SU-16 / MP-SU-02 /
> MP-SU-03 / MP-SU-04.

## 1. Hosts the subtitle code can hit

| Path | Method | URL | When |
|---|---|---|---|
| default generation | — | (none) | `refine:false` / any `mock` — **no host** |
| save | — | (none) | `PUT subtitles` — **no host** (pure validate+serialize) |
| LLM refine | POST | `https://api.openai.com/v1/chat/completions` | `refine:true` && `live` && key |

The rule-based path uses `parseScriptToCues` + `serializeSrt` (pure) and contacts
**nothing**. SRT serialization and `validateCues` never touch the network.

## 2. Handlers — `apps/web/src/test/msw/handlers/subtitles-refine.ts` (MP-SU-16)

Only needed for the optional refine path; the default-path tests register **no**
handlers (so any stray request errors).

```ts
import { http, HttpResponse } from '@/test/msw/server';

export const subtitleRefineHandlers = {
  openaiOk: http.post('https://api.openai.com/v1/chat/completions', () =>
    HttpResponse.json({
      choices: [{ message: { content: JSON.stringify({ lines: ['Découvrez le secret', 'des ongles parfaits.'] }) } }],
    }),
  ),
  openai500: http.post('https://api.openai.com/v1/chat/completions', () =>
    HttpResponse.text('upstream boom', { status: 500 }),
  ),
  openai401: http.post('https://api.openai.com/v1/chat/completions', () =>
    HttpResponse.json({ error: 'invalid key' }, { status: 401 }),
  ),
};
```

## 3. Standard lifecycle (every subtitle integration file)

```ts
import { server } from '@/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));  // first listen wins (idempotent)
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is the crux: any unexpected HTTP throws and fails the
test. For the default / mock / save cases we register **no** handler, so a stray
request would error — proving silence.

## 4. Assertions per path

### default generation (mock OR live refine=false) — NO network
```ts
// generate-subtitles-for-draft.test.ts > mode=mock => rule-based SRT, no provider call
const seen: string[] = [];
server.events.on('request:start', ({ request }) => seen.push(request.url));
const res = await generateSubtitlesForDraft({ draftId, actorId: 'a', mode: 'mock' });
expect(res.provider).toBe('rule-based');
expect(res.costCents).toBe(0);
expect(seen).toEqual([]);                       // zero requests
expect(res.srt).toBe(serializeSrt(res.cues));   // SRT consistency
```

### save (PUT) — NO network
```ts
// save-subtitles-for-draft.test.ts > valid cues => canonical SRT persisted
const seen: string[] = [];
server.events.on('request:start', ({ request }) => seen.push(request.url));
await saveSubtitlesForDraft({ draftId, actorId: 'a', cues, style });
expect(seen).toEqual([]);                        // serialization + validation are pure
```

### live + refine + no key — NO network, 409
```ts
// resolveProviderCredential mocked -> undefined
await expect(generateSubtitlesForDraft({ draftId, actorId: 'a', refine: true, mode: 'live' }))
  .rejects.toMatchObject({ code: 'invalid_state', status: 409 });
expect(seen).toEqual([]);   // had it fetched, onUnhandledRequest:'error' would have thrown first
```

### live + refine + key — exactly ONE provider call, timecodes preserved
```ts
server.use(subtitleRefineHandlers.openaiOk);
let count = 0;
server.events.on('request:start', ({ request }) => {
  if (request.url.includes('api.openai.com')) count += 1;
});
const before = (await generateSubtitlesForDraft({ draftId, actorId: 'a', mode: 'mock' })).cues; // baseline timecodes
const res = await generateSubtitlesForDraft({ draftId, actorId: 'a', refine: true, mode: 'live' });
expect(count).toBe(1);
expect(res.cues.map(c => [c.startMs, c.endMs]))
  .toEqual(before.map(c => [c.startMs, c.endMs]));   // refine tidies TEXT only, never timecodes
```

### live + refine + key + provider 5xx — upstream_failed (502)
```ts
server.use(subtitleRefineHandlers.openai500);
await expect(generateSubtitlesForDraft({ draftId, actorId: 'a', refine: true, mode: 'live' }))
  .rejects.toMatchObject({ code: 'upstream_failed' });
```

### mock + refine=true — refine ignored, NO network
```ts
// mock NEVER calls a provider even if refine=true
const res = await generateSubtitlesForDraft({ draftId, actorId: 'a', refine: true, mode: 'mock' });
expect(res.provider).toBe('rule-based');
expect(seen).toEqual([]);
```

## 5. Route-level no-network proof (MP-SU-04)

`generate-subtitles.route.test.ts > 409 invalid_state when cookie=live, refine=true,
no key (no provider call)` mounts the server with `onUnhandledRequest:'error'`, mocks
the cookie to `live`, body `{ refine: true }`, and `resolveProviderCredential →
undefined`, drives `POST`, and asserts status `409` + zero captured requests. The
default-body route test (`refine` omitted) asserts `200` with zero captured requests.

## 6. Why MSW (not fetch stub)

- The rule-based path uses no fetch — a `fetch` stub would hide a regression if someone
  later added a network call to the default path. MSW's `onUnhandledRequest:'error'`
  **fails loudly** instead. This is the single most important guarantee of the feature:
  subtitles are network-free by default.
- Matches the repo's 35+ existing MSW files and the idempotent `server` wrapper.
