# Subtitles / script-on-video — backend design

> Grounded in: `src/lib/ai-engine/nodes/generate-subtitles.ts` (+ `.test.ts`),
> `src/lib/ai-engine/nodes/compose.ts` (consumes `state.subtitles`),
> `src/lib/content-studio/service.ts` (`generateVisualForDraft` ~L287),
> `src/app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts`,
> `src/lib/content-studio/provider-credentials.ts`, `src/lib/errors/http-error.ts`.
> Decisions D2/D3/D5. Authority for schema/migration: `../00_global`. Prefix `MP-SU-*`.

## 1. SRT library — extract pure core (MP-SU-01, D5)

`generateSubtitlesNode(state)` is graph-coupled: it reads `state.jobId`,
`state.script`, calls `getEngineConfig()`, writes a `.srt` file to `MEDIA_DIR`, and
returns `{ subtitles, currentStep }`. Its real value (`formatTimestamp` + `generateSRT`)
is **pure string building**. We lift that into a standalone, reusable, fully-tested
module and make the node a thin wrapper (zero behavior change → node tests stay green).

New file `apps/web/src/lib/ai-engine/subtitles/srt.ts` (pure, no fs, no network):

```ts
export interface Cue {
  /** 1-based, re-assigned on serialize; UI uses array order. */
  index: number;
  startMs: number;     // integer ms ≥ 0
  endMs: number;       // integer ms, > startMs
  lines: string[];     // 1..2 lines
}

export interface BurnInStyle {
  font: 'sans' | 'serif' | 'mono';
  sizePx: number;                 // 12..72
  position: 'top' | 'middle' | 'bottom';
  textColor: string;              // #RRGGBB
  boxColor?: string;              // #RRGGBB, undefined => no box
  boxOpacity?: number;            // 0..1
}

export const SUBTITLE_LIMITS = {
  MAX_CHARS_PER_LINE: 42,
  MAX_LINES_PER_CUE: 2,
  MIN_CUE_MS: 700,
  MIN_GAP_MS: 80,
  MAX_CPS: 17,
  MAX_CUES: 200,
} as const;

export const DEFAULT_BURN_IN_STYLE: BurnInStyle = {
  font: 'sans', sizePx: 28, position: 'bottom', textColor: '#FFFFFF',
  boxColor: '#000000', boxOpacity: 0.5,
};

/** "HH:MM:SS,mmm" (comma decimal, zero-padded). Inverse of parseTimecode. */
export function formatTimecode(ms: number): string;
/** Parses "HH:MM:SS,mmm" (also tolerates '.'); throws on malformed. */
export function parseTimecode(tc: string): number;

/** Canonical SRT: 1-based indices, LF, blank line per block. */
export function serializeSrt(cues: Cue[]): string;
/** Tolerant parse (CRLF, extra blanks); returns ms-based cues. */
export function parseSrt(srt: string): Cue[];

/** Segment a script string into wrapped, timed cues (deterministic, pure). */
export function parseScriptToCues(input: {
  hook?: string;
  scenes?: Array<{ narration?: string; onScreenText?: string; textOverlay?: string; description?: string; durationSeconds?: number }>;
  rawText?: string;   // when the operator passes a plain `script` override
}): Cue[];

export type CueValidationCode =
  | 'timecode' | 'duration' | 'order' | 'overlap' | 'lines'
  | 'line_length' | 'empty' | 'min_duration' | 'cps' | 'min_gap' | 'beyond_video';

export interface CueIssue { cueIndex: number; code: CueValidationCode; severity: 'error' | 'warning'; message: string; }

/** Pure validator (functional-spec §6). videoDurationMs optional. */
export function validateCues(cues: Cue[], opts?: { videoDurationMs?: number }): CueIssue[];
```

- `formatTimecode` reproduces the existing `formatTimestamp` (hours/min/sec padded +
  `,` + 3-digit millis) **exactly**, so already-emitted SRT is byte-stable.
- `serializeSrt` reproduces the node's `entries.join('\n')` block layout so
  `compose.ts` ingestion is unchanged.
- `parseScriptToCues` supersedes the node's inline `generateSRT`: same cumulative
  timing (hook ≤ 3 s then `durationSeconds ?? 4` per scene), but **wraps** lines to
  `MAX_CHARS_PER_LINE` into ≤ 2 lines (splitting overflow into extra cues) instead of
  the lossy 120-char `slice(0,117)+'...'` truncation. Empty input → `[]`.

### Node becomes a thin wrapper (MP-SU-01)

```ts
// generate-subtitles.ts (refactor — behavior preserved)
import { parseScriptToCues, serializeSrt } from '../subtitles/srt';
export async function generateSubtitlesNode(state) {
  const script = state.script as Record<string, unknown> | null;
  const cues = parseScriptToCues({
    hook: (script?.hook as string) ?? '',
    scenes: (script?.scenes as any[]) ?? [],
  });
  const subtitles = serializeSrt(cues);     // '' when no cues
  // ...existing mkdir/writeFile/stat side-effects + logging, unchanged...
  return { subtitles, currentStep: 'generate_subtitles' };
}
```
> The existing `generate-subtitles.test.ts` asserts `-->`, 4 entries (hook+3 scenes),
> cumulative timing, hook-first, empty→`''`, `currentStep`. All remain true with the
> wrapper (MP-SU-13). The lib carries the **new** correctness tests (round-trip,
> wrapping, validation).

## 2. Per-draft generation core (MP-SU-02, D5)

```ts
// apps/web/src/lib/ai-engine/subtitles/generate-subtitles-core.ts (or in srt.ts)
export interface GenerateSubtitlesCoreInput {
  /** Draft script object (hook + scenes) OR a raw override string. */
  script: { hook?: string; scenes?: any[] } | null;
  rawText?: string;
  /** 'mock'|'rule-based' = pure; 'openai' only when refine && live && key. */
  refine: boolean;
  apiKey?: string;            // required iff refine in live
  onProviderError: 'throw' | 'passthrough';
}
export interface GenerateSubtitlesCoreOutput {
  cues: Cue[];
  srt: string;               // canonical, == serializeSrt(cues)
  provider: 'rule-based' | 'openai:gpt-4o-mini';
  costCents: number;         // 0 unless refine used tokens
  refined: boolean;
}
export async function generateSubtitlesForDraftCore(
  input: GenerateSubtitlesCoreInput,
): Promise<GenerateSubtitlesCoreOutput>;
```

- `refine:false` ⇒ `cues = parseScriptToCues(...)`, `provider:'rule-based'`,
  `costCents:0`, **no fetch**. This is the network-silence guarantee MSW asserts.
- `refine:true` ⇒ a single LLM call tidies cue *text only* (never timecodes), reusing
  the existing text-generation client; on 5xx with `onProviderError:'throw'` it throws.
  The per-draft service passes `'throw'`; the graph never refines (passes `refine:false`).

## 3. Service — `generateSubtitlesForDraft` + `saveSubtitlesForDraft` (MP-SU-03, D3)

New exports in `src/lib/content-studio/service.ts`, mirroring `generateVisualForDraft`.

```ts
export interface SubtitlesForDraftInput {
  draftId: string;
  actorId: string | null;
  /** Operator override of the source text. If omitted, derive from draft script. */
  script?: string;
  refine?: boolean;          // default false
  mode?: 'mock' | 'live';
}

export interface SaveSubtitlesInput {
  draftId: string;
  actorId: string | null;
  cues: Cue[];               // operator-edited; revalidated server-side
  style: BurnInStyle;
}

export interface SubtitlesResult {
  id: string;                // media id ('' when generate produced 0 cues, not yet persisted)
  draftId: string;
  role: 'subtitles';         // D1 bundle role
  kind: 'subtitles';         // D1 widened StudioV2MediaKind (enum value added by MP-AR-005)
  slug: string;
  cues: Cue[];
  srt: string;               // canonical SRT
  style: BurnInStyle;
  cueCount: number;
  previewUrl: string;        // URL of the .srt asset (text)
  originalUrl: string;
  provider: string;          // 'rule-based' | 'openai:gpt-4o-mini'
  costCents: number;
  createdAt: string;
}

export async function generateSubtitlesForDraft(input: SubtitlesForDraftInput): Promise<SubtitlesResult>;
export async function saveSubtitlesForDraft(input: SaveSubtitlesInput): Promise<SubtitlesResult>;
```

### 3.1 `generateSubtitlesForDraft` algorithm

1. `const draft = await requireDraft(input.draftId);` (404 `not_found` if absent).
2. **Format gate** (E2): if `draft.format ∉ {'reel','story'}` →
   `throw new HttpError('invalid_state','Sous-titres réservés aux formats vidéo (Reel/Story).')`.
3. `const mode = input.mode ?? 'mock';` `const refine = input.refine ?? false;`
4. **Refine credential (mode-aware, only when refine):**
   - `refine === false` ⇒ pure path, `provider='rule-based'`, no key, `estimate=0`.
   - `refine === true && mode === 'live'` ⇒ `const apiKey = await resolveProviderCredential('openai');`
     **If `!apiKey`** → `throw new HttpError('invalid_state','Aucune clé IA configurée pour l’affinage. Désactivez l’affinage ou repassez en mock.')` **before any fetch** (E5, 409).
   - `refine === true && mode === 'mock'` ⇒ refine is **ignored** (mock never calls a
     provider); behave as `refine:false`.
5. `await checkDailyBudget(estimate);` (pure path → `0`; refine estimate from text
   length). Over budget ⇒ 429.
6. `const out = await generateSubtitlesForDraftCore({ script: draft.script, rawText: input.script, refine: refine && mode === 'live', apiKey, onProviderError: 'throw' });`
   - In `live`, a provider 5xx becomes a thrown `Error`; the service wraps it:
     `throw new HttpError('upstream_failed','Échec de l’affinage des sous-titres.', { cause })` (E6).
7. **Empty result (E3):** if `out.cues.length === 0` ⇒ return a *transient*
   `SubtitlesResult` with `id:'', srt:'', cueCount:0` and the default style; **do not
   persist** (nothing to bind). The UI shows an empty editor + hint.
8. **Persist via `saveSubtitlesForDraft`** with the generated cues + default style (or
   keep an existing style if a subtitles binding already exists — read via
   `getDraftBundle(draftId).subtitles?.meta.style`). Generation auto-saves so the
   operator's first action lands an asset; subsequent edits use the PUT route.
9. Return the `SubtitlesResult`.

### 3.2 `saveSubtitlesForDraft` algorithm (authoritative persistence)

1. `const draft = await requireDraft(input.draftId);`
2. **Format gate** as above.
3. **Empty (E9):** if `input.cues.length === 0` ⇒ delete the `role='subtitles'`
   binding + its `.srt` media for the draft (idempotent) → return a cleared result
   (`id:'', srt:'', cueCount:0`).
4. **Validate (server-authoritative):**
   `const issues = validateCues(input.cues, { videoDurationMs: bundle.primary_video?.durationMs });`
   `const errors = issues.filter(i => i.severity === 'error');`
   if `errors.length` ⇒ `throw new HttpError('invalid_input','Sous-titres invalides.', { cueErrors: errors });` (E7/E8, 400). Warnings are returned but do not block.
5. **Canonicalize:** `const cues = sortAndReindex(input.cues);` `const srt = serializeSrt(cues);`
   (`sortAndReindex` sorts by `startMs`, re-assigns 1-based `index`).
6. **Write the `.srt` asset bytes:**
   `const buffer = Buffer.from(srt, 'utf-8');`
   `const media = await createMedia({ kind:'subtitles', source:'upload', slug:`content-studio-srt-${draft.id}-${createId().slice(0,8)}`, alt:'Sous-titres générés pour FemiGlow', originalFilename:`${draft.id}.srt`, originalMime:'application/x-subrip', originalSizeBytes: buffer.byteLength, status:'passthrough', overrides:{ contentStudio:{ origin:'ai_generated', role:'subtitles', provider, sourceDraftId: draft.id, promptVersion:'content-studio-subtitles-v0-2026-05-30' } }, createdBy: input.actorId });`
   `const sourceKey = `sources/${media.id}/${createId('src')}.srt`;`
   `await getStorage().put({ key: sourceKey, body: buffer, contentType:'application/x-subrip' });`
   (subtitles use `status:'passthrough'` — no image optimizer worker, like `generateVideoForDraft`).
7. **Bind by role with meta (D1):**
   `await upsertBundleAssets({ draftId: draft.id, assets:[{ mediaId: media.id, role:'subtitles', meta:{ srt, cueCount: cues.length, style: input.style, warnings: issues.filter(i=>i.severity==='warning').length } }] });`
   (`meta.srt` and the `.srt` asset bytes are byte-identical — data-model §7. Replaces
   the prior subtitles binding, never the primary video — E12.)
8. `await insertGenerationRun({ briefId: draft.briefId, provider, model: provider, promptVersion:'content-studio-subtitles-v0-2026-05-30', input:{ draftId: draft.id, cueCount: cues.length, style: input.style, mode }, output:{ mediaId: media.id, srtBytes: buffer.byteLength }, status:'succeeded', costCents: 0, errorMessage:null, createdBy: input.actorId });`
9. `await logAuditEvent({ action:'content_studio.subtitles.saved', actorId: input.actorId, resourceType:'media', resourceId: media.id, meta:{ draftId: draft.id, cueCount: cues.length, position: input.style.position } });`
10. Return the `SubtitlesResult` built from `media` + `cues` + `srt` + `style`.

> **Cost:** pure/rule-based ⇒ `0`. `refine` (openai:gpt-4o-mini) ⇒ token-based estimate
> identical to the existing text-generation pricing helper. Saving is always `0`.

## 4. Routes (MP-SU-04, MP-SU-05)

### 4.1 `POST …/drafts/[id]/generate-subtitles`

Exact file: `apps/web/src/app/api/admin/content-studio/drafts/[id]/generate-subtitles/route.ts`.
Mirrors `generate-visual/route.ts` 1:1.

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { subtitlesGenerationSchema } from '@/lib/content-studio/schemas';
import { generateSubtitlesForDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = subtitlesGenerationSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Payload sous-titres invalide.', parsed.error.flatten());
    const modeCookie = cookies().get('cs_generation_mode')?.value;
    const mode: 'mock' | 'live' = modeCookie === 'live' || modeCookie === 'mock' ? modeCookie : 'mock';
    const media = await generateSubtitlesForDraft({
      draftId: params.id, actorId: session.adminId,
      script: parsed.data.script, refine: parsed.data.refine, mode,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
```

### 4.2 `PUT …/drafts/[id]/subtitles`

Exact file: `apps/web/src/app/api/admin/content-studio/drafts/[id]/subtitles/route.ts`.
Same guards; body `subtitlesSaveSchema`. On success returns `{ media }`. (Optionally a
`GET` on the same path returns the current subtitles bundle; out of scope for the MVP —
the workspace loads the bundle.)

```ts
export async function PUT(request, { params }) {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = subtitlesSaveSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Sous-titres invalides.', parsed.error.flatten());
    const media = await saveSubtitlesForDraft({
      draftId: params.id, actorId: session.adminId,
      cues: parsed.data.cues, style: parsed.data.style,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
```

- `requireContentStudioEnabled()` short-circuits when Content-Studio is disabled; the
  **Media-Studio sub-flag** (`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, D6) gates UI and is
  re-checked in the service so a direct POST/PUT while the flag is off returns
  `403 forbidden` / `409 invalid_state` per `00_global`.
- Error envelope is `formatErrorResponse` → `{ error: { code, message, details } }`.

## 5. Schemas — `subtitlesGenerationSchema` + `subtitlesSaveSchema` (MP-SU-06)

Add to `src/lib/content-studio/schemas.ts`:

```ts
export const subtitlesGenerationSchema = z.object({
  script: z.string().trim().min(1).max(8000).optional(),
  refine: z.boolean().default(false),
}).strict();

const cueSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  lines: z.array(z.string()).min(1).max(2),   // SUBTITLE_LIMITS.MAX_LINES_PER_CUE
}).strict();

const burnInStyleSchema = z.object({
  font: z.enum(['sans', 'serif', 'mono']),
  sizePx: z.number().int().min(12).max(72),
  position: z.enum(['top', 'middle', 'bottom']),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  boxColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  boxOpacity: z.number().min(0).max(1).optional(),
}).strict();

export const subtitlesSaveSchema = z.object({
  cues: z.array(cueSchema).max(200),          // SUBTITLE_LIMITS.MAX_CUES; [] clears
  style: burnInStyleSchema,
}).strict();
```

- `.strict()` rejects unknown keys. The **structural** rules (overlap, ordering, CPS…)
  are NOT in zod — they are in `validateCues` (shared client/server) because they are
  cross-cue and severity-tiered; zod only guards shape and field bounds.

## 6. Compose consumer relationship (MP-SU-09, D5 — cross-ref `../02_compose`)

`composeNode` already reads `state.subtitles` (the SRT **string**) and records
`generationParams.hasSubtitles = Boolean(subtitles)` (`compose.ts` L42, L72, L136). The
per-draft Compose service (`composeDraftVideo`, `MP-CO-*`) builds `state` from the draft
**bundle**:

- `state.subtitles = getDraftBundle(draftId).subtitles?.meta.srt ?? null;`
- the burn-in **style** (`meta.style`) is passed to compose so it can build the ffmpeg
  `subtitles=…:force_style='…'` filter (the burn-in step `MP-CO-*` owns the ffmpeg
  filter; this feature supplies the SRT text + style contract).

This feature's responsibility ends at producing a valid SRT + a style record; the actual
burn-in (drawtext/subtitles filter) is implemented in `../02_compose`. The contract is
fixed here: **`meta.srt` (canonical SRT) + `meta.style` (`BurnInStyle`)**. No ffmpeg code
is written in this folder (D5).

## 7. Error matrix

| Condition | `HttpError` code | HTTP | Message (FR) |
|---|---|---|---|
| Bad payload (shape) | `invalid_input` | 400 | "Payload sous-titres invalide." / "Sous-titres invalides." |
| Structural cue errors on save (V1–V7) | `invalid_input` | 400 | "Sous-titres invalides." + `details.cueErrors` |
| Draft missing | `not_found` | 404 | (from `requireDraft`) |
| Non-video format | `invalid_state` | 409 | "Sous-titres réservés aux formats vidéo (Reel/Story)." |
| live + refine + no IA key | `invalid_state` | 409 | "Aucune clé IA configurée pour l’affinage…" |
| over budget (refine) | `budget_exceeded` | 429 | (from `checkDailyBudget`) |
| refine provider 5xx (live) | `upstream_failed` | 502 | "Échec de l’affinage des sous-titres." |
| not admin | `unauthorized`/`forbidden` | 401/403 | (from `requireAdminApi`) |

## 8. Concurrency / idempotency

`upsertBundleAssets` keyed by `(draftId, role='subtitles')` ⇒ last write wins; regenerate
& save replace the prior subtitles asset. No locking (single-operator admin tool). UI
buttons disable while `generating`/`saving` (E12).

## 9. Cross-refs

Data model / migration / `media_kind='subtitles'` / `meta_json` / `upsertBundleAssets` /
`role`: `MP-AR-*` (`../00_global`). Compose consumption of `role='subtitles'`:
`../02_compose` (`MP-CO-*`). Sequence: [`sequence.puml`](sequence.puml). Contract:
[`api-contract.yaml`](api-contract.yaml), [`data-contract.json`](data-contract.json).
