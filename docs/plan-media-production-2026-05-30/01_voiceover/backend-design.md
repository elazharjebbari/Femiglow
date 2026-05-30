# Voice-over — backend design

> Grounded in: `src/lib/ai-engine/nodes/generate-voiceover.ts`,
> `src/lib/content-studio/service.ts` (`generateVisualForDraft` ~L287),
> `src/app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts`,
> `src/lib/content-studio/provider-credentials.ts`,
> `src/lib/errors/http-error.ts`. Decisions D2/D3/D5. Prefix `MP-VO-*`.

## 1. Node reuse — extract `synthesizeVoiceover` (MP-VO-01, D5)

`generateVoiceoverNode(state)` is graph-coupled: it reads `state.script`,
`state.jobId`, `getEngineConfig()`, mutates `costTracking`, and emits graph
channels (`voiceover`, `voiceoverScript`, `currentStep`, `errors`). We extract the
**pure synthesis core** into a reusable function, then make the node a thin
adapter that still returns the same graph shape (zero behavior change → node
tests stay green).

```ts
// src/lib/ai-engine/nodes/generate-voiceover.ts  (additive export)
export type TtsProvider = 'openai' | 'elevenlabs' | 'mock';

export interface SynthesizeVoiceoverInput {
  /** Already-resolved narration text (caller may pass buildVoiceoverText(state)). */
  text: string;
  /** Correlation id for the file name (draftId in pipeline B, jobId in graph). */
  jobId: string;
  /** Which TTS engine to use. 'mock' => deterministic silent WAV, no network. */
  provider: TtsProvider;
  /** Required for openai/elevenlabs; undefined for mock. */
  apiKey?: string;
  /** live: throw on provider failure; graph/autonomous: fall back to silent. */
  onProviderError: 'throw' | 'silent_fallback';
  voice?: string;
}

export interface SynthesizeVoiceoverOutput {
  voiceover: MediaAsset;       // existing type from ../types/media
  text: string;                // possibly truncated
  costCents: number;
  degraded: boolean;           // true if silent fallback was used
  truncated: boolean;
}

export async function synthesizeVoiceover(
  input: SynthesizeVoiceoverInput,
): Promise<SynthesizeVoiceoverOutput>;
```

- `buildVoiceoverText`, `estimateDurationSeconds`, `generateSilentAudio`,
  `generateOpenAITTS`, `generateElevenLabsTTS` are reused verbatim (no ffmpeg/TTS
  reimplementation — D5). They are lifted to module scope (already are) and called
  by both the node and `synthesizeVoiceover`.
- **`mock` provider** ⇒ `generateSilentAudio` only ⇒ **no `fetch`**. This is the
  network-silence guarantee MSW asserts (`onUnhandledRequest:'error'`).
- **`onProviderError`**: the graph keeps `'silent_fallback'` (autonomous, must not
  crash the pipeline — preserves ACT-BE-015 behavior). The **per-draft service**
  passes `'throw'` so the operator sees a real error (E5).
- `generateVoiceoverNode` becomes: `const text = buildVoiceoverText(state);` →
  `synthesizeVoiceover({ text, jobId, provider: cfg.providers.tts.default, apiKey: …, onProviderError: 'silent_fallback' })`
  → re-assemble the exact graph return object (incl. the `errors` push on
  `degraded`). **Node `.test.ts` is unchanged and must stay green** (MP-VO-13).

## 2. Service — `generateVoiceoverForDraft` (MP-VO-02, D3)

New export in `src/lib/content-studio/service.ts`, mirroring
`generateVisualForDraft`'s shape.

```ts
export interface VoiceoverForDraftInput {
  draftId: string;
  actorId: string | null;
  /** Operator-edited narration. If omitted, derive from draft (buildVoiceoverText). */
  script?: string;
  voice?: string;
  mode?: 'mock' | 'live';
}

export interface VoiceoverResult {
  id: string;                 // media id
  draftId: string;
  role: 'voiceover';          // D1 bundle role
  kind: 'audio';              // D1 widened StudioV2MediaKind
  alt: string;
  slug: string;
  previewUrl: string;         // playable audio URL
  originalUrl: string;
  durationSec: number | null;
  provider: string;           // 'mock' | 'openai:tts-1' | 'elevenlabs:...'
  voice: string;
  costCents: number;
  createdAt: string;
}

export async function generateVoiceoverForDraft(
  input: VoiceoverForDraftInput,
): Promise<VoiceoverResult>;
```

### Algorithm

1. `const draft = await requireDraft(input.draftId);` (404 `not_found` if absent).
2. **Format gate** (E2): if `draft.format ∉ {'reel','story'}` →
   `throw new HttpError('invalid_state','Voix-off réservée aux formats vidéo (Reel/Story).')`.
3. `const mode = input.mode ?? 'mock';`
4. Resolve text: `const text = (input.script?.trim()) || buildVoiceoverTextFromDraft(draft);`
   (a small helper that builds the same narration string from the draft's script;
   blank ⇒ `'Le rituel FemiGlow.'`).
5. **Provider/credential resolution (mode-aware):**
   - `mock` ⇒ `provider='mock'`, `apiKey=undefined`, `estimate=0`.
   - `live` ⇒ resolve TTS engine from engine config (`openai`|`elevenlabs`), then
     `const apiKey = await resolveProviderCredential(ttsEngine);` (single source of
     truth — `provider-credentials.ts`). **If `!apiKey`** →
     `throw new HttpError('invalid_state','Aucune clé TTS configurée. Ajoutez une clé ou repassez en mode mock.')`
     **before any fetch / file write** (E4, 409).
6. `await checkDailyBudget(estimate);` (mock estimate `0`; live estimate from
   `text.length` using the node's cost formula). Over budget ⇒ 429.
7. `const out = await synthesizeVoiceover({ text, jobId: draft.id, provider, apiKey, onProviderError: 'throw', voice });`
   - In `live`, a provider 5xx becomes a thrown `Error`; the service wraps it:
     `throw new HttpError('upstream_failed','Échec du fournisseur TTS.', { cause })` (E5).
8. **Persist as a bundle asset (role='voiceover'):**
   - `createMedia({ kind:'audio', source:'upload', slug:`content-studio-vo-${draft.id}-${createId().slice(0,8)}`, originalMime: out.voiceover.mimeType, originalSizeBytes: out.voiceover.fileSizeBytes, originalDurationMs: out.voiceover.durationMs, originalUrl: out.voiceover.url, status:'passthrough', overrides:{ contentStudio:{ origin:'ai_generated', role:'voiceover', provider: out.voiceover.provider, sourceDraftId: draft.id, voice, script: text, promptVersion:'content-studio-voiceover-v0-2026-05-30' } }, createdBy: input.actorId })`
   - `await upsertBundleAsset({ draftId: draft.id, role:'voiceover', mediaId: media.id });`
     (the role-aware upsert defined by `MP-AR-*` in `00_global`; replaces the prior
     voice-over for the draft — E7. Falls back to `upsertPrimaryAsset` semantics
     scoped by role until `MP-AR-*` lands, but **never** overwrites the primary
     video).
9. `await insertGenerationRun({ briefId: draft.briefId, provider: out.voiceover.provider, model: provider==='mock'?'mock':ttsEngine, promptVersion:'content-studio-voiceover-v0-2026-05-30', input:{ draftId: draft.id, script: text, voice, mode, intendedProvider: provider }, output:{ mediaId: media.id, durationMs: out.voiceover.durationMs, truncated: out.truncated }, status:'succeeded', costCents: out.costCents, errorMessage: null, createdBy: input.actorId });`
10. `await logAuditEvent({ action:'content_studio.voiceover.generated', actorId: input.actorId, resourceType:'media', resourceId: media.id, meta:{ draftId: draft.id, provider: out.voiceover.provider, voice, mode } });`
11. Return the `VoiceoverResult` built from `media` + `out` (no dependency on the
    image worker / `listContentStudioMedia` — like `generateVideoForDraft`, audio
    uses `status:'passthrough'`).

**Cost:** `mock` ⇒ `0`. `openai:tts-1` ⇒ `(min(len,4096)/1_000_000)*1500` cents.
`elevenlabs` ⇒ `(min(len,5000)/1000)*3` cents. (Identical formulas to the node.)

## 3. Route — `POST /api/admin/content-studio/drafts/[id]/generate-voiceover` (MP-VO-03)

Exact file: `apps/web/src/app/api/admin/content-studio/drafts/[id]/generate-voiceover/route.ts`.
Mirrors `generate-visual/route.ts` 1:1.

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { voiceoverGenerationSchema } from '@/lib/content-studio/schemas';
import { generateVoiceoverForDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = voiceoverGenerationSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload voix-off invalide.', parsed.error.flatten());
    }
    const modeCookie = cookies().get('cs_generation_mode')?.value;
    const mode: 'mock' | 'live' =
      modeCookie === 'live' || modeCookie === 'mock' ? modeCookie : 'mock';
    const media = await generateVoiceoverForDraft({
      draftId: params.id,
      actorId: session.adminId,
      script: parsed.data.script,
      voice: parsed.data.voice,
      mode,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
```

- `requireContentStudioEnabled()` also short-circuits when the Content-Studio
  feature is disabled; the **Media-Studio sub-flag**
  (`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, D6) gates UI rendering and is re-checked
  in the service (cheap guard) so a direct POST while the flag is off returns
  `403 forbidden` / `409 invalid_state` per `00_global`.
- Response envelope on error is `formatErrorResponse` → `{ error: { code, message, details } }`.

## 4. Schema — `voiceoverGenerationSchema` (MP-VO-04)

Add to `src/lib/content-studio/schemas.ts`:

```ts
export const voiceoverGenerationSchema = z
  .object({
    script: z.string().trim().min(1).max(4000).optional(),
    voice: z.enum(['mock', 'nova', 'alloy', 'shimmer', 'bella']).default('mock'),
  })
  .strict();
```

`.optional()` on `script` lets the server derive narration from the draft; an
**explicit empty** string is rejected by `.min(1)` (E5/E8 in functional-spec).
`.strict()` rejects unknown keys (no silent acceptance of stray fields).

## 5. Error matrix

| Condition | `HttpError` code | HTTP | Message (FR) |
|---|---|---|---|
| Bad payload | `invalid_input` | 400 | "Payload voix-off invalide." |
| Draft missing | `not_found` | 404 | (from `requireDraft`) |
| Non-video format | `invalid_state` | 409 | "Voix-off réservée aux formats vidéo (Reel/Story)." |
| live + no key | `invalid_state` | 409 | "Aucune clé TTS configurée…" |
| over budget | `budget_exceeded` | 429 | (from `checkDailyBudget`) |
| provider 5xx (live) | `upstream_failed` | 502 | "Échec du fournisseur TTS." |
| ffmpeg missing (mock) | `upstream_failed` | 502 | "Génération audio indisponible (ffmpeg)." |
| not admin | `unauthorized`/`forbidden` | 401/403 | (from `requireAdminApi`) |

## 6. Concurrency / idempotency

`upsertBundleAsset` keyed by `(draftId, role='voiceover')` ⇒ last write wins;
regenerate replaces. No locking needed (single-operator admin tool). The UI
button is disabled while `generating` (E10).

## 7. Cross-refs

Data model / migration / `upsertBundleAsset` / `role` column: `MP-AR-*`
(`../00_global`). Compose consumption of `role='voiceover'`: `../02_compose`.
Sequence: [`sequence.puml`](sequence.puml). Contract: [`api-contract.yaml`](api-contract.yaml),
[`data-contract.json`](data-contract.json).
