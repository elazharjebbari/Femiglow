# Runbook — test battery + correction loop

> How to execute the dense test battery and drive the correction loop to its exit.
> Companions: [`runbook.md`](runbook.md),
> [`04_test-battery/execution-plan.md`](../04_test-battery/execution-plan.md),
> [`04_test-battery/correction-loop.md`](../04_test-battery/correction-loop.md)
> (the `04_test-battery/` folder is authored in parallel; if a file is missing,
> proceed using the commands below and reference it by path).

## The three-layer test sequence (always in this order)

The order matters: **`tsc` first** because vitest does NOT typecheck (two
build-breakers shipped this week — quality bar §6). A green vitest run over
type-broken code is a false positive.

| # | layer | command | proves |
|---|---|---|---|
| 1 | **Typecheck** | `pnpm -C apps/web run typecheck` | `tsc --noEmit` — no type errors anywhere (hard gate) |
| 2 | **Unit/integration** | `pnpm -C apps/web exec vitest run` | service/route/node/component behavior; MSW no-network proofs |
| 3 | **E2E** | `pnpm -C apps/web exec playwright test e2e/content-studio-v2` | operator golden paths on staging :8012 (mock mode) |
| 4 | **Build** | `pnpm -C apps/web run build` | `next build` compiles for prod (the deployed artifact) |

A run is **GREEN** only when steps 1–4 all pass (modulo the documented
EditorialCalendar exception in §"Pre-existing exception").

## Targeted globs (faster inner loop per feature)

Run the narrow set while iterating, then the full battery before a gate.

```bash
# Architecture backbone (P0)
pnpm -C apps/web exec vitest run src/lib/ai-engine src/lib/content-studio

# Voice-over (P1)
pnpm -C apps/web exec vitest run \
  src/lib/ai-engine/nodes/generate-voiceover \
  src/lib/content-studio \
  src/components/admin/content-studio-v2

# Subtitles (P2)
pnpm -C apps/web exec vitest run \
  src/lib/ai-engine/subtitles \
  src/lib/ai-engine/nodes/generate-subtitles \
  src/lib/content-studio \
  src/components/admin/content-studio-v2

# Compose (P3)
pnpm -C apps/web exec vitest run \
  src/lib/ai-engine/nodes/compose \
  src/lib/content-studio \
  src/components/admin/content-studio-v2

# Run a single named test while debugging
pnpm -C apps/web exec vitest run -t "mode=mock"
```

E2E per feature (mock mode, staging must be up on :8012):

```bash
pnpm -C apps/web exec playwright test e2e/content-studio-v2/voiceover.spec.ts
pnpm -C apps/web exec playwright test e2e/content-studio-v2/subtitles.spec.ts
pnpm -C apps/web exec playwright test e2e/content-studio-v2/compose.spec.ts
pnpm -C apps/web exec playwright test e2e/content-studio-v2/create-golden-path.spec.ts
```

## MSW no-network assertion (mandatory)

Provider HTTP is mocked via MSW (`src/test/msw/server.ts`, idempotent listen),
**never** `vi.stubGlobal('fetch')`. Mock-mode and live-no-key paths must make
**zero** network calls — proven with `onUnhandledRequest:'error'` and, for compose,
a `request:start` spy asserting `[]`. If a mock/no-key test triggers an unhandled
request, that is a **real defect** (the path is hitting a provider), not a flaky test —
fix the code path, not the assertion.

## The correction loop (green twice consecutively)

Source of truth: [`04_test-battery/correction-loop.md`](../04_test-battery/correction-loop.md).
Operationally:

```
loop:
  1. run sequence: tsc → vitest → playwright → build
  2. if all GREEN:
        record run #N green; if previous run #N-1 was also GREEN with no code
        change in between → EXIT (green×2). else go to 1 (confirmation run).
  3. if RED:
        triage (see below) → apply the smallest fix → reset the green counter
        → go to 1.
```

**Exit criterion:** two **consecutive** fully-green runs with **no intervening code
change** between them. The second run is the confirmation that the green is stable
(not order-dependent or flaky). The green counter resets to zero on any edit.

## Triage decision tree

| Symptom | Likely cause | Action |
|---|---|---|
| `tsc` error, vitest was green | type hole vitest can't see (the exact gap that shipped 2 breakers) | fix types first; never silence with `any`/`@ts-ignore` |
| vitest: unhandled request error in a mock/no-key test | code path hit a provider it shouldn't | fix the service/route to short-circuit before fetch |
| vitest: snapshot/DOM diff in `MediaStudio.test.tsx` (flag off) | non-regression breach (D6) | restore byte-for-byte flag-off behavior |
| vitest fails only in full run, passes targeted | test-order/shared-state leak | isolate state; check MSW `resetHandlers`, DB/test fixtures |
| Playwright timeout on :8012 | staging down or flag not set | verify PM2 `web` online + health 200; check flag env for `@flag-on` specs |
| `next build` fails, tsc passed | next-specific (RSC boundary, dynamic import) | fix per build error; re-run tsc+build |
| EditorialCalendar test red | pre-existing, out of scope | see exception below — do NOT block on it |

## Pre-existing exception — EditorialCalendar

`apps/web/src/components/admin/content-studio/EditorialCalendar.test.tsx` has a
**pre-existing** failure unrelated to this plan (no media-production task touches
that component). It is the **only** sanctioned red in the battery.

- Treat it as a known-baseline exception: a run is "green" for gate purposes if the
  **only** failing test is EditorialCalendar and it fails **identically** to the
  pre-plan baseline.
- Capture the baseline once at preflight: `pnpm -C apps/web exec vitest run
  src/components/admin/content-studio/EditorialCalendar.test.tsx` and record the
  failure signature in the evidence log ([`pilot.md`](pilot.md) §Evidence).
- If EditorialCalendar's failure **changes** (new error, more failures) after a
  media-production edit, that IS a regression you caused → triage and fix.
- Any **other** red anywhere blocks the gate.

## Per-gate battery scope

| Gate | tsc | vitest scope | playwright | build |
|---|---|---|---|---|
| G-P0 | full | `src/lib/ai-engine` + `src/lib/content-studio` + CS v2 regression | golden-path | yes |
| G-P1 | full | VO globs + `MediaStudio.test.tsx` | voiceover.spec + golden-path | yes |
| G-P2 | full | SU globs + node + `MediaStudio.test.tsx` + JSON contract valid | subtitles.spec + golden-path | yes |
| G-P3 | full | CO globs + node (8) + `MediaStudio.test.tsx` | compose.spec + golden-path | yes |
| G-P4 | full | all flag-off + flag-on regression | golden-path + `@flag-on` | yes |
| G-P5 | full | **entire battery** | **all** content-studio-v2 specs | yes |

JSON contract validation (subtitles): `python3 -m json.tool
docs/plan-media-production-2026-05-30/03_subtitles/data-contract.json >/dev/null`.

## Recording results

After each loop iteration, append to the evidence log (per [`pilot.md`](pilot.md)):
date/time, commit, run #, tsc result, vitest pass/fail counts, playwright result,
build result, and the green-counter value. The gate owner in
[`go-no-go.md`](go-no-go.md) reads this log to decide GO/NO-GO.
