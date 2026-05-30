# Transverse — Parcours operateur UI (create) + desync UI/etat

## Synthèse

## Parcours operateur UI (create) — verdict mock/live

Le parcours **MOCK est globalement fonctionnel** de bout en bout au niveau API+assets (cadrer -> idee -> variantes -> generer media image/video -> approuver -> publier dry_run), preuve a l'appui (generate-visual mock renvoie un media `ready` avec thumbnail AVIF servi en 200; mock reel MP4 `/_media/content-studio/mock/reel-9x16.mp4` existe et se sert en 200 video/mp4 62KB).

Le parcours **LIVE est casse pour la generation media**, mais PAS pour la raison annoncee dans le brief. Le brief affirmait "toutes les cles OpenAI vides => discovery inerte". REALITE verifiee: une cle generique `OPENAI_API_KEY` (sk-proj-...) est presente. La discovery live l'utilise (`resolveApiKey` la trouve en 4e position) et renvoie **106 modeles "chat" live**, **18 image**, **13 video**. MAIS la generation image/video lit `env.CONTENT_STUDIO_OPENAI_API_KEY` EN DIRECT (vide) -> throw `invalid_state` HTTP 409. Idem Higgsfield (credential sans secret). C'est le coeur du decalage: **le picker propose des modeles live qui throwent tous a l'usage**.

Desyncs majeurs prouves:
1. **role=chat renvoie whisper-1, omni-moderation, sora-2, gpt-realtime, gpt-audio** — modeles STT/moderation/video/audio dans un picker de texte (IntentionForm `role="chat"`). L'operateur peut "choisir" `whisper-1` comme modele de redaction.
2. **Modeles Higgsfield discovery (`flux_2`, `veo3_1`...) marques `source:live` (badge vert "Live")** alors que discovery=`fallback` et credential incomplet -> 100% throwent.
3. **Generation de texte/variantes ignore TOTALEMENT le cookie `cs_generation_mode`** et tombe silencieusement sur `deterministic-template` (provider `fallback`) sans cle, sans aucune erreur. En "live", l'operateur croit avoir du texte IA: c'est un template.
4. **Toggle Mock/Live UI defaut = 'mock'** (prop `envDefault='mock'`) alors que health renvoie `mockMode:false` (env). Incoherence d'etat affiche.
5. **`formatError` ecrase le message serveur utile par un message generique** ("Etat de draft invalide") pour le code `invalid_state` retourne par approve sans media — l'operateur perd l'instruction precise du serveur.

E2E: 2 echecs reels (37/39). `create-mock-video.spec.ts:8` timeout car le test clique `/Générer un visuel IA/i` mais le bouton dit "Générer une vidéo IA" en mode video. `content-studio-social-publishing-draft.spec.ts` casse sur `relation "audit_event" does not exist` (table reelle = `audit_events`).

## Spécification (optimal attendu)

# Parcours operateur UI (create) — Fonctionnement OPTIMAL attendu

## Vue d'ensemble
Page `/admin/content-studio-v2/create`: layout 3 colonnes (Intention | MediaStudio+Caption | Preview) + Stepper en haut + PublishActionGroup en bas. State global via `StudioProvider`. Parcours lineaire: **Cadrer -> Générer -> Visuel -> Valider -> Publier**.

## Etape 1 — Cadrer (IntentionForm)
- L'operateur choisit Format (post/story/reel/carousel), Pilier, Objectif, Plateforme, redige l'Intention (prompt) et choisit un **modele de texte**.
- Le ModelPicker `role=chat` ne doit lister QUE des modeles de redaction (chat completion), jamais whisper/sora/tts/moderation/embedding.
- Le modele suggere doit etre coherent avec le format et reellement utilisable.
- "Enregistrer l'idée" -> POST /ideas -> idee creee.

## Etape 2 — Générer (variantes)
- Apres creation, POST /ideas/:id/generate produit N variantes (drafts).
- **Le mode (mock/live) doit etre honore**: en live avec cle => texte LLM reel; en mock ou sans cle => template clairement etiquete.
- Le badge 'Généré par {model} · {provider}' doit refleter la realite (ne pas annoncer un modele IA si c'est un template).
- En cas d'echec (budget, provider down): toast d'erreur actionnable + possibilite de retry. Jamais d'idee creee silencieusement sans variantes.

## Etape 3 — Visuel (MediaStudio)
- Toggle Mock/Live coherent avec l'env serveur (une seule source de verite).
- Type de media: video active uniquement pour reel/story; image sinon. Le bouton porte un libelle explicite (Générer un visuel/une vidéo IA).
- Le ModelPicker (role=image|video) ne propose que des modeles **reellement generables** dans la config courante. Le badge 'Live' n'apparait que pour un provider avec credential generation-ready.
- Generer:
  - **Mock**: renvoie un asset ready (image AVIF/PNG pleine def ou MP4 mock lisible), apercu fidele.
  - **Live**: appelle le provider reel; en cas de cle manquante, le modele concerne ne doit PAS etre proposable, ou l'erreur doit etre claire et actionnable (pas un message qui fuit des noms d'env vars).
- EstimatorBar pendant la generation; toast succes/erreur.

## Etape 4 — Valider (ApproveButton)
- Bouton actif seulement si: draft selectionne + media attache + caption non vide + pas de blocage brand + pas deja approuve.
- POST /drafts/:id/approve cree le content_post; en erreur, message serveur precis et actionnable (ex: 'Attachez un visuel').
- A l'approbation, le post est pousse dans le state -> PublishActionGroup se debloque immediatement.

## Etape 5 — Publier (PublishActionGroup)
- 3 actions: Publier maintenant / Programmer / Brouillon Postiz, chacune avec dialog de confirmation + ConfirmPreview (vignette pleine def, caption tronquee, plateforme/format, badge mock).
- Respecte SOCIAL_PUBLISHING_MODE (dry_run par defaut). Toast succes suffixe '(mock)' si mode mock.
- Erreurs serveur mappees en messages lisibles (budget, brand, no_account...).

## Autosave / Etat
- CaptionEditor autosave debounce 1.5s; indicateur idle/saving/saved/error/session_expired.
- 401 => indicateur 'Session expirée' avec lien reconnexion.
- L'etat UI optimiste (variantes, post approuve) doit toujours etre confirme par le backend; pas de divergence entre toggle, badge et comportement reel.

## État réel constaté

# Etat REEL constate (preuves)

## Env staging verifie (pm2 env 0)
- `CONTENT_STUDIO_V2_MOCK_MODE` NON defini => health renvoie `mockMode:false`.
- `CONTENT_STUDIO_OPENAI_API_KEY` = **vide**; `CHAT_OPENAI_API_KEY` non liste (vide); `AI_ENGINE_OPENAI_API_KEY` non liste.
- **`OPENAI_API_KEY` = `sk-proj-...` PRESENT** (contredit le brief qui annoncait toutes les cles vides).
- `AI_ENGINE_HIGGSFIELD_API_KEY` = `hf_...` present mais SANS `:` et SANS `AI_ENGINE_HIGGSFIELD_API_SECRET` => credential incomplet.
- `CONTENT_STUDIO_IMAGE_PROVIDER=mock`, `CONTENT_STUDIO_IMAGE_MODEL=gpt-image-1-mini`, budget=500c.
- `POSTIZ_*` presents; SOCIAL_PUBLISHING_MODE non defini => dry_run.

## Probes API (curl authentifie, build prod 127.0.0.1:8012)
- `GET /content-studio/health` (auth) => 200 `{mockMode:false}`; sans auth => 401.
- `GET /models?role=chat` => **106 modeles** source=live (dont whisper-1, sora-2, omni-moderation, gpt-realtime, gpt-audio, davinci-002), suggested=gpt-4o-mini. discovery openai='live'.
- `GET /models?role=image` => 18 modeles tous live (gpt-image-1-mini suggested + flux_2/gpt_image_2/seedream Higgsfield), discovery higgsfield='fallback'.
- `GET /models?role=video` => 13 modeles (veo3_1, kling3_0... source=live malgre discovery higgsfield='fallback'), suggested=mock-video-1.0.
- `POST generate-visual cs_generation_mode=mock kind=image` => **200**, media ready, previewUrl AVIF sm servie en 200 (1.7KB), originalUrl=null.
- `POST generate-visual cs_generation_mode=mock kind=video` (reel) => **200**, kind=video durationMs=5000 previewUrl=/_media/content-studio/mock/reel-9x16.mp4 1080x1920; MP4 servi en **200 video/mp4 62790 octets**.
- `POST generate-visual cs_generation_mode=live model=gpt-image-1-mini` => **409 invalid_state** 'CONTENT_STUDIO_OPENAI_API_KEY manquant'.
- `POST generate-visual cs_generation_mode=live model=hf-flux-pro` => **409 invalid_state** 'credential Higgsfield incomplet'.
- `POST generate-visual cs_generation_mode=live model=hf-video-turbo` => **409 invalid_state** 'credential Higgsfield incomplet'.
- `POST drafts/<needs_review sans media>/approve` => **409 invalid_state** 'Un visuel doit être associé avant approbation...'.
- `GET /generation-runs?limit=0` => budget {500,0,500}.
- DB staging: `to_regclass('public.audit_event')` = NULL (f), `audit_events` existe (t).

## Tests (preuves /tmp)
- vitest: 1695/1695 passed, 0 failed, mais **VITEST_EXIT=1** (Unhandled Rejection 'Higgsfield video failed: content policy violation' dans video-generation.test.ts) — rapport tout-vert masquant un echec process.
- playwright: **37 passed / 2 failed**:
  - `create-mock-video.spec.ts:8` timeout 30s ligne 28 (clic '/Générer un visuel IA/i' alors que le bouton dit 'Générer une vidéo IA' en mode video). Backend video mock OK (verifie).
  - `content-studio-social-publishing-draft.spec.ts:25` PostgresError relation "audit_event" does not exist (seed/cleanup ligne 227). Table reelle = audit_events.

## Verdict par mode
- **MOCK**: parcours create operationnel cote API (idee->variantes template->media image/video mock->approve gating->publish dry_run). Variantes texte = template (meme en 'mock').
- **LIVE**: generation MEDIA cassee (OpenAI image + tout Higgsfield throw invalid_state). Generation TEXTE silencieusement degradee en template (cookie ignore). Discovery live active mais trompeuse (modeles non-generables proposes avec badge Live). => LIVE = broken/partial, jamais 'works'.

## Contrats

```yaml
domain: create-ui-flow
description: Contrat E/S du parcours operateur UI create + desync UI/etat.

endpoints:
  - id: health
    method: GET
    path: /api/admin/content-studio/health
    auth: admin_session (401 sinon)
    output: { mode: string, enabled: bool, version: string, mockMode: bool }
    notes: mockMode reflete env CONTENT_STUDIO_V2_MOCK_MODE (actuellement false). N'est PAS synchronise avec le toggle UI (cookie, defaut mock).

  - id: models
    method: GET
    path: /api/admin/content-studio/models?role={chat|image|video}&format={post|story|reel|carousel}
    auth: admin_session
    output:
      models: ModelEntry[]   # source in {static,cache,live}
      suggested: ModelEntry|null
      providers: ProviderInfo[]
      discovery: { openai: live|cache|no-key|error|fallback, higgsfield: ..., anthropic: ... }
    real_behavior:
      - "role=chat: 106 modeles live, pollue par whisper/sora/moderation/realtime/audio (BUG)"
      - "Higgsfield discovery=fallback mais modeles materialises source=live (badge Live trompeur)"
      - "Resolution cle = resolveApiKey() => trouve OPENAI_API_KEY generique (different de la cle utilisee par generate-visual)"

  - id: ideas_create
    method: POST
    path: /api/admin/content-studio/ideas
    input: { campaignId, pillar, objective, platform, format, prompt, model? }
    output: { idea: ContentIdea } | { error: {code,message} }
    notes: model accepte z.string().min(1).max(120) sans validation contre le registre.

  - id: ideas_generate
    method: POST
    path: /api/admin/content-studio/ideas/{id}/generate
    input: { model? }
    output: { drafts: ContentDraft[], runs?: [{model,provider,costCents}] }
    real_behavior:
      - "Ignore cookie cs_generation_mode (mode-agnostique)"
      - "Sans cle OpenAI: fallbackGeneration => provider=fallback, model=deterministic-template, AUCUNE erreur"

  - id: generate_visual
    method: POST
    path: /api/admin/content-studio/drafts/{id}/generate-visual
    input: { prompt, size, quality, kind: image|video, model? }
    cookies: { cs_generation_mode: mock|live (defaut serveur mock si absent) }
    output: { media: {id,alt,kind,previewUrl,thumbUrl,originalUrl,width,height,durationMs} } | { error:{code,message} }
    error_codes:
      invalid_input: 400/422 (payload zod invalide)
      invalid_state: 409 (mode live + cle/credential manquant: OpenAI ou Higgsfield)
      not_found: 404 (draft introuvable)
    real_behavior:
      mock: "200, image AVIF (originalUrl null) ou MP4 mock (reel/story) lisible"
      live_openai: "409 invalid_state — CONTENT_STUDIO_OPENAI_API_KEY vide (lit env direct, PAS resolveApiKey)"
      live_higgsfield: "409 invalid_state — credential incomplet (KEY_ID:KEY_SECRET requis)"

  - id: draft_approve
    method: POST
    path: /api/admin/content-studio/drafts/{id}/approve
    output: { post: ContentPost } | { error:{code,message} }
    error_codes:
      invalid_state: 409 (pas de media / etat invalide) — message serveur precis ECRASE par formatError (mapping generique)
    notes: l'UI documente no_media_attached mais le serveur renvoie invalid_state.

  - id: publish_actions
    method: POST
    paths:
      now: /api/admin/content-studio/posts/{id}/publish-now
      schedule: /api/admin/content-studio/posts/{id}/schedule
      draft: /api/admin/content-studio/posts/{id}/draft-on-provider
    notes:
      - "PublishActionGroup endpointFor() pointe sur publish-now/schedule/draft-on-provider"
      - "SOCIAL_PUBLISHING_MODE non defini => dry_run (publication simulee)"
      - "draft-on-provider/postiz-draft appelle logAuditEvent -> table audit_events (existe en staging)"

state_sources_of_truth:
  generation_mode_toggle: "cookie cs_generation_mode + localStorage; defaut UI 'mock' (MediaStudio ne passe pas envDefault)"
  mock_badge: "StudioContext.mockMode <- health.mockMode (env) = false"
  divergence: "toggle (mock) != badge (false) — non synchronises"

ui_error_mapping:
  source: src/lib/content-studio-v2/errors/messages.ts
  rule: "mapped[code] prioritaire sur message serveur (ecrase les messages contextuels pour invalid_state)"
```
