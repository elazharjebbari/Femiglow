# Boucle de corrections et vérifications (MP-TB)

> The **deterministic** correction-and-verification loop the implementer runs
> until the battery is green **twice consecutively**. It triages failures by
> class, fixes the smallest unit, re-runs only the impacted suites plus the full
> gate, and never declares done on a single green run. It ties into the
> operational steps in the sibling runbook (`../05_runbook/`).
>
> Diagram: [`correction-loop.puml`](./correction-loop.puml). Gate order and
> stages: [`ci-integration.yaml`](./ci-integration.yaml) ·
> [`execution-plan.md`](./execution-plan.md). Flake handling:
> [`flakiness-policy.md`](./flakiness-policy.md).

---

## 1. The gate sequence (one "run")

A single run executes the stages **in order, fail-fast**:

```
G0 typecheck   pnpm -C apps/web exec tsc --noEmit      # vitest does NOT typecheck — this MUST be first
G1 lint        pnpm -C apps/web run lint               # next lint
G2 unit+int    pnpm -C apps/web exec vitest run        # MSW onUnhandledRequest:'error' globally
G3 e2e         pnpm -C apps/web exec playwright test --grep @content-studio   # mock mode, :8012, dry-run
G4 build       pnpm -C apps/web run build              # next build — final type/bundle proof
```

Fail-fast: a red stage stops the run and routes its failures into the triage
taxonomy (§3). `tsc` is **G0** by design (strategy §6).

---

## 2. The loop (text form)

```
loop():
  green_streak = 0
  while green_streak < 2:
      result = run_gate_sequence()              # G0..G4, fail-fast
      if result.all_green:
          green_streak += 1
          continue                              # re-run the WHOLE gate to confirm stability
      green_streak = 0                          # any red resets the streak
      failures = collect_failures(result)
      classes  = triage(failures)               # §3 taxonomy, ordered by severity
      for cls in ordered(classes):              # fix highest-severity class first
          fix = smallest_fix_for(cls)           # one root cause, smallest diff
          apply(fix)
          rerun_impacted(cls.suites)            # fast inner loop on impacted suites only
      # outer loop re-runs the FULL gate (catches cross-suite regressions)
  assert green_streak == 2                       # EXIT
```

Two nested loops:
- **Inner (fast):** fix one class → re-run only the impacted suites (e.g. just
  `compose-draft-video.test.ts`) for a tight edit/verify cycle.
- **Outer (authoritative):** once the inner edits settle, re-run the **full** gate
  G0–G4 to catch cross-suite regressions (a fix in the SRT lib can ripple into
  compose's subtitles contract). Only the **outer full-gate** green counts toward
  the streak.

**Exit = two consecutive full-gate greens with no intervening edit.** The second
green proves the first wasn't a flake and that no fix introduced a regression.

---

## 3. Triage taxonomy (classify every failure, fix in this order)

Severity order: **T0 → T6**. Fix the highest-severity class present first; a T0
failure blocks everything else.

| Class | Symptom | Likely root cause | First action |
|---|---|---|---|
| **T0 · Typecheck** | G0 `tsc --noEmit` red | new DTO field not optional; `MediaRole` typed as bare `string`; `noUncheckedIndexedAccess` violation | Fix the type at source (make field `?:`, narrow with a guard/`satisfies`). **Never** silence with `any`/`@ts-ignore`. |
| **T1 · No-network breach** | a `mock`/`no-key` test throws on an unexpected request, or `seen !== []` | the supposedly-offline path issued HTTP (regression of the core invariant) | Trace the request URL from the thrown MSW error; remove the call or gate it behind `live`+key. This is a **release blocker**. |
| **T2 · Non-regression** | existing `compose.test.ts` / `generate-voiceover.test.ts` / `generate-subtitles.test.ts` red, or `git diff` non-empty for them; flag-off DOM changed | node extraction altered graph behavior; flag leaked; `upsertPrimaryAsset` shim changed | Restore behavior; the core extraction must be **behavior-preserving** and additive. Blocker. |
| **T3 · Contract** | schema/OpenAPI lint fails; `meta.srt !== serializeSrt(cues)`; DTO/bridge map wrong channel | producer/consumer drift; channel-name mismatch (`composition`→`composedVideo`) | Align the contract end-to-end; re-run the contract suite + both sides. |
| **T4 · Behavioral / failure-injection** | a 5xx/timeout/missing-source/codec branch returns the wrong code, leaks a temp file, or writes a fake asset | error mapping or cleanup wrong | Fix the error-mapping/cleanup; assert `unlink`/`kill`/`no-createMedia`. |
| **T5 · A11y / i18n** | missing `aria-*`, focus not managed, English copy, `role=alert` absent | component markup/copy | Fix markup/labels/French copy; re-run the component suite. |
| **T6 · Flake** | intermittent red, passes on retry; timing/timer/MSW-order sensitive | real-timer leak, unhandled microtask, handler bleed | Apply fake-timer/`resetHandlers` fix per [`flakiness-policy.md`](./flakiness-policy.md). If not deterministically fixable in-loop → **quarantine** (don't mask a real bug). |

Tie-break within a stage: fix **T0/T1/T2 (blockers)** before any T3–T5; never
proceed to E2E (G3) while G0–G2 carry a blocker.

---

## 4. Impacted-suite map (what to re-run for the inner loop)

| Changed surface | Re-run these suites first |
|---|---|
| DTO / bridge / repository (`MP-AR-*`) | DTO+bridge contract tests, **all three** services (they consume `upsertBundleAssets`/`getDraftBundle`), `compose-subtitles-contract.test.ts` |
| SRT lib (`srt.ts`) | `srt.test.ts`, `generate-subtitles-core.test.ts`, `generate-subtitles.test.ts` (regression), `compose-subtitles-contract.test.ts` |
| `synthesizeVoiceover` core | `synthesize-voiceover.test.ts`, `generate-voiceover.test.ts` (regression), `generate-voiceover-for-draft.test.ts` |
| `composeMediaBundle` core | `compose-media-bundle.test.ts`, `compose.test.ts` (regression), `compose-draft-video.test.ts` |
| a service fn | its `*-for-draft.test.ts` + its `*.route.test.ts` |
| a component | its `*.test.tsx` + the `MediaStudio.*` wiring test + the `PublishActionGroup.*` test |
| any UI selector/copy | the matching `*.spec.ts` E2E (run last, G3) |

After any inner fix, the **outer** loop still re-runs the full G0–G4.

---

## 5. Exit criteria (definition of done)

The battery is **done** only when **all** hold on **two consecutive** full
gate runs with no edit between them:

1. G0 `tsc --noEmit` exit 0.
2. G1 lint exit 0.
3. G2 vitest: 0 failures; **0** unexpected-request errors; every `mock`/`no-key`
   row asserts `seen === []`.
4. Non-regression: `compose.test.ts` (8), `generate-voiceover.test.ts` (7),
   `generate-subtitles.test.ts` (6) green and **unedited** (`git diff` empty);
   flag-off DOM-unchanged tests green.
5. Contract: `data-contract.json` valid (`python3 -m json.tool`), `api-contract.yaml`
   valid OpenAPI 3.1, `compose-subtitles-contract.test.ts` green.
6. G3 Playwright `@content-studio` specs green in **mock** mode; publish observed
   **dry-run**; existing `create-golden-path.spec.ts` green.
7. G4 `next build` exit 0.
8. No `blocking=yes` row in [`test-matrix.csv`](./test-matrix.csv) is failing or
   quarantined.
9. Quarantine list contains only the sanctioned pre-existing exception
   (`EditorialCalendar.test`, see [`flakiness-policy.md`](./flakiness-policy.md)) —
   no new media-production test is quarantined.

If any check is red, the streak resets to 0 and the loop re-enters at §2.

---

## 6. Flowchart (fenced text)

```
        ┌─────────────────────────────────────────────┐
        │  START  (green_streak = 0)                   │
        └───────────────────┬─────────────────────────┘
                            v
        ┌─────────────────────────────────────────────┐
        │  RUN GATE  G0 tsc → G1 lint → G2 vitest →    │
        │            G3 playwright → G4 build (fail-fast)│
        └───────────────────┬─────────────────────────┘
                            v
                   ┌────────────────┐   all green?
                   │  ALL GREEN ?   ├───── no ──────────┐
                   └───────┬────────┘                   v
                       yes │              ┌───────────────────────────────┐
                            v             │ TRIAGE → classes T0..T6        │
                ┌────────────────────┐    │ (severity order; blockers 1st) │
                │ green_streak += 1  │    └───────────────┬───────────────┘
                └─────────┬──────────┘                    v
                            │              ┌───────────────────────────────┐
                            │              │ FIX smallest unit for class    │
                            │              │ (T0 type at source; T1 remove  │
                            │              │  stray call; … NO any/ts-ignore)│
                            │              └───────────────┬───────────────┘
                            │                              v
                            │              ┌───────────────────────────────┐
                            │              │ RE-RUN IMPACTED SUITES (inner) │
                            │              └───────────────┬───────────────┘
                            │                              │ green_streak = 0
                            │                              v
                            │                    (back to RUN GATE — outer)
                            v
                   ┌────────────────┐
                   │ streak == 2 ?  ├── no ──► (back to RUN GATE)
                   └───────┬────────┘
                       yes │
                            v
        ┌─────────────────────────────────────────────┐
        │  EXIT — battery GREEN twice consecutively    │
        │  (all §5 exit criteria satisfied)            │
        └─────────────────────────────────────────────┘
```

---

## 7. Runbook linkage

The mechanical commands (env setup, `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true`
for E2E, staging :8012 bring-up, migration `0064` apply/verify, how to read MSW
unexpected-request errors) live in the sibling runbook `../05_runbook/`. This
loop is the **decision procedure**; the runbook is the **operational
how-to**. When a triage action says "apply migration" or "bring up staging", the
exact command is the runbook's responsibility.
