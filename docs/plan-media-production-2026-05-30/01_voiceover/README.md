# 01 · Voice-over (voix-off) — feature folder index

> **Task prefix:** `MP-VO-*` · **Closes:** BUG-004 (voice-over never reaches the
> operator UI / publish). **Prerequisite:** `MP-AR-*` (architecture: DTO + bridge
> + per-draft media bundle / `role` discriminator) — see
> [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md).
>
> **Single source of truth:** [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md).
> Decisions D1–D6 and the quality bar (§6) are binding. This folder consumes the
> data-model authority that lives in `00_global` and must not contradict it.

## What this feature delivers

Let an operator generate a **TTS voice-over** (script/narration → audio track)
for a draft's video, **preview** it (audio player), **regenerate** it, and have it
**flow into compose & publish** as a `role='voiceover'` asset of the draft media
bundle (D1). The work **reuses** the existing pipeline-A node
`generateVoiceoverNode` (`src/lib/ai-engine/nodes/generate-voiceover.ts`); the
graph-coupled core is extracted into a reusable pure function so pipeline B can
call it per-draft without running the LangGraph (D3, D5).

New surface (all additive, feature-flagged behind
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, default off — D6):

| Layer | Artifact | Path |
|---|---|---|
| Node core (refactor) | `synthesizeVoiceover(...)` extracted from `generateVoiceoverNode` | `apps/web/src/lib/ai-engine/nodes/generate-voiceover.ts` |
| Service (pipeline B) | `generateVoiceoverForDraft(input): Promise<VoiceoverResult>` | `apps/web/src/lib/content-studio/service.ts` |
| Route | `POST /api/admin/content-studio/drafts/[id]/generate-voiceover` | `apps/web/src/app/api/admin/content-studio/drafts/[id]/generate-voiceover/route.ts` |
| Schema | `voiceoverGenerationSchema` (zod) | `apps/web/src/lib/content-studio/schemas.ts` |
| UI | `VoiceoverTrack` (track in the MediaStudio tracks panel) | `apps/web/src/components/admin/content-studio-v2/create/tracks/VoiceoverTrack.tsx` |
| UI | `AudioTrackPlayer` (a11y audio player) | `apps/web/src/components/admin/content-studio-v2/media/AudioTrackPlayer.tsx` |

## Mode-awareness (D3)

- **`mock`** → deterministic silent/sample WAV via ffmpeg `anullsrc`; **no provider
  HTTP call** (proven with MSW `onUnhandledRequest:'error'`); `costCents=0`.
- **`live` + no key** → `HttpError('invalid_state', …)` → **HTTP 409**. No partial
  asset is written.
- **`live` + key** → real OpenAI/ElevenLabs TTS via the reused node core. Out of
  scope to enable on staging (no key); covered by MSW-mocked tests only.

## Files in this folder (template — ground-truth §5)

| File | Purpose |
|---|---|
| [`functional-spec.md`](functional-spec.md) | optimal functioning, user stories, states, edge cases |
| [`backend-design.md`](backend-design.md) | service fn, route, node reuse, mode-awareness, errors, cost |
| [`frontend-design.md`](frontend-design.md) | components, state, hooks, data flow, optimistic UI |
| [`ui-ux-design.md`](ui-ux-design.md) | layout, interactions, a11y, i18n (FR), tokens, ASCII wireframe |
| [`api-contract.yaml`](api-contract.yaml) | OpenAPI request/response/error |
| [`data-contract.json`](data-contract.json) | JSON-Schema of payloads + asset/role records |
| [`sequence.puml`](sequence.puml) | UI→route→service→node→DB sequence |
| [`state-machine.puml`](state-machine.puml) | voice-over track lifecycle |
| [`dev-plan.md`](dev-plan.md) | ordered steps, each with its proving test |
| [`action-plan.csv`](action-plan.csv) | `id,title,layer,depends_on,files,test_ids,verifies,status` |
| [`test-plan-vitest.md`](test-plan-vitest.md) | unit/integration cases |
| [`test-plan-playwright.md`](test-plan-playwright.md) | E2E (mock mode, staging :8012) |
| [`test-plan-msw.md`](test-plan-msw.md) | MSW handlers + mock/no-key no-network proof |
| [`verification-checklist.csv`](verification-checklist.csv) | every angle |
| [`acceptance-criteria.csv`](acceptance-criteria.csv) | Gherkin-ish criteria |

## Cross-references

- DTO/bridge/data-model authority: `../00_global/*` (`MP-AR-*`).
- Sibling features that consume the same bundle: `../02_compose` (`MP-CO-*`),
  `../03_subtitles` (`MP-SU-*`). Compose **reads** the `role='voiceover'` asset
  this feature produces.
- Test battery aggregation: `../04_test-battery` (`MP-TB-*`).
