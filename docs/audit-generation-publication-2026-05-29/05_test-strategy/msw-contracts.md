# Contrats MSW des APIs externes — doublures fidèles au niveau réseau

> Baseline figée **2026-05-29**. Ces contrats sont dérivés des `04_domaines/*/contracts.yaml`, de `MEMORY.md` (Higgsfield) et des handlers existants (`apps/web/src/test/msw/`).
> **Règle d'or** : la doublure est calquée sur la **spec fournisseur réelle**, jamais sur l'implémentation actuelle (fausse — BUG-008/025/041). Tout est intercepté au **niveau réseau** par MSW 2.14.2 (`http`/`HttpResponse`), monté globalement avec `onUnhandledRequest: 'error'` (cf. `strategy.md` §4.2).
>
> Conséquence clé qui ferme M2 (cf. `strategy.md` §1) : **aucun handler n'est défini pour les endpoints synchrones inventés** (`/v1/videos/generate`, `/v1/images/generate`). Quand le code actuel les appelle, MSW lève « unhandled request » et **le test rougit** — c'est le filet qui révèle BUG-008/BUG-025.

---

## 0. Conventions

- Base URLs (overridables par option de handler, comme `postiz-handlers.ts` le fait déjà) :
  - OpenAI : `https://api.openai.com`
  - Higgsfield (réel) : `https://platform.higgsfield.ai`
  - Postiz (réel) : `https://postiz.lumiereacademy.com`
- Chaque handler expose : (a) un **happy path** par défaut, (b) des **variantes d'erreur** composables via `server.use(...)`, (c) un hook `onRequest(body)` pour **asserter la forme de requête** (auth header, payload).
- Les contract-tests (`strategy.md` §6) exercent le **vrai client** du code contre ces handlers ; un test rougit si le code n'envoie pas la bonne forme ou ne parse pas la bonne réponse.

---

## 1. OpenAI — Images (`/v1/images/generations`)

Utilisé par le flux create (`callOpenAiImage`, BUG-001) et le nœud `generate-images` (pipeline A). Le handler `openaiImageGenerationHandler` **existe déjà** et est correct — on le réutilise tel quel.

### Requête (forme attendue du code)
```
POST https://api.openai.com/v1/images/generations
Authorization: Bearer <OPENAI_API_KEY>          # cle resolue, len 164 ; rouge si vide (BUG-001)
Content-Type: application/json
{ "model": "gpt-image-1-mini", "prompt": "<>=12 chars>", "size": "1024x1536", "n": 1, "response_format": "b64_json" }
```

### Réponse nominale (200)
```json
{ "created": 1730000000,
  "data": [ { "b64_json": "<PNG base64>", "revised_prompt": "A FemiGlow product mock image" } ] }
```

### Variantes d'erreur (composables)
| Cas | HTTP | Corps | Finding visé |
|---|---|---|---|
| Clé invalide | 401 | `{ "error": { "code": "invalid_api_key", "type": "invalid_request_error" } }` | BUG-001, BUG-011 |
| Politique de contenu | 400 | `{ "error": { "code": "content_policy_violation", "type": "invalid_request_error" } }` | gestion d'erreur opérateur |
| Rate limit | 429 + `retry-after: 60` | `{ "error": { "code": "rate_limit_exceeded", "type": "rate_limit" } }` | retry/feedback |

> **Contract-test (BUG-001)** : le client `callOpenAiImage` doit envoyer `Authorization: Bearer <clé résolue>` ET parser `data[0].b64_json`. Rouge au gel si la clé n'est pas résolue (lecture brute `env.CONTENT_STUDIO_OPENAI_API_KEY` vide).

---

## 2. OpenAI — Chat completions / TTS (texte & voix-off)

### 2.1 Chat completions (`/v1/chat/completions`) — copywriting (BUG-005, BUG-018)
Le handler existant (`openaiHappyPathHandlers`) couvre le streaming SSE. **Ajout requis** : un handler **non-stream JSON** avec `response_format: { type: 'json_object' }` pour les nœuds `generate-script/caption/variants` (ces nœuds attendent un JSON parsable, jamais testé — BUG-018).

Requête :
```
POST /v1/chat/completions
{ "model": "gpt-4o-mini", "response_format": { "type": "json_object" }, "messages": [...] }
```
Réponse nominale (cas succès LLM, **manquant aujourd'hui** — ferme M3) :
```json
{ "id": "chatcmpl-msw", "model": "gpt-4o-mini",
  "choices": [ { "index": 0, "message": { "role": "assistant", "content": "{\"hook\":\"...\",\"scenes\":[...]}" }, "finish_reason": "stop" } ],
  "usage": { "prompt_tokens": 120, "completion_tokens": 240 } }
```
Variantes : `content` = **JSON malformé** (asserter le fallback typé) ; `finish_reason: 'length'` (truncation) ; 401/429/503 (existants).

### 2.2 TTS (`/v1/audio/speech`) — voix-off live (BUG-049)
```
POST /v1/audio/speech
{ "model": "gpt-4o-mini-tts", "voice": "alloy", "input": "<script>", "response_format": "mp3" }
```
Réponse nominale : `200`, `content-type: audio/mpeg`, corps = bytes MP3 (magic `ID3`/`FF FB`). Variante : 401 (clé absente) → le node doit peupler `state.errors`, pas logger « generated » sur un asset vide (MISS-011).

---

## 3. Higgsfield — ASYNC (submit + poll) — **le contrat critique**

> `MEMORY.md` (higgsfield-api-mismatch) + `generation-image/contracts.yaml` : la **vraie** API est `platform.higgsfield.ai`, auth `Authorization: Key KEY_ID:KEY_SECRET`, **asynchrone**. Le code au gel appelle des endpoints **synchrones inventés** — ces endpoints **n'ont volontairement aucun handler** (cf. préambule).

### 3.1 Auth (forme attendue, BUG-002)
```
Authorization: Key <KEY_ID>:<KEY_SECRET>
```
Rouge au gel : `AI_ENGINE_HIGGSFIELD_API_KEY` mono-partie (sans `:`) + `AI_ENGINE_HIGGSFIELD_API_SECRET` absent → `higgsfieldAuthHeader()` null. Le contract-test asserte qu'avec un credential complet le header est exactement `Key id:secret`.

### 3.2 Image — submit + poll (BUG-025, MISS-009)
```
POST https://platform.higgsfield.ai/v1/text2image/<model>
{ "prompt": "<>", "width": 1024, "height": 1536 }
-> 202 { "id": "req_abc123", "status": "queued" }

GET https://platform.higgsfield.ai/v1/requests/req_abc123/status
-> 200 { "id": "req_abc123", "status": "in_progress" }     # 1er poll
-> 200 { "id": "req_abc123", "status": "completed",
         "result": { "images": [ { "url": "https://cdn.higgsfield.ai/img/abc.png" } ] } }
```

### 3.3 Vidéo — submit + poll (BUG-008)
```
POST https://platform.higgsfield.ai/v1/image2video/<model>     # (ou /v1/text2video/<model>)
{ "prompt": "<>", "duration": 5 }
-> 202 { "id": "req_vid_1", "status": "queued" }

GET https://platform.higgsfield.ai/v1/requests/req_vid_1/status
-> 200 { "status": "in_progress" }
-> 200 { "status": "completed", "result": { "video": { "url": "https://cdn.higgsfield.ai/vid/1.mp4" } } }
```

### 3.4 Variantes d'erreur
| Cas | Forme | Finding |
|---|---|---|
| Auth invalide | `401 { "error": "invalid_credentials" }` | BUG-002 |
| Modèle inconnu | `404` sur `/v1/text2image/<bad>` | BUG-009, BUG-028 |
| Échec async | `GET .../status -> { "status": "failed", "error": "content policy violation" }` | BUG-010/032 (le client doit rejeter **proprement**, sans promesse orpheline) |
| Polling lent | N polls `in_progress` puis `completed` | BUG-008 (le polling synchrone 5 min dans le handler est non-fiable — F20) |

> **Contract-tests (BUG-008/025)** : (a) le code appelle `/v1/image2video/<model>` puis `/v1/requests/{id}/status` ; rouge au gel car il appelle `/v1/videos/generate` (non stubé → unhandled). (b) Le polling `failed` rejette sans laisser de promesse pendante (corrige BUG-010 au niveau test).

---

## 4. Postiz (`postiz.lumiereacademy.com`)

> `publication-postiz/contracts.yaml` : auth = `authorization: <clé brute>` (PAS `Bearer`). Les fixtures actuelles (`status:'SENT'`, `social.example.test`) sont **inventées** (BUG-045) et **réécrites** ici d'après la forme réelle. Le handler `postiz-handlers.ts` existe mais doit être aligné (base URL + champs).

### 4.1 Lecture — intégrations (PROUVÉ 200)
```
GET https://postiz.lumiereacademy.com/api/public/v1/integrations
authorization: <cle brute>
-> 200 [ { "id": "ig_123", "name": "FemiGlow IG", "providerIdentifier": "instagram", "picture": "..." }, ... ]   # 4 comptes IG reels
```

### 4.2 Upload média (multipart) — BUG-037
```
POST /api/public/v1/upload
authorization: <cle brute>
Content-Type: multipart/form-data ; file=<binaire>
-> 200 { "id": "media_1", "path": "https://postiz.../uploads/media_1.jpg" }
```
Variante : `415` (format non supporté), `413` (trop gros).

### 4.3 Création de post (`/api/public/v1/posts`) — BUG-037, BUG-045
Forme de requête attendue (à asserter via `onRequest`) :
```json
{ "type": "now",                               // now | schedule | draft
  "date": "2026-05-29T12:00:00.000Z",
  "tags": [ { "value": "femiglow", "label": "femiglow" } ],
  "posts": [ { "integration": { "id": "ig_123" },
              "value": [ { "content": "<caption>", "image": [ { "id": "media_1", "path": "https://..." } ] } ],
              "settings": { "__type": "instagram", "post_type": "post" } } ] }
```
Réponse nominale (forme **réelle**, pas `status:'SENT'`) :
```json
{ "id": "pz_post_1",
  "releaseURL": "https://www.instagram.com/p/Cxyz123/",
  "postId": "pz_post_1" }
```
> Le code extrait le permalien dans l'ordre `[releaseURL, release_url, permalink, url]` (`contracts.yaml`). Le contract-test asserte que cet ordre couvre la forme réelle.

### 4.4 Variantes d'erreur Postiz (mappées sur les codes `social_publish`)
| Cas | HTTP | Code interne attendu | Retryable |
|---|---|---|---|
| Token expiré | 401 | `token_expired` | non |
| Permission refusée | 403 | `permission_denied` | non |
| Média non public | 422 | `media_not_public` | non |
| Rate limit | 429 | `provider_rate_limited` | **oui** (withRetry, attempts=3) |
| Indispo amont | 503 | `provider_unavailable` | **oui** |
| Format non supporté | 422 | `unsupported_format` | non |
| Doublon | 409 | `duplicate_external_post` | non |

---

## 5. Harnais de parité dry_run ↔ Postiz (BUG-045, ferme M7)

Le comparateur de parité (`strategy.md` §9) asserte que `DryRunSocialPublishingAdapter` et `PostizSocialPublishingAdapter` (contre les handlers §4) produisent la **même forme** :

| Invariant comparé | dry_run au gel | Postiz réel (contrat) | Verdict |
|---|---|---|---|
| `status` | `published` | `published` | OK de forme |
| `permalink` | `social.example.test/instagram/draft/dry_<hash>` | `instagram.com/p/<id>` | **DIVERGENT → échec** (BUG-045) |
| `remoteId` | `dry_<sha256>` | `pz_post_1` | forme différente → à normaliser |
| `metadata.dryRun` | `true` | doit être `false` en live | **forcé true → échec** (BUG-065) |
| codes d'erreur | mappés | mappés (§4.4) | doivent coïncider |

Le test échoue tant que dry_run ne mime pas la **forme** Postiz (sans publier). C'est le filet qui rend la bascule dry_run→live sûre.

---

## 6. Endpoints VOLONTAIREMENT non stubés (le piège qui révèle M2)

Aucun handler ne répond sur ces chemins. Avec `onUnhandledRequest: 'error'`, tout appel les ciblant **fait échouer le test** — c'est le mécanisme qui ferme BUG-008/025/041/MISS-009 :

- `POST https://platform.higgsfield.ai/v1/videos/generate` (vidéo sync inventée)
- `GET  https://platform.higgsfield.ai/v1/videos/status/{id}` (poll sync inventé)
- `POST https://platform.higgsfield.ai/v1/images/generate` (image sync inventée)
- `https://api.higgsfield.ai/v1/*` (ancien host mort — MISS-019)

> Tant que le code appelle ces endpoints, les contract-tests sont rouges. Ils ne passeront au vert qu'après réécriture en async (§3) — preuve que le test mesure la réalité, pas le mock.
