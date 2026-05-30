# Pilot — how to drive this runbook day-to-day

> For the human or agent piloting the media-production execution. Explains cadence,
> where to record evidence, how to resume after a stop, and how the runbook +
> correction-loop + go/no-go interlock. Companions: [`runbook.md`](runbook.md),
> [`runbook-test-battery.md`](runbook-test-battery.md), [`go-no-go.md`](go-no-go.md),
> [`rollback.md`](rollback.md), [`preflight.md`](preflight.md),
> [`execution-checklist.csv`](execution-checklist.csv), [`commands.sh`](commands.sh).

## The piloting loop (one unit of work)

```
pick next row in execution-checklist.csv where status=todo (top-to-bottom, phase order)
  → perform the action (edit code / run command)
  → run the relevant gate (tsc / vitest / playwright / build per the row's `gate`)
  → record evidence (see §Evidence)
  → mark the row status=done (or blocked)
  → at end of each phase: run the correction loop to GREEN×2, then the phase go/no-go
```

Never skip a `gate` row. The two hard cross-cutting gates are **`tsc --noEmit`** and
**dry_run publishing** — they recur in many rows on purpose.

## Cadence

- **Inner loop (minutes):** edit → targeted vitest glob (see
  [`runbook-test-battery.md`](runbook-test-battery.md) §Targeted globs) → fix. Keep it
  tight; do not run the full battery on every keystroke.
- **Step boundary:** when a checklist row completes, run that row's gate
  (`tsc`/`vitest`/`playwright`/`build`) and record the result.
- **Phase boundary:** run the **full** typecheck → vitest → playwright → build
  sequence, drive the **correction loop to green twice consecutively**, then take the
  phase **go/no-go** decision. Only a GO unlocks the next phase.
- **State-changing actions** (migration apply 0.11, flag flip 4.4, any rollback) are
  `[USER]` steps run via the `!` prefix, and require tech-owner ratification per
  [`go-no-go.md`](go-no-go.md).

## Phase order (and why)

`P0 architecture → P1 voice-over → P2 subtitles → P3 compose → P4 flag rollout →
P5 hardening`. `MP-AR-*` blocks everything (it is the DTO/bridge/repo/migration
backbone). Compose (P3) consumes the voice-over and subtitles tracks, so it runs
**after** P1/P2 — though it degrades gracefully if a track is missing
([`dependency-graph.puml`](../00_global/dependency-graph.puml)).

## How the three artifacts interlock

| Artifact | Role | When consulted |
|---|---|---|
| [`runbook.md`](runbook.md) | the ordered step tables (what to do, in order) | continuously; it is the spine |
| [`runbook-test-battery.md`](runbook-test-battery.md) + [`04_test-battery/correction-loop.md`](../04_test-battery/correction-loop.md) | how to run tests and iterate to GREEN×2 | at every phase boundary (and inner loop) |
| [`go-no-go.md`](go-no-go.md) | the gate criteria + who ratifies | at every phase boundary, after GREEN×2 |

Flow: **runbook step** produces a change → **correction loop** proves it GREEN×2 →
**go/no-go** ratifies GO → next phase. A **NO-GO** loops back into the same phase's
correction loop. A broken state-changing step triggers **rollback**
([`rollback.md`](rollback.md)) before re-iterating.

## Evidence — what to record and where

Keep a single append-only evidence log for the run (suggested:
`docs/plan-media-production-2026-05-30/05_runbook/EVIDENCE.log`, gitignore-friendly or
committed as plain text — **never paste secrets/keys**). For each step/loop iteration
record:

- date/time, branch + commit sha
- checklist `step_id` + `task_ref`
- command run and its result (tsc exit, vitest pass/fail counts, playwright result,
  build result)
- the **green-counter** value (for the correction loop)
- for `[USER]` steps: confirmation the action ran (migration applied / flag value /
  health code) — **not** the credentials
- gate decision (GO / NO-GO) and ratifier

Per-feature acceptance evidence goes into each feature's
`verification-checklist.csv` `evidence` column (01_voiceover, 02_compose,
03_subtitles). Gate **G-P5** requires every such row to have evidence.

Captured baselines to record once at preflight:
- DB backup location (preflight row 18)
- EditorialCalendar pre-existing failure signature (the sanctioned exception)

## Resuming after a stop

1. Re-run **preflight rows 8–12** (typecheck, build, health 200, dry_run, flag value)
   to confirm the environment is still sane.
2. Open [`execution-checklist.csv`](execution-checklist.csv); find the first row with
   `status≠done` in phase order — that is the resume point.
3. If you stopped mid-phase, re-establish a clean baseline: run the phase's targeted
   vitest glob + `tsc` to confirm nothing regressed while paused.
4. If a `[USER]` state-changing step was in-flight when you stopped (migration / flag),
   verify its actual state first (migration `--plan`, flag grep, health) before
   re-running — these steps are idempotent-guarded but must not be double-applied
   blindly.
5. Continue the piloting loop from the resume row.

## Stop / abort conditions (halt and rollback)

Stop immediately and consult [`rollback.md`](rollback.md) if any of:

- `SOCIAL_PUBLISHING_MODE` is anything other than `dry_run` → **STOP** (sacrosanct).
- `tsc --noEmit` fails and cannot be fixed quickly → do not proceed past the gate.
- Health is not 200 after a restart → restart to previous build (§PM2).
- A flag-off run shows DOM/behavior change in `MediaStudio.test.tsx` → non-regression
  breach (D6); flag OFF + fix.
- Migration `0064` apply errors → run the down migration only with flag OFF and a
  fresh backup (§DB).

## Quality bar reminder (every gate enforces it)

Robuste · fiable · pertinent · haute qualité · maintenable · **non-régressif** ·
modulaire · **fonctionnel** — concretely: TS strict, `tsc --noEmit` gate, MSW-only
provider HTTP (`onUnhandledRequest:'error'`), additive + flag-gated, no secrets,
dry-run publishing only
([`ground-truth-codebase.md`](../00_global/ground-truth-codebase.md) §6).
