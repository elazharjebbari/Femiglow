## État réel constaté (staging, exercé le 2026-05-29)

### A. Génération de texte opérateur = fallback déterministe permanent
- `generation.ts:70` : `const apiKey = env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY;` puis `:72 if (!apiKey) return fallbackGeneration(idea);`.
- Process `web` (PID 3603311) : `CONTENT_STUDIO_OPENAI_API_KEY` **len=0**, `CHAT_OPENAI_API_KEY` **absent**, `AI_ENGINE_OPENAI_API_KEY` **absent**, mais `OPENAI_API_KEY` **len=164** (valide, non consulté par ce chemin).
- Preuve runtime : `GET /api/admin/content-studio/generation-runs?limit=5` -> tous les runs texte : `provider=fallback, model=deterministic-template, status=fallback, cost=0, err=None`.
- POST réel (MOCK cookie) sur idée produit/conversion -> `brief.angle="Relier produit à un geste simple et fidèle à la maison."` (enum `produit` inséré brut), 3 drafts au hook constant, captions préfixées du prompt brut.
- Le cookie `cs_generation_mode=mock` n'a **aucun effet** sur le texte (lu uniquement par generate-visual). MOCK == LIVE pour le texte.

### B. Deux systèmes parallèles
- Create flow : `CreateWorkspace.tsx:196` -> `POST /api/admin/content-studio/ideas/:id/generate` -> `generateIdeaDrafts` -> `generateForIdea` (système B, fallback).
- AI-Engine : `generate-script/caption/variants.ts` importés uniquement par `nodes/index.ts` + `graph/builder.ts`, exposés via `/api/admin/ai-engine/generate`. Jamais atteints par l'opérateur.
- Le bridge (`content-studio-bridge.ts`) est unidirectionnel A->B (createIdea + mapObjective/mapPillar).
- L'AI-Engine, lui, EST live-capable : `engine-config.ts:75` retombe sur `OPENAI_API_KEY` ; `AI_ENGINE_ENABLED=true` ; `GET /api/admin/ai-engine/config/providers` -> OpenAI `configured:true, healthStatus:healthy, model gpt-4o-mini`.

### C. Picker de modèles trompeur
- `GET /models?role=chat&format=post` -> `whisper-1` (STT) en TÊTE, `source:"live"`, puis `gpt-3.5-turbo`, etc.
- Discovery réussit car `resolveApiKey('openai')` (api-key-manager.ts:42) retombe sur `OPENAI_API_KEY`. Mais la génération n'utilise pas cette clé -> modèle choisi sans effet.
- `inferRole` classe whisper-1 en `chat` (regex tts ne couvre pas 'whisper').

### D. Variation = clone, pas de régénération
- `POST /drafts/cd_szd2vffv41jg1eq3/variation {variantLabel:'angle-test'}` -> HTTP 200, caption et hook **identiques** au parent. `repository.ts:922-927` copie tout. `promptOverride` accepté par le schema mais jamais consommé.

### E. Régénération -> 500 opaque
- `POST /ideas/<id_generated>/generate` -> HTTP 500 `{error:{code:'internal_error',message:'Erreur interne'}}` (assertTransition generated->generated lève une erreur non mappée).

### F. Tests verts mais trompeurs
- `/tmp/audit-vitest.json` : 1695 passed, 0 failed, success=true ; MAIS `VITEST_EXIT=1` (unhandled rejection 'Higgsfield video failed: content policy violation' dans video-generation.test.ts).
- Les nœuds AI-Engine (script/caption/variants) ne testent que le fallback (`invoke` mocké en `mockRejectedValue`). Le chemin LIVE n'est jamais validé.
- generation.ts a une meilleure couverture (edge-cases.test.ts: 429/503/JSON tronqué/content_filter/3 drafts max) — bon modèle à répliquer.

### G. Taxonomies incompatibles + français bancal
- AI-Engine objective enum = {awareness,engagement,conversion,education,entertainment}; Content-Studio = {notoriete,consideration,conversion,reassurance,fidelisation}.
- Fallback : `label(idea.pillar)` n'humanise pas l'enum ; proof spécial-casé seulement pour `produit` ; CTA = "Découvrir le rituel" seulement si conversion sinon "Lire la suite".