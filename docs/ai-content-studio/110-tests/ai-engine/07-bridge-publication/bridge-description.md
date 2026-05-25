# Bridge & Publication System — Detailed Description

**Module** : `src/lib/ai-engine/bridge/` + `src/app/api/admin/ai-engine/publish/`  
**Version** : 1.0.0-mvp  
**Date** : 2026-05-25

---

## 1. Overview

The Bridge & Publication system connects the AI Engine's generation pipeline to the Content Studio's content management system and the Postiz social publishing platform. It handles two core responsibilities:

1. **Bridge** -- Translating AI Engine generation outputs into Content Studio records (idea, brief, draft, generation run, asset bindings) so generated content appears in the existing library and editorial workflow.
2. **Publication** -- Pushing approved content from Content Studio to social media platforms (Instagram, Facebook, TikTok, etc.) via the Postiz integration, either immediately or on a schedule.

---

## 2. Bridge Mapping (AI Engine to Content Studio)

### Domain Model Translation

The AI Engine uses its own domain vocabulary. The bridge translates these into Content Studio's domain model:

#### Pillar Mapping (`PILLAR_MAP`)

| AI Engine `contentType` | Content Studio `ContentPillar` |
|---|---|
| rituel | rituel |
| produit | produit |
| preuve | preuve |
| journal | journal |
| maison | maison |
| reassurance | reassurance |
| saison | saison |
| coulisses | coulisses |
| *(default)* | produit |

#### Objective Mapping (`OBJECTIVE_MAP`)

| AI Engine `objective` | Content Studio `ContentObjective` |
|---|---|
| engagement | consideration |
| awareness | notoriete |
| conversion | conversion |
| education | consideration |
| entertainment | notoriete |
| *(default)* | consideration |

#### Platform Mapping (`PLATFORM_MAP`)

| AI Engine `platform` | Content Studio `ContentPlatform` |
|---|---|
| instagram | instagram |
| facebook | facebook |
| *(default)* | instagram |

#### Format Mapping (`FORMAT_MAP`)

| AI Engine `format` | Content Studio `ContentFormat` |
|---|---|
| post | post |
| story | story |
| reel | reel |
| carousel | carousel |
| *(default)* | post |

---

## 3. Idea / Brief / Draft Creation Flow

The `bridgeToContentStudio(result, request)` function creates a complete content record chain in 5 steps:

### Step 1 — Create `content_idea`

```typescript
const idea = await createIdea({
  pillar: mapPillar(request.contentType),
  objective: mapObjective(request.briefInput.objective),
  platform: mapPlatform(request.platform),
  format: mapFormat(request.format),
  prompt: request.briefInput.keyMessage,
  sourceType: 'ai-engine',
  sourceRef: result.jobId,
  actorId: null,
});
```

The idea is created with `sourceType: 'ai-engine'` and `sourceRef` pointing to the generation job ID, enabling traceability.

After creation, the idea status is immediately set to `'generated'` (skipping the normal `'idea'` -> `'briefed'` -> `'generated'` workflow since the AI Engine handles the entire flow).

### Step 2 — Create `content_brief`

```typescript
const brief = await createBrief({
  ideaId: idea.id,
  angle: hook || request.briefInput.keyMessage,
  proof: cta || null,
  cta: cta || 'Voir plus',
  mediaDirection: visualDirection ? JSON.stringify(visualDirection) : '',
  actorId: null,
});
```

The brief extracts the `hook` and `cta` from the generation result's `script` object. The `angle` field uses the hook (or falls back to `keyMessage`). The `mediaDirection` stores the visual direction as JSON.

### Step 3 — Create `content_draft`

```typescript
const drafts = await createDrafts([{
  briefId: brief.id,
  platform,
  format,
  variantLabel: 'ai-engine',
  caption: result.caption || '',
  hook: hook || null,
  cta: cta || null,
  hashtags: result.hashtags ?? [],
}]);
```

The draft contains the actual content (caption, hook, CTA, hashtags) that will be published. The `variantLabel: 'ai-engine'` distinguishes AI-generated content from manually created content.

If a quality score is available (`result.qualityScores.average`), it is stored on the draft as `scoreTotal` (scaled to 0-100).

### Step 4 — Bind Assets

If the generation produced real (non-mock) images with an `assetId`, the bridge calls `upsertPrimaryAsset({ draftId, mediaId })` to link the generated image to the draft.

This step is non-blocking -- if the media ID does not exist in the media table, the error is silently caught.

### Step 5 — Create `content_generation_run`

```typescript
await insertGenerationRun({
  ideaId: idea.id,
  briefId: brief.id,
  provider: 'ai-engine-langgraph',
  model: 'langgraph-v1',
  promptVersion: 'ai-engine-v1',
  input: { platform, format, keyMessage },
  output: { status, durationMs, qualityAvg },
  status: 'succeeded',
  costCents,
  errorMessage: null,
  createdBy: null,
});
```

The generation run provides an audit trail of which AI system produced the content, at what cost, and with what quality score.

### BridgeResult

```typescript
interface BridgeResult {
  ideaId: string;
  briefId: string;
  draftId: string;
}
```

This is returned to the generate API route and included in the response alongside a `contentStudioUrl` for navigating to the draft in the library UI:

```
/admin/content-studio-v2/library?highlight={draftId}
```

---

## 4. Asset Binding

The bridge handles asset binding for images generated by the pipeline:

1. Iterates through `result.images[]`
2. Filters out mock images (`provider.startsWith('mock')`)
3. For the first real image with an `assetId`:
   - Calls `upsertPrimaryAsset({ draftId, mediaId })` to associate the image with the draft
   - This makes the image visible in the Content Studio library alongside the caption and metadata

Asset binding is non-blocking and non-critical. If the media record does not exist yet (e.g., async upload in progress), the failure is silently caught and the draft is created without an attached image.

---

## 5. Generation Run Tracking

The `content_generation_run` table stores metadata about each AI generation:

| Field | Value | Purpose |
|---|---|---|
| `ideaId` | Bridge idea ID | Links to content idea |
| `briefId` | Bridge brief ID | Links to content brief |
| `provider` | `'ai-engine-langgraph'` | Identifies the generation system |
| `model` | `'langgraph-v1'` | Identifies the pipeline version |
| `promptVersion` | `'ai-engine-v1'` | Identifies the prompt template version |
| `input` | `{platform, format, keyMessage}` | Request summary |
| `output` | `{status, durationMs, qualityAvg}` | Result summary |
| `status` | `'succeeded'` | Generation outcome |
| `costCents` | From `costTracking.totalCents` | Total API cost in cents |
| `errorMessage` | null (or error string) | Error details if failed |
| `createdBy` | null | No specific actor (system) |

This table enables:
- Cost analytics per generation
- Quality tracking over time
- Audit trail for content provenance
- Performance monitoring (duration trends)

---

## 6. Postiz Publication Flow

The publication route (`/api/admin/ai-engine/publish`) handles two modes: immediate publication and scheduled publication.

### Common Preamble (Both Modes)

```
1. Authenticate admin session (requireAdminApi)
2. Validate payload (draftId, mode, optional scheduledAt)
3. Verify draft exists (getDraft)
4. Get or create content_post:
   a. Check if post already exists for draft (getPostForDraft)
   b. If not, approve the draft to create the post (approveContentDraft)
5. Sync social accounts (syncSocialAccounts)
   -> Creates/updates Postiz integration accounts
```

### Mode: `now` (Immediate Publication)

```
6. publishContentPostNow({ postId, actorId })
   -> Sends content to Postiz API for immediate publishing
   -> Returns: { job: { id, status }, result: { postizId, status } }

7. Response (201):
   {
     status: 'published',
     postId, draftId,
     job: { id, status },
     result: { postizId, status }
   }
```

### Mode: `schedule` (Deferred Publication)

```
6. Validate scheduledAt is present (required for schedule mode)
7. scheduleContentPost({ postId, scheduledAt, actorId })
   -> Creates a scheduled post in Postiz for future publishing
   -> Returns: { job: { id, status } }

8. Response (201):
   {
     status: 'scheduled',
     postId, draftId, scheduledAt,
     job: { id, status }
   }
```

### Validation Rules

| Rule | Error |
|---|---|
| Missing `draftId` | 400 `invalid_input` -- Payload de publication invalide |
| Missing `mode` | 400 `invalid_input` -- Payload de publication invalide |
| Invalid `mode` value | 400 `invalid_input` -- Payload de publication invalide |
| `mode: 'schedule'` without `scheduledAt` | 400 `invalid_input` -- La date de programmation est requise en mode planifie |
| Draft not found | 404 `not_found` -- Brouillon AI Engine introuvable |
| Auth failure | 401 `unauthorized` -- Session expiree |

### Postiz Integration

The Postiz integration is managed by the `social-publishing/admin-service` module:

- `syncSocialAccounts()` -- Ensures the Postiz API has the latest account configuration
- `publishContentPostNow()` -- Creates a Postiz post with immediate scheduling
- `scheduleContentPost()` -- Creates a Postiz post with a future `scheduledAt` timestamp

---

## 7. Integration Listing

The publication payload supports an optional `integrationIds` field to specify which social media integrations to publish to. When not provided, the system publishes to all configured integrations for the draft's platform.

### Supported Platforms via Postiz

Postiz supports 28+ channels. The AI Engine currently generates content for:

| Platform | Formats Supported | Publication Support |
|---|---|---|
| Instagram | post, story, reel, carousel | publish now, schedule |
| Facebook | post, story, reel, carousel | publish now, schedule |
| TikTok | reel, short | publish now, schedule |
| Pinterest | pin | publish now, schedule |
| YouTube | short | publish now, schedule |
| LinkedIn | post, article | publish now, schedule |
| Twitter/X | post | publish now, schedule |
| Threads | post | publish now, schedule |

### Publication Status Flow

```
Draft (AI Engine)
  -> Approved (approveContentDraft)
    -> Post Created (content_post)
      -> Published (Postiz API)    [mode: now]
      -> Scheduled (Postiz API)    [mode: schedule]
        -> Published (at scheduledAt)
```

### Error Handling

Publication errors are caught at the route level and returned as structured error responses:

```typescript
{ error: { code: ErrorCode, message: string, details?: unknown } }
```

Non-blocking errors (e.g., bridge failures during generation) are logged but do not prevent the generation result from being returned to the client.
