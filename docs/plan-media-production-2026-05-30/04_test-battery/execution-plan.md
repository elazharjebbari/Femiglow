# Execution plan (MP-TB) — ordered run of the dense battery

> The ordered execution of the battery: which suites run in which order, what runs
> in parallel, and the gate sequence. Tied to the operational
> runbook (`../05_runbook/`) and the gate stages in
> [`ci-integration.yaml`](./ci-integration.yaml). The loop that drives re-runs is
> [`correction-loop.md`](./correction-loop.md).

---

## 1. Dependency-respecting order

`MP-AR-*` (DTO/bridge/repository/migration) is the **prerequisite** for every
feature (ground-truth §4: "Architecture work … blocks all MP-VO/CO/SU"). So the
battery executes architecture-first, then the three features (independent of each
other), then the cross-feature contract + global non-regression, then E2E.

```
PHASE 0  Static gates (fail-fast)
  0.1  G0 tsc --noEmit            ← hard gate, FIRST (vitest doesn't typecheck)
  0.2  G1 next lint

PHASE 1  Architecture backbone (vitest)            [blocks everything]
  1.1  orchestrator-result.test.ts                 TB-AR-001..004
  1.2  content-studio-bridge.test.ts               TB-AR-005..008
  1.3  repository-bundle.test.ts                    TB-AR-009..012
  1.4  0064 migration verify (db-migration §6)      TB-AR-013..014
       (run against an ephemeral PG; runbook owns bring-up)

PHASE 2  Pure cores (vitest, no I/O / ffmpeg+TTS mock)   [3 features in parallel]
  2a.1 srt.test.ts (V1..V11, round-trips)           TB-SU-001..030
  2a.2 generate-subtitles-core.test.ts              TB-SU-031..034
  2b.1 synthesize-voiceover.test.ts                 TB-VO-001..006, 059
  2c.1 compose-media-bundle.test.ts                 TB-CO-001..012
  2*.2 schemas (voiceover/compose/subtitles)        TB-VO-008..013, TB-CO-014..019, TB-SU-036..046

PHASE 3  Node regression (vitest, existing files UNEDITED)   [parallel]
  3.1  generate-voiceover.test.ts (7)               TB-VO-007
  3.2  compose.test.ts (8)                          TB-CO-013
  3.3  generate-subtitles.test.ts (6)               TB-SU-035
       → fail if green is not preserved OR git diff non-empty (T2 blocker)

PHASE 4  Services + routes (vitest + MSW)            [3 features in parallel]
  4a   generate/save-subtitles-for-draft + routes   TB-SU-047..078
  4b   generate-voiceover-for-draft + route         TB-VO-014..032
  4c   compose-draft-video + route                  TB-CO-020..043
       MSW onUnhandledRequest:'error'; mock/no-key assert request:start spy = []

PHASE 5  Components (vitest + RTL + jsdom + MSW stubs)   [parallel]
  5.*  AudioTrackPlayer, VoiceoverTrack, ComposePanel, TracksPanel,
       CueEditor, SubtitleStyleControls, SubtitleOverlayPreview, SubtitlesTrack,
       MediaStudio.{voiceover,compose,subtitles}, PublishActionGroup.{...}
       TB-VO-033..050, TB-CO-044..061, TB-SU-079..110

PHASE 6  Cross-feature contracts (vitest + static)
  6.1  compose-subtitles-contract.test.ts           TB-SU-111..112
  6.2  data-contract.json / api-contract.yaml lint   TB-GL-003..004, TB-SU-122
  6.3  no-network proof aggregation                  TB-VO-052, TB-CO-062, TB-SU-066/114

PHASE 7  Global non-regression (vitest)
  7.1  MediaStudio.test.tsx (existing, green)        TB-GL-002

PHASE 8  E2E (Playwright @content-studio, mock, :8012, flag ON)   [last]
  8.1  create-golden-path.spec.ts (existing)         TB-GL-001
  8.2  voiceover.spec.ts                              TB-VO-053..058
  8.3  compose.spec.ts                                TB-CO-063..069
  8.4  subtitles.spec.ts                              TB-SU-115..121

PHASE 9  Build
  9.1  next build                                     TB-GL-005
```

## 2. Parallelism

- **Phase-internal:** vitest runs files in parallel workers by default; the
  features in phases 2/4/5 are independent and parallelize freely. Determinism is
  preserved because every time-sensitive test pins fake timers + `TZ=UTC`
  (strategy §5).
- **Cross-phase:** phases are **serialized at the gate level** (a red earlier
  phase fails fast), but phase 6.2 (static contract lint) can run **concurrently**
  with phases 2–5 since it touches only docs (`ci-integration.yaml` →
  `G2b_contracts parallel_with G2_vitest`).
- **E2E (phase 8):** Playwright runs its own workers; mock-mode compose is a
  deterministic byte-copy, so parallel workers don't contend on a shared ffmpeg
  encode (robustness P4).

## 3. The gate sequence (one full run)

`G0 tsc → G1 lint → G2 vitest (phases 1–7) → G3 playwright (phase 8) → G4 build
(phase 9)`, fail-fast. This is exactly the order the correction loop re-runs each
iteration. The **only** ordering that is non-negotiable is `G0` first.

## 4. What "done" looks like per phase

| Phase | Done when |
|---|---|
| 0 | tsc + lint exit 0 |
| 1 | architecture suite green; migration verify SELECTs match (db-migration §6) |
| 2 | all V1..V11 + round-trips green; mock cores assert no fetch |
| 3 | existing node tests green AND unedited (`git diff` empty) |
| 4 | mode matrix green; every mock/no-key path `seen === []`; live+key exactly one call |
| 5 | a11y/state/flag-off rows green |
| 6 | `meta.srt === serializeSrt(cues)`; contracts validate |
| 7 | `MediaStudio.test.tsx` green unchanged |
| 8 | golden paths green in mock mode; publish dry-run observed |
| 9 | `next build` exit 0 |

## 5. Tie-in to the correction loop

When any phase is red, stop, classify with the triage taxonomy
([`correction-loop.md`](./correction-loop.md) §3), fix the smallest unit, re-run
the **impacted** suites (the impacted-suite map there), then re-run the **full**
gate. Exit only on **two consecutive** full-gate greens with no intervening edit.

## 6. Runbook linkage

Operational specifics — provisioning an ephemeral Postgres for the migration
verify (phase 1.4), bringing staging up on :8012 with
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true` for phase 8, reading an MSW
unexpected-request stack trace, and the exact `pnpm` invocations — live in the
sibling runbook `../05_runbook/`. This plan is the **what/when**; the runbook is
the **how**.
