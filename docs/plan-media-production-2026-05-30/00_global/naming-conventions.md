# Naming conventions

> Binding rules for task IDs, files, routes, services, and tests across the dossier.
> Aligns with ground-truth §4 (task-ID scheme) and §5 (folder template).

---

## 1. Task-ID scheme

`MP-<AREA>-<NNN>` — `MP` = Media Production; `<NNN>` = zero-padded ordinal within
the area (`001`, `002`, …).

| Prefix | Area | Folder |
|---|---|---|
| `MP-AR-*` | Architecture / DTO / bridge / data-model / migration / flag | `00_global` |
| `MP-VO-*` | Voice-over | `01_voiceover` |
| `MP-CO-*` | Compose / montage | `02_compose` |
| `MP-SU-*` | Subtitles / script-on-video | `03_subtitles` |
| `MP-TB-*` | Test battery | `04_test-battery` |
| `MP-RB-*` | Runbook | `05_runbook` |

Rules:
- `MP-AR-*` **blocks** all `MP-VO/CO/SU-*` (see [`dependency-graph.puml`](./dependency-graph.puml)).
- A task ID is stable once published; never renumber. Append, don't reuse.
- Cross-references use the bare ID (e.g. "consumes MP-AR-003"), and bug/audit
  refs use their own IDs (e.g. `BUG-004`, `ACT-BE-035`).
- In `action-plan.csv` files, `depends_on` lists the blocking task IDs.

### Reserved backbone IDs (this folder)
`MP-AR-001` DTO · `MP-AR-002` bridge · `MP-AR-003` repository bundle fns ·
`MP-AR-004` widen kinds · `MP-AR-005` migration · `MP-AR-006` feature flag.

## 2. Code-symbol naming

### Service functions (`src/lib/content-studio/service.ts`)
`generate<Artifact>ForDraft` for per-draft generation; `compose<Object>` for assembly.
- `generateVoiceoverForDraft`, `generateSubtitlesForDraft`, `composeDraftVideo`.
- Mirror the existing `generateVisualForDraft` signature shape:
  `{ draftId; actorId; …; mode?: 'mock'|'live' }`.

### Repository functions (`src/lib/content-studio/repository.ts`)
`upsertBundleAssets`, `getDraftBundle`; legacy `upsertPrimaryAsset` kept as a shim.

### Node cores (`src/lib/ai-engine/nodes/*.ts`)
`<verb><Object>` exported alongside the `<verb><Object>Node` wrapper:
`composeMediaBundle` (in `compose.ts`), `generateVoiceoverAsset` (in
`generate-voiceover.ts`); reuse existing `generateSRT` (in `generate-subtitles.ts`).

### Types
- `MediaRole` (string-literal union) in `content-studio/types.ts`.
- `StudioV2MediaKind` widened in `content-studio-v2/media/types.ts`.
- Never use bare `string` for `role` or `kind`.

### Feature flag
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` (screaming snake, `CONTENT_STUDIO_` prefix to
match siblings like `CONTENT_STUDIO_V2_ENABLED`); zod `z.enum(['true','false']).default('false')`.
Guard helper: `requireMediaStudioEnabled()` (mirrors `requireContentStudioEnabled`).

## 3. Route naming

REST-ish, verb-as-path under the draft resource, mirroring
`…/drafts/[id]/generate-visual`:

| Feature | Route file |
|---|---|
| Voice-over | `src/app/api/admin/content-studio/drafts/[id]/generate-voiceover/route.ts` |
| Subtitles | `src/app/api/admin/content-studio/drafts/[id]/generate-subtitles/route.ts` |
| Compose | `src/app/api/admin/content-studio/drafts/[id]/compose/route.ts` |

Each: `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`
`export const maxDuration = <n>;` (compose may need a higher value than 120).
`POST` handler; zod schema in `content-studio/schemas.ts` named
`<feature>GenerationSchema` (e.g. `voiceoverGenerationSchema`, `composeSchema`).
Errors via `formatErrorResponse` → `{ error: { code, message, details } }`.

## 4. UI component / file naming

- New track components under `src/components/admin/content-studio-v2/create/`:
  `MediaTrack.tsx` (generic), or per-track `VoiceoverTrack.tsx`,
  `MusicTrack.tsx`, `SubtitlesTrack.tsx`, plus a `ComposePanel.tsx`.
- Co-located tests `*.test.tsx` next to the component.
- FR copy only; constants for labels (e.g. `TRACK_LABELS = { voiceover: 'Voix-off', … }`).

## 5. DB / migration naming

- Migration file: `NNNN_<snake_summary>.sql` (next free `0064`), e.g.
  `0064_media_production_bundle.sql`; rollback `*.down.sql`.
- New column: `meta_json` (matches the existing `_json` suffix convention on
  `content_asset_binding.crop_json`, `hashtags_json`, etc.).
- Enum value lowercase (`'subtitles'`).
- Role values snake_case (`primary_image`, `composed_video`).

## 6. Test naming

- **Vitest**: `describe('<unit under test>')` › `it('<does X> (MP-XX-NNN)')` —
  append the verifying task ID so `verifies` columns map cleanly.
  Files co-located: `service.test.ts`, `route.test.ts`, `<Component>.test.tsx`,
  `compose.test.ts` (node).
- **MSW**: handlers in `src/test/msw/handlers/*`; server `src/test/msw/server.ts`
  with `onUnhandledRequest:'error'` for mock/no-key assertions.
- **Playwright**: `e2e/content-studio-v2/<feature>-<scenario>.spec.ts`, mock mode,
  staging `:8012`. The non-regression spec `create-golden-path.spec.ts` must stay
  green with the flag off.
- Test IDs referenced in `acceptance-criteria.csv` (`test_id`) and
  `verification-checklist.csv` (`evidence`) use the file::test-name form, e.g.
  `service.test.ts::generateVoiceoverForDraft mock makes no network call`.
