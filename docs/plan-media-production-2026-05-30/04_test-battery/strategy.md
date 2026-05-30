# Test battery — Strategy (MP-TB) — READ FIRST

> Folder: `docs/plan-media-production-2026-05-30/04_test-battery/`. This is the
> **consolidated** test program for the whole media-production plan (voice-over
> `MP-VO-*`, compose `MP-CO-*`, subtitles `MP-SU-*`, architecture `MP-AR-*`). It
> does **not** invent tests — it aggregates the real test files and
> `describe > it` names already specified in each feature's
> `test-plan-vitest.md` / `test-plan-playwright.md` / `test-plan-msw.md`, and
> binds them into one matrix, one coverage map, one correction-and-verification
> loop, and one CI spec.
>
> Authority for facts: [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md)
> (§1 pipelines, §4 task-IDs, §6 quality bar) and the three feature folders.
> The user is explicit: **the test COUNT does not matter — ROBUSTNESS does.**
> Every layer below exists to *prove an invariant*, not to hit a number.

Sibling files:
[`robustness-principles.md`](./robustness-principles.md) ·
[`correction-loop.md`](./correction-loop.md) ·
[`correction-loop.puml`](./correction-loop.puml) ·
[`test-matrix.csv`](./test-matrix.csv) ·
[`coverage-map.csv`](./coverage-map.csv) ·
[`msw-harness-plan.md`](./msw-harness-plan.md) ·
[`ci-integration.yaml`](./ci-integration.yaml) ·
[`execution-plan.md`](./execution-plan.md) ·
[`flakiness-policy.md`](./flakiness-policy.md). The operational runbook lives in
the sibling `../05_runbook/` folder (referenced by the correction loop).

---

## 1. The test ↔ reality gap this program fixes

This whole plan closes **BUG-004**: pipeline A (LangGraph) *produces* voice-over,
music, subtitles, and a composed video, but the DTO `GenerationResult`
(`orchestrator.ts` L30–45) has **no fields** for them and `bridgeToContentStudio`
copies only `script/caption/hashtags/one-image` — so the artifacts die at the
A→B boundary (ground-truth §1). The operator never sees them.

The dangerous version of "green tests" is a suite that exercises the *old* DTO
and the *old* bridge and stays green while the artifacts are silently dropped.
The battery is therefore **invariant-first**: each test names the property it
protects, and the highest-value tests are the ones that would have **failed on
the buggy baseline** —

- `MP-AR-001` DTO carries `voiceover/music/subtitles/composedVideo/transcodedVideo`.
- `MP-AR-002` bridge maps every present artifact to a `MediaRole` via
  `upsertBundleAssets` (not the lossy `upsertPrimaryAsset`).
- `MP-AR-003` repository keeps one binding **per role** (per-role
  delete-then-insert), and `getDraftBundle` returns the full set.
- `MP-VO/CO/SU` per-draft services surface each artifact in pipeline B.

A second, equally important gap: **vitest does NOT typecheck**. Two
build-breakers shipped this week through green vitest runs (ground-truth §6).
So `tsc --noEmit` is a **first-class gate**, not an afterthought — see §6.

---

## 2. The pyramid — what each layer MUST prove

| Layer | Tooling | Scope | MUST prove (the invariant) |
|---|---|---|---|
| **Unit (pure)** | vitest, no MSW, no I/O | SRT lib, schemas, cost formulas, timecode math | Deterministic correctness: `parseTimecode(formatTimecode(ms))===ms`; `serializeSrt(parseSrt(x))===x`; `validateCues` rules V1–V11; zod `.strict()` rejects unknown keys. Property/round-trip where applicable. |
| **Unit (node core)** | vitest + ffmpeg/fs/TTS mocks + MSW guard | `synthesizeVoiceover`, `composeMediaBundle`, `generateSubtitlesForDraftCore` | Mock path makes **no fetch**; each provider/ffmpeg branch (success, 5xx, fallback, timeout, missing-source, codec-fallback) behaves; temp files are cleaned. |
| **Integration (service)** | vitest + DB-seam mocks + MSW | `generateVoiceoverForDraft`, `composeDraftVideo`, `generate/saveSubtitlesForDraft` | The mode matrix: `mock` → deterministic artifact + **zero network**; `live`+no-key → `invalid_state` 409 + **zero network**; `live`+key → exactly **one** provider call; `live`+5xx → `upstream_failed` 502 + **no fake asset**; persists the right `role`; regenerate upserts by role; non-video → 409. |
| **Integration (route)** | vitest, drive exported `POST`/`PUT` | each new `route.ts` | Mirrors `generate-visual` guards: `requireContentStudioEnabled` + `requireAdminApi`; reads `cs_generation_mode` cookie (garbage→mock); 200/400/401/409; error envelope `{ error: { code, message, details } }`. |
| **Contract** | vitest + JSON-Schema / OpenAPI lint | `data-contract.json`, `api-contract.yaml`, `compose-subtitles-contract.test.ts`, DTO/bridge | Payloads validate; producer/consumer agree (`meta.srt === serializeSrt(cues)`); the DTO/bridge map the channel→role correctly; backward-compat matrix holds. |
| **Component (a11y)** | vitest + RTL + jsdom + MSW route stubs | `AudioTrackPlayer`, `VoiceoverTrack`, `ComposePanel`, `TracksPanel`, `CueEditor`, `SubtitleStyleControls`, `SubtitleOverlayPreview`, `SubtitlesTrack`, `MediaStudio.*`, `PublishActionGroup.*` | State machine (empty→generating→ready→stale); `aria-*` semantics; keyboard operability; `role=alert` on 409; **guards empty draftId with no fetch**; flag-off DOM is byte-stable (non-regression). |
| **E2E** | Playwright, mock mode, staging :8012 | `voiceover.spec.ts`, `compose.spec.ts`, `subtitles.spec.ts`, existing `create-golden-path.spec.ts` | The operator-visible golden path works end-to-end in **mock** mode; publish runs **dry-run**; tracks hidden for non-video / flag-off; keyboard smoke. |

**Why heavy at the integration tier.** The bug lives at the A→B *seam* and in the
per-draft *services*, so that tier carries the most assertions and the most
failure-injection. E2E is intentionally thin (mock-mode golden paths + a11y
smoke) because the deep edge cases are cheaper and more deterministic at the
service/node tier.

---

## 3. Mock vs live discipline (the single most important rule)

Two orthogonal axes — never conflate them:

- **Generation mode** (`cs_generation_mode` cookie / `mode` arg): `mock` vs `live`.
  `mock` = deterministic artifact (silent WAV via ffmpeg `anullsrc`, byte-copy
  mp4, rule-based SRT) and **must contact no provider**. `live`+no-key throws
  `HttpError invalid_state` (409); `live`+key calls the provider **once**.
- **Test transport** (MSW): all provider HTTP is mocked at the network boundary
  with **MSW**, never `vi.stubGlobal('fetch')` (ground-truth §6). The ffmpeg
  binary is mocked the way the existing `compose.test.ts` does it.

The discipline that ties them together: every integration/node file runs
`server.listen({ onUnhandledRequest: 'error' })`. For `mock` and `live-no-key`
paths **no handler is registered**, so any stray request *throws and fails the
test* — that is the **no-network proof**. See [`msw-harness-plan.md`](./msw-harness-plan.md).

**Never enable live publishing.** `SOCIAL_PUBLISHING_MODE` stays `dry_run`
everywhere (ground-truth §2; MEMORY: social-publishing-dry-run-default).

---

## 4. The ffmpeg-binary boundary

Compose and voice-over touch the **local ffmpeg binary** (`fluent-ffmpeg` +
`ffmpeg-static`), not a network host. Tests mock that boundary exactly like the
existing `src/lib/ai-engine/nodes/compose.test.ts`:
`vi.mock('fluent-ffmpeg')`, `vi.mock('ffmpeg-static')`,
`vi.mock('node:fs/promises')`, `vi.mock('sharp')`. The mock's command object
returns `this` for the builder calls and drives `on('end'|'error', cb)` via a
per-test outcome switch (`end | error | hang`) plus a `kill: vi.fn()` to assert
SIGKILL on timeout and an `unlink: vi.fn()` to assert temp cleanup. MSW still
runs with `onUnhandledRequest:'error'` over compose **purely to prove compose
issues zero HTTP** — a fetch stub would mask a future cloud-transcoder
regression; MSW fails loudly. (Compose has **no provider endpoints** at all —
[`../02_compose/test-plan-msw.md`](../02_compose/test-plan-msw.md).)

---

## 5. Determinism under fake timers

Compose/voice-over file names embed `Date.now()`; the timeout path is a race.
Both are made deterministic with vitest fake timers:
`vi.useFakeTimers(); vi.setSystemTime(new Date('2026-05-30T10:00:00Z'))` pins
the output `url`/`assetId`; the ffmpeg mock's `setTimeout(cb, 0)` is flushed with
`await vi.advanceTimersByTimeAsync(0)`; the hang→timeout path is tripped with
`await vi.advanceTimersByTimeAsync(90_000)` and then asserts
`cmd.kill('SIGKILL')` + `fs.unlink`. `vi.useRealTimers()` in `afterEach`. This is
what makes the timeout/cleanup invariants testable without real waits and
without flakiness (see [`flakiness-policy.md`](./flakiness-policy.md)).

---

## 6. The `tsc --noEmit` gate (non-negotiable)

`pnpm -C apps/web exec tsc --noEmit` (`package.json` → `"typecheck": "tsc --noEmit"`)
is the **first** CI stage and a fail-fast gate before vitest. Rationale
(ground-truth §6): vitest does not typecheck, and two build-breakers shipped this
week through green test runs. The DTO/bridge changes are TS-strict and
`noUncheckedIndexedAccess`-safe by construction (all new `GenerationResult`
fields are optional; `MediaRole` is a literal union, never a bare `string`) —
that property is only *enforced* by the `tsc` gate. Tasks `MP-VO-11`,
`MP-CO-13`, `MP-SU-15` each list this gate; the battery promotes it to a global
stage in [`ci-integration.yaml`](./ci-integration.yaml).

---

## 7. MSW `onUnhandledRequest:'error'` discipline

Every integration/node test file uses the project's idempotent server wrapper
(`apps/web/src/test/msw/server.ts`, ARC-004: first `listen` wins) with:

```ts
import { server } from '@/test/msw/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest:'error'` is the crux of every no-network proof. The
new shared handlers are `src/test/msw/handlers/tts.ts` (`MP-VO-12`) and
`src/test/msw/handlers/subtitles-refine.ts` (`MP-SU-16`); compose registers
**none**. Full detail in [`msw-harness-plan.md`](./msw-harness-plan.md).

---

## 8. Non-regression guard — `generateVisualForDraft` + the 4-step flow

D6 is sacred: with `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=false` the existing
behavior is **byte-for-byte** identical. The battery proves this at three levels:

1. **Existing vitest stays green, unedited** — `MediaStudio.test.tsx`,
   `compose.test.ts` (8 cases), `generate-voiceover.test.ts` (7 cases),
   `generate-subtitles.test.ts` (6 cases). The node-extraction refactor is only
   valid if these pass **unchanged** (`git diff` empty for those files).
2. **New flag-off tests** — `MediaStudio.voiceover.test.tsx`,
   `MediaStudio.compose.test.tsx`, `MediaStudio.subtitles.test.tsx` each assert
   "flag off → no track/panel, DOM unchanged".
3. **Bridge/repository backward-compat** — `upsertPrimaryAsset` shim still writes
   one binding; the bridge with none of the new DTO fields produces the identical
   outcome to before (dto-bridge backward-compat matrix).
4. **E2E** — the existing `create-golden-path.spec.ts` must stay green; the new
   specs include "flag off → legacy MediaStudio byte-stable" scenarios.

Any change to those guarded files/tests is a **release blocker** (see
[`test-matrix.csv`](./test-matrix.csv) `blocking=yes` rows and
[`correction-loop.md`](./correction-loop.md) exit criteria).

---

## 9. Quality bar mapping (ground-truth §6)

| §6 requirement | Where proven |
|---|---|
| TS strict, `noUncheckedIndexedAccess`-safe | `tsc --noEmit` global gate (§6 here) |
| Provider HTTP via MSW, never fetch-stub | every integration file; [`msw-harness-plan.md`](./msw-harness-plan.md) |
| `onUnhandledRequest:'error'` proves no-network | mock & no-key rows in [`coverage-map.csv`](./coverage-map.csv) `security` column |
| vitest units/integration; Playwright E2E (mock, :8012) | the pyramid §2 |
| Additive + feature-flagged; existing flows untouched | non-regression §8 |
| No secrets; dry-run publishing only | `security` rows; E2E asserts dry-run banner |
