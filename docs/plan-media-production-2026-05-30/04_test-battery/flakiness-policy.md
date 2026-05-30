# Flakiness policy (MP-TB)

> How the battery stays deterministic, what retry/quarantine rules apply, and the
> one sanctioned pre-existing exception. Robustness depends on a green run
> *meaning* something — a flaky suite is a silent regression detector that has
> been switched off. Tie-ins: [`strategy.md`](./strategy.md) §5 (determinism),
> [`correction-loop.md`](./correction-loop.md) (T6 triage),
> [`msw-harness-plan.md`](./msw-harness-plan.md) (handler isolation).

---

## 1. Determinism by construction (prevent flake, don't paper over it)

| Source of non-determinism | Control | Where |
|---|---|---|
| `Date.now()` in output file names | `vi.useFakeTimers(); vi.setSystemTime('2026-05-30T10:00:00Z')`; assert pinned `url`/`assetId` | TB-CO-002, compose/voiceover cores |
| ffmpeg timeout **race** | drive with `vi.advanceTimersByTimeAsync(90_000)`; never wall-clock sleep; assert `kill('SIGKILL')` | TB-CO-009, TB-CO-030 |
| ffmpeg mock `setTimeout(cb,0)` callbacks | flush with `await vi.advanceTimersByTimeAsync(0)` / `runAllTimersAsync` | all compose core rows |
| timezone-sensitive timecodes | `TZ=UTC` in the vitest stage env | `formatTimecode` rows TB-SU-001..002 |
| MSW handler bleed across cases | `afterEach(() => server.resetHandlers())` | every integration file |
| double `server.listen` across files | idempotent wrapper (ARC-004, first listen wins) | `@/test/msw/server` |
| network timing / real fetch | **MSW only**, never `vi.stubGlobal('fetch')`; `onUnhandledRequest:'error'` | ground-truth §6 |
| async media element APIs in jsdom | stub `HTMLMediaElement.prototype.play/pause` | AudioTrackPlayer / VideoPlayer rows |
| React state settling | RTL `findBy*` / `waitFor`, never fixed `setTimeout` | all component rows |

`afterEach(() => vi.useRealTimers())` in every file that opts into fake timers, so
timers never leak into a sibling file.

## 2. Retry policy

- **Vitest (unit/integration): zero retries.** A vitest test that needs a retry is
  a determinism bug (class T6) and must be fixed at the source (§1), not masked.
  `vitest run` runs with no `--retry`.
- **Playwright (E2E): at most 1 retry, trace on first retry.** E2E crosses a real
  HTTP/process boundary (staging :8012); one retry absorbs genuinely transient
  infra hiccups (cold route, port bind) while the trace captures the cause. A spec
  that only passes on retry is **investigated**, not accepted as healthy — if the
  flake is in our code it becomes a T6 fix; if it is environmental it is logged
  against the runbook.
- **No blanket pipeline retry.** The gate does not retry whole stages; that would
  hide flake.

## 3. Quarantine rules

A test may be quarantined (excluded from the blocking gate, tracked separately)
**only** when **all** hold:

1. It is **demonstrably flaky** (intermittent across ≥3 runs with no code change).
2. It is **not** a `blocking=yes` row in [`test-matrix.csv`](./test-matrix.csv) —
   no no-network proof, non-regression guard, auth check, or `tsc` gate may ever
   be quarantined.
3. A tracking note records the symptom, the suspected cause, and an owner.
4. It is **fixed or deleted within one iteration** — quarantine is a holding pen,
   not a graveyard.

`forbid_new_quarantine: true` in [`ci-integration.yaml`](./ci-integration.yaml):
**no new media-production (`MP-*` / `TB-*`) test may be quarantined to make the
gate pass.** If a new test is flaky, the fix is determinism (§1) or removing the
test — never quarantine.

## 4. The one sanctioned exception — `EditorialCalendar.test`

`apps/web/src/components/admin/content-studio/EditorialCalendar.test.tsx` is a
**pre-existing**, known-flaky suite unrelated to this program. It is the **only**
allowed entry in the quarantine allowlist
(`ci-integration.yaml → gates.merge.quarantine_allowlist`). Rules:

- It is **out of scope** for the media-production battery — this plan touches none
  of its code, so its flake must not block media-production work.
- It stays on the allowlist **as-is**; the battery neither fixes nor worsens it.
- The exit criteria (correction-loop §5.9) explicitly permit **only** this entry —
  a second quarantined test fails the "done" check.

## 5. Detecting flake in the loop (T6)

When the correction loop sees an intermittent red:

1. Re-run the impacted suite in isolation 3× (`vitest run <file>` /
   `playwright test <spec> --repeat-each=3`).
2. If it flakes: classify **T6**, apply the matching §1 control (most often a
   missing `vi.useFakeTimers`/`resetHandlers`/`findBy`).
3. If genuinely environmental and not fixable in-loop: quarantine **only if** §3
   permits; otherwise the run stays red until the env is fixed (a no-network or
   non-regression breach is **never** quarantined away).
4. Never let a flake reset-and-mask a **real** failure — re-confirm the failure is
   timing-only before treating it as T6.

## 6. The double-green rule reinforces anti-flake

Exit requires **two consecutive** full-gate greens with no edit between
(correction-loop §5). A single green that was actually a flake is caught by the
second run, which is the cheapest, most reliable flake detector in the program.
