# Go / No-Go decision gates

> One gate per phase. A gate is **GO** only when every criterion is met; any unmet
> criterion ⇒ **NO-GO** (loop back into the phase via the correction loop). The
> quality bar ([`ground-truth-codebase.md`](../00_global/ground-truth-codebase.md) §6)
> underpins every gate. Companions: [`runbook.md`](runbook.md),
> [`runbook-test-battery.md`](runbook-test-battery.md), feature
> `acceptance-criteria.csv` files.

## Decision authority

| Role | Decides | Notes |
|---|---|---|
| **Release pilot** (human or agent driving the runbook) | proposes GO/NO-GO per gate from the evidence log | records decision + evidence link |
| **Tech owner** (FemiGlow maintainer) | ratifies GO for **G-P0** (migration applied to staging DB) and **G-P4** (flag flip) and **G-P5** (final) | the two state-changing gates + final sign-off |
| **[USER]** | runs all `!`-prefixed steps (migration apply, DB backup, PM2 flag flip) | interactive/privileged actions only |

Gates G-P1/G-P2/G-P3 are code-only (flag still OFF) → the **release pilot** may
ratify them directly from a green battery; G-P0/G-P4/G-P5 require **tech owner**
ratification because they change staging DB/runtime state.

## Gate criteria (csv-like)

```csv
gate,phase,criterion,how_verified,pass_condition,decider
G-P0,P0 architecture,tsc clean,pnpm -C apps/web run typecheck,exit 0,release_pilot
G-P0,P0 architecture,backbone tests green,vitest ai-engine+content-studio+CS v2 regression,all green (EditorialCalendar exception only),release_pilot
G-P0,P0 architecture,migration 0064 applied,db-migration.md §6 queries,enum=image|video|audio|subtitles; count(role='primary')=0; meta_json defaulted,tech_owner
G-P0,P0 architecture,flag default off,grep CONTENT_STUDIO_MEDIA_STUDIO_ENABLED,absent or false,release_pilot
G-P0,P0 architecture,dry_run intact,grep SOCIAL_PUBLISHING_MODE,dry_run,tech_owner
G-P0,P0 architecture,build green,pnpm -C apps/web run build,next build succeeds,release_pilot
G-P0,P0 architecture,green twice,correction-loop,2 consecutive green runs,release_pilot
G-P1,P1 voiceover,tsc clean,typecheck,exit 0,release_pilot
G-P1,P1 voiceover,VO suite green,vitest VO globs,all MP-VO tests green,release_pilot
G-P1,P1 voiceover,node unchanged,generate-voiceover.test.ts,100% green unchanged,release_pilot
G-P1,P1 voiceover,mock no-network,MSW onUnhandledRequest:error,no provider call on mock/no-key,release_pilot
G-P1,P1 voiceover,live no-key 409,generate-voiceover-for-draft.test.ts,HttpError invalid_state 409,release_pilot
G-P1,P1 voiceover,non-regression flag-off,MediaStudio.test.tsx + flag-off test,DOM unchanged; existing green,release_pilot
G-P1,P1 voiceover,E2E mock,voiceover.spec.ts,operator generates+previews (mock),release_pilot
G-P1,P1 voiceover,acceptance,01_voiceover/acceptance-criteria.csv,all rows mapped to a passing test,release_pilot
G-P1,P1 voiceover,green twice,correction-loop,2 consecutive green runs,release_pilot
G-P2,P2 subtitles,tsc clean,typecheck,exit 0,release_pilot
G-P2,P2 subtitles,SU suite green,vitest SU globs,all MP-SU tests green,release_pilot
G-P2,P2 subtitles,node unchanged,generate-subtitles.test.ts,100% green unchanged,release_pilot
G-P2,P2 subtitles,default path network-free,MSW onUnhandledRequest:error,refine=false makes zero calls,release_pilot
G-P2,P2 subtitles,srt round-trip + meta.srt==bytes,srt.test.ts + service tests,assertions pass,release_pilot
G-P2,P2 subtitles,JSON contract valid,python3 -m json.tool data-contract.json,exit 0,release_pilot
G-P2,P2 subtitles,non-regression flag-off,MediaStudio.test.tsx + flag-off test,DOM unchanged,release_pilot
G-P2,P2 subtitles,E2E mock,subtitles.spec.ts,generate+edit+save (mock),release_pilot
G-P2,P2 subtitles,acceptance,03_subtitles/acceptance-criteria.csv,all rows green,release_pilot
G-P2,P2 subtitles,green twice,correction-loop,2 consecutive green runs,release_pilot
G-P3,P3 compose,tsc clean,typecheck,exit 0,release_pilot
G-P3,P3 compose,CO suite green,vitest CO globs,all MP-CO tests green,release_pilot
G-P3,P3 compose,node unchanged,compose.test.ts,existing 8 green unchanged,release_pilot
G-P3,P3 compose,zero HTTP,MSW request:start spy,spy == [] for compose,release_pilot
G-P3,P3 compose,no primary video 409,compose-draft-video.test.ts,HttpError invalid_state 409,release_pilot
G-P3,P3 compose,export degraded non-fatal,compose-draft-video.test.ts,export.degraded=true compose still ok,release_pilot
G-P3,P3 compose,non-regression flag-off,MediaStudio.test.tsx + flag-off test,DOM unchanged,release_pilot
G-P3,P3 compose,E2E mock,compose.spec.ts,compose+preview+publish summary (mock),release_pilot
G-P3,P3 compose,publish stays dry_run,grep SOCIAL_PUBLISHING_MODE,dry_run,tech_owner
G-P3,P3 compose,acceptance,02_compose/acceptance-criteria.csv,all rows green,release_pilot
G-P3,P3 compose,green twice,correction-loop,2 consecutive green runs,release_pilot
G-P4,P4 flag rollout,full flag-off regression,vitest flag-off + create-golden-path.spec.ts,DOM unchanged; golden path green,release_pilot
G-P4,P4 flag rollout,tsc + build green,typecheck && build,both succeed,release_pilot
G-P4,P4 flag rollout,flag flipped on staging only,pm2 env after restart,CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true on web,tech_owner
G-P4,P4 flag rollout,health after restart,curl /api/health,200,tech_owner
G-P4,P4 flag rollout,dry_run still in force,grep SOCIAL_PUBLISHING_MODE,dry_run,tech_owner
G-P4,P4 flag rollout,flag-on smoke,playwright @flag-on,Studio média panel renders; mock tracks generate,release_pilot
G-P5,P5 hardening,full tsc,typecheck,exit 0,release_pilot
G-P5,P5 hardening,full vitest battery,vitest run,green (EditorialCalendar exception only),release_pilot
G-P5,P5 hardening,full playwright,playwright e2e/content-studio-v2,all specs green,release_pilot
G-P5,P5 hardening,production build,next build,succeeds,release_pilot
G-P5,P5 hardening,green twice,correction-loop,2 consecutive fully-green runs,release_pilot
G-P5,P5 hardening,non-regression sign-off,vitest -t non-regression + dry_run grep,generate-visual + 4-step flow intact; dry_run,tech_owner
G-P5,P5 hardening,evidence complete,verification-checklist.csv per feature,every row has evidence,tech_owner
G-P5,P5 hardening,no secrets,git diff scan,no keys committed,tech_owner
G-P5,P5 hardening,BUG-004 closed,plan acceptance PA-09 + audit 2026-05-29,artifacts surfaced through bridge end-to-end,tech_owner
```

## NO-GO handling

- A NO-GO is **not** a failure of the plan — it routes back into the same phase's
  correction loop ([`runbook-test-battery.md`](runbook-test-battery.md)).
- Record the failing criterion(s) and the triage action in the evidence log.
- For state-changing gates that already executed a `!` step (G-P0 migration applied,
  G-P4 flag flipped) and then went NO-GO, apply the matching rollback first
  ([`rollback.md`](rollback.md) §DB / §Flag) before re-iterating.
- **Never** trade away a sacrosanct invariant (dry_run, tsc gate, additive/flag-gated)
  to force a GO.
