# 05 — Gestion d'erreurs, observabilité, debuggabilité

Réponse directe à la question « les erreurs gérées, les erreurs non gérées correctement ». Synthèse croisée frontend + backend.

## 1. Les erreurs BIEN gérées (modèle à suivre)

| Chemin | Mécanisme | Référence |
|---|---|---|
| Toutes les routes API | `try/catch` → `formatErrorResponse` ; mapping code→HTTP cohérent (`invalid_state`/`conflict`→409, `invalid_input`→400, `upstream_failed`→502, `budget_exceeded`→429) ; non-HttpError → 500 `{code:'internal_error'}` **sans fuite de stack ni message interne** (vérifié) | `lib/errors/http-error.ts` |
| Échecs Postiz | Taxonomie `errorFromHttpStatus` (401→`token_expired`, 429→`rate_limited` retryable, 5xx→`provider_unavailable` retryable), payloads **redactés** (`redactProviderPayload`), `lastError {code,message,retryable}` persisté sur le job + attempts horodatés avec durée | `lib/social-publishing/errors.ts:69-84`, `repository.ts:419-452` |
| Frontend — fetch | **Aucune erreur avalée** : toast ou message inline systématique ; optimistic updates avec rollback (DnD calendrier `useCalendarDnD.ts:180-185`, archivage `LibraryClient.tsx:96-122`) ; autosave avec indicateur d'état | inventaire complet : `02-interface-ux.md` §6 |
| Génération texte sans clé / erreur provider | Fallback déterministe **tracé** (provider `'fallback'`, `errorMessage` stocké dans le `generation_run`, consultable via `/generation-runs`) — pas de crash | `generation.ts:32-62` |
| Upload média v2 | Machine à états idle/cropping/trimming/uploading/error avec écran d'erreur + bouton Réessayer | `Uploader.tsx:194-200` |

## 2. Les erreurs MAL gérées (à corriger)

| Constat | Sévérité | Référence |
|---|---|---|
| **Échec de génération image live = trou noir** : `Error` brut (`'CONTENT_STUDIO_OPENAI_API_KEY manquant'`, message OpenAI) → masqué en 500 « Erreur interne ». L'opérateur ne distingue jamais clé absente / quota / prompt refusé, et **aucun `generation_run` failed n'est enregistré** (run écrit seulement après succès, `service.ts:302`). Impossible de débugger a posteriori. | **Majeur** | `image-generation.ts:26-53` |
| **Job de publication zombie** : crash/erreur après le lock → job `publishing` avec `lockedAt` posé pour toujours, aucun reaper, **irréparable depuis l'UI** (le retry exige `locked_at IS NULL`). Cas réel reproductible : publier un post annulé → `assertTransition cancelled→published` lève après `createPublication`. | **Majeur** | `repository.ts:303-331`, `admin-service.ts:455-487` |
| **Patch d'autosave perdu** : `pendingRef` vidé avant le fetch ; en cas d'échec, l'UI dit « Échec — réessayer » mais le patch est déjà jeté — il n'y a rien à réessayer. | **Critique** (perte de saisie) | `StudioContext.tsx:247-249` |
| `JobQueue` : toast d'erreur répété à **chaque** poll de 30 s en cas de panne API — spam sans backoff ni message persistant | Majeur | `JobQueue.tsx:77-97` |
| Zod `.parse()` (au lieu de safeParse) sur `reject`, `posts/[id]/cancel`, queries `drafts`/`posts` : une ZodError ou un body absent → **500 « Erreur interne »** au lieu d'un 400 détaillé (ex. `reject` sans body JSON → `request.json()` rejette → 500) | Mineur | `drafts/[id]/reject/route.ts:17`, `posts/[id]/cancel/route.ts:17` |
| Format d'erreur de validation incohérent : `HttpError('invalid_input')` ici, `{error:{code:'validation', message: JSON.stringify(...)}}` là | Mineur | `campaigns/route.ts:36-39` |
| `learning-notes` avec `postId` inexistant → violation FK → 500 au lieu de 404 | Mineur | `schemas.ts:92` |
| Course `createPublishJob` (read-then-insert) rattrapée par l'unique mais rendue en 500 au lieu d'idempotence/409 | Mineur | `repository.ts:226-254` |
| Erreur d'hydratation du StudioContext jamais lue par le workspace (`loading`/`error` exposés, jamais consommés) | Majeur (latent) | `StudioContext.tsx:100-101` |

## 3. Observabilité / audit log

**Audités** (`logAuditEvent`) : idea.created/generated, visual.generated, draft.approved, postiz.draft_created (legacy), social.draft_created, legacy_route_used, 4 jobs automation.

**Non audités** : reject, cancel post, **reschedule**, archive (idea/draft/post), édition draft/brief, campagnes, **création du job publish-now/schedule**, retry/cancel de publish-job, **publication réussie en mode non-draft** (seul le mode draft est audité, `admin-service.ts:470-486`). Pour un outil qui publie sur les réseaux sociaux de clients, l'absence d'audit sur « qui a publié quoi quand » est une lacune notable.

## 4. Debuggabilité : peut-on reconstituer un incident ?

- **Publication échouée : OUI, très bien** — `social_publish_event` (created/publishing/failed…), `social_publish_attempt` avec request/response redactés + durée, `lastError` structuré, `logger.error('social.publish.failed')`, alerte webhook non bloquante, digest hebdo des échecs, `GET /publish-jobs/[id]` renvoie job+events+publications. C'est le point fort du système.
- **Génération échouée : NON** — pas de run failed (image), fallback silencieux (texte, tracé mais sans signal opérateur), pas de timeout dédié, le `health` ne dit pas si le provider live est opérationnel.
- Redaction : par clé (`token|secret|password…`, `repository.ts:121-131`) — ne couvre pas un secret incrusté dans une valeur string (mineur).

## 5. Synthèse

Le système a **un excellent demi-cercle d'observabilité** : tout ce qui touche la publication est traçable et debuggable ; tout ce qui touche la **génération** (la moitié amont du produit, et la plus coûteuse en argent) est soit silencieux, soit opaque. La priorité erreurs est : (1) runs `failed` + `HttpError('upstream_failed', cause)` sur la génération image, (2) reaper de jobs zombies, (3) restauration du pending d'autosave, (4) audit log sur les actions de publication.
