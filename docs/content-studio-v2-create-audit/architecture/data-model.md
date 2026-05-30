# Data Model — Content Studio v2

> Source : `apps/web/src/lib/db/schema-content-studio.ts`, `apps/web/src/lib/db/schema.ts`, `apps/web/src/lib/content-studio/types.ts`

## Tables principales

### `content_campaign`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| name | text | |
| objective | text | enum draft/active/archived |
| status | text | |
| startsAt, endsAt | timestamptz | |
| createdBy | uuid FK admin_users | |
| createdAt, updatedAt | timestamptz | |

### `content_idea`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| campaignId | uuid FK | nullable |
| pillar | text | enum ContentPillar |
| objective | text | enum ContentObjective |
| platform | text | enum ContentPlatform |
| format | text | enum ContentFormat |
| prompt | text | 8-2000 chars |
| sourceType | text | ai\|trend\|manual\|… |
| sourceRef | text | |
| rejectionReason | text | nullable |
| status | text | enum ContentStatus |
| createdBy | uuid FK | |
| createdAt, updatedAt | timestamptz | |

### `content_brief`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| ideaId | uuid FK CASCADE | |
| angle, proof, cta, mediaDirection | text | |
| constraints | jsonb | platform-specific |
| version | int | UNIQUE (ideaId, version) |
| createdBy | uuid FK | |
| createdAt | timestamptz | |

### `content_draft`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| briefId | uuid FK CASCADE | |
| platform | text | denorm pour query speed |
| format | text | denorm |
| variantLabel | text | "A", "B", "C", … |
| caption, hook, cta, altText | text | |
| hashtags | jsonb | array of string |
| status | text | enum ContentStatus |
| rejectionReason | text | |
| parentDraftId | uuid FK self | variation tree |
| scoreTotal | int | from brand review |
| editedBy | uuid FK | last editor |
| createdAt, updatedAt | timestamptz | |

### `content_asset_binding`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| draftId | uuid FK CASCADE | |
| mediaId | uuid FK media RESTRICT | |
| role | text | 'primary' (unique with draftId) |
| crop | jsonb | { x, y, w, h, ratio } |
| createdAt | timestamptz | |

### `content_generation_run`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| ideaId | uuid FK | |
| briefId | uuid FK | |
| provider | text | openai\|anthropic\|google\|mock\|fallback |
| **model** | text | identifiant modèle (logué, pas piloté par UI aujourd'hui) |
| promptVersion | text | semver-like |
| input | jsonb | params envoyés |
| output | jsonb | extrait normalisé |
| status | text | succeeded\|failed\|fallback |
| costCents | int | |
| errorMessage | text | |
| createdBy | uuid FK | |
| createdAt | timestamptz | |

### `content_brand_review`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| draftId | uuid FK CASCADE | |
| status | text | pass\|warning\|blocked |
| scoreTotal | int | 0-100 |
| score | jsonb | dict par dimension |
| violations | jsonb | [{ severity, rule, message }] |
| reviewerId | uuid FK | |
| reviewType | text | auto\|manual |
| rulesVersion | text | |
| createdAt | timestamptz | |

### `content_post`
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | **postId surfacé en UI** |
| draftId | uuid FK CASCADE | |
| status | text | approved\|scheduled\|published\|… |
| scheduledAt | timestamptz | nullable |
| publishedAt | timestamptz | nullable |
| utm | jsonb | |
| approvedBy | uuid FK | |
| cancelledBy | uuid FK | |
| cancelledAt | timestamptz | |
| cancelReason | text | |
| createdAt, updatedAt | timestamptz | |

### `content_postiz_delivery`
Trace des livraisons Postiz par post. Voir schema.

### `content_performance_snapshot`
Métriques post-publication. Hors scope create.

### `media` (table générique)
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| kind | text | image\|video |
| source | text | uploaded\|ai_generated\|stock |
| slug | text | |
| originalUrl, originalFilename, originalMime | text | |
| originalWidth, originalHeight | int | |
| originalDurationMs | int | nullable (vidéo) |
| phash, blurhash | text | |
| palette | jsonb | |
| alt, caption, credit | text | |
| status | text | ready\|processing\|failed |
| failureReason | text | |
| isHero | boolean | |
| overrides | jsonb | |
| createdBy | uuid FK | |
| createdAt, updatedAt, deletedAt | timestamptz | |

⚠ **media n'a PAS de colonne tracking le modèle d'IA générateur.** Cette information se retrouve dans `content_generation_run.model` lié indirectement via `output.mediaId`.

## Enums (types.ts)

- `ContentPillar` : rituel, produit, preuve, journal, maison, reassurance, saison, coulisses
- `ContentObjective` : notoriete, consideration, conversion, reassurance, fidelisation
- `ContentPlatform` : instagram, facebook
- `ContentFormat` : post, story, reel, carousel
- `ContentStatus` : idea, brief, generated, needs_review, approved, scheduled, published, failed, cancelled, rejected, archived, measured
- `BrandReviewStatus` : pass, warning, blocked

## Tables à ajouter (proposées)

### `content_draft_versions` (backlog Phase 9 — versioning autosave)
| Col | Type | Notes |
|-----|------|-------|
| id | uuid PK | |
| draftId | uuid FK CASCADE | |
| versionNumber | int | UNIQUE (draftId, versionNumber) |
| snapshot | jsonb | { caption, hook, cta, hashtags, altText, mediaId } |
| createdBy | uuid FK | |
| createdAt | timestamptz | |
| INDEX | (draftId, createdAt DESC) | retrieval |

### Modèle registry (config statique, pas DB)
- Fichier `lib/content-studio-v2/models/registry.ts`
- Pas de table DB (config versionnée). Extensible vers DB ultérieurement si besoin per-org.

## Index recommandés (existants ou à vérifier)

- `content_draft (briefId, createdAt DESC)` → liste variantes
- `content_post (draftId)` → lookup postId
- `content_generation_run (briefId, createdAt DESC)` → audit
- `content_asset_binding (draftId, role)` UNIQUE → 1 primary par draft

## Contraintes d'intégrité

- Approve échoue si :
  - draft.status not in {needs_review, generated}
  - asset_binding (role=primary) absent
  - brand_review.status = 'blocked'

- Publish (now/schedule/draft-on-provider) échoue si :
  - post.status not in {approved, scheduled}
  - aucun compte connecté pour la plateforme (si schedule/now)
