# Etat reel constate — Generation Image

## Environnement verifie (process PM2 pid 3603311, lu via /proc/3603311/environ, masque)
- `CONTENT_STUDIO_OPENAI_API_KEY` = **EMPTY**
- `OPENAI_API_KEY` = **SET** (prefix `sk-`, len 164, valide cote discovery)
- `CONTENT_STUDIO_IMAGE_PROVIDER` = `mock`, `CONTENT_STUDIO_IMAGE_MODEL` = `gpt-image-1-mini`
- `AI_ENGINE_HIGGSFIELD_API_KEY` = SET (prefix `hf_`, **sans `:`**), `AI_ENGINE_HIGGSFIELD_API_SECRET` = **absent**
- `AI_ENGINE_DEFAULT_IMAGE_PROVIDER` = `openai`, `AI_ENGINE_DEFAULT_IMAGE_MODEL` = `gpt-image-1`
- `GOOGLE_AI_PROVIDER_KEY` = SET (AIz...)

## MOCK — works (exerce)
POST sanctionne `cs_generation_mode=mock` sur draft `cd_pwd_1780079694294_msqqp0` (format post), model=gpt-image-1-mini:
- Reponse: media `me_bfuql6ua52l7v2y9`, kind=image, status=**ready**, 1024x1536, previewUrl `/_media/media/me_bfuql6ua52l7v2y9/avif/sm.avif`.
- Asset servi: HTTP 200, content-type image/avif, 1772 bytes.
- generation_run: `provider=mock model=mock-low-cost-image status=succeeded cost=0` (modele selectionne IGNORE).
- Budget: dailyBudgetCents=500, dailySpentCents=0.
- E2E Playwright golden-path image (mock) PASS: `<img src="/_media/media/me_uu3.../avif/sm.avif">` visible.

## LIVE — broken (deterministe par code + env)
Aucun POST live exerce (limite a 1 POST mock par le perimetre). Determinisme du code:
- gpt-image-* live -> image-generation.ts step4 -> `!env.CONTENT_STUDIO_OPENAI_API_KEY` (vide) -> throw invalid_state (HTTP 409), AUCUN appel reseau. La cle OPENAI_API_KEY valide du process n'est PAS lue par ce chemin.
- hf-* live -> step3 -> `higgsfieldAuthHeader()` null (cle sans secret) -> throw 409.
- id decouvert (flux_2...) ou custom live -> step5 -> OpenAI default -> cle vide -> 409.
- Meme avec credential complet, endpoints Higgsfield synchrones faux (image-generation.ts:171 `/v1/images/generate`; video-generation.ts:157 `/v1/videos/generate`).

## Picker — desync confirme (exerce)
GET `/api/admin/content-studio/models?role=image`:
- `discovery = {openai:'live', higgsfield:'fallback', anthropic:'no-key'}`
- 6 modeles OpenAI source=live (gpt-image-1, gpt-image-1-mini, gpt-image-1.5, chatgpt-image-latest, gpt-image-2, gpt-image-2-2026-04-21) — NON generables via flux create (cle differente).
- 8 modeles Higgsfield source=live (flux_2, flux_kontext, cinematic_studio_2_5, text2image_soul_v2, gpt_image_2, seedream_v5_lite, nano_banana_2, image_auto) — proviennent du FALLBACK statique (discovery=fallback) mais mal-etiquetes 'live'.
- suggested = gpt-image-1-mini source=live (non generable en live).
GET `?role=video`: meme pathologie (veo3_1, kling3_0... source=live alors que discovery.higgsfield=fallback); suggested=mock-video-1.0 (correct).

## Deux systemes paralleles
- Flux operateur = systeme B (`generateStudioImage`). 
- Noeud LangGraph `generateImagesNode` (systeme A) non atteint par le flux create (bridge ne l'appelle pas; seul `/api/admin/ai-engine/generate` l'invoque). Default provider 'openai' + fallback vers URL mock fictive `/_media/ai-engine/mock/*.png` jamais ecrite.

## Tests
- vitest: 1695 passed / 0 failed mais **VITEST_EXIT=1** (unhandled rejection 'Higgsfield video failed: content policy violation' video-generation.ts:206).
- image-generation.test.ts:142 valide le POST vers l'endpoint synchrone FAUX `/v1/images/generate`.

## Assets mock
- /_media/content-studio/mock/{reel-9x16.mp4, story-9x16.mp4, poster-9x16.jpg} servis HTTP 200.
- /_media/ai-engine/mock/test.png present (200), mais `generateMockImage` (systeme A) genere des URLs `mock-img-<ts>.png` jamais ecrites.