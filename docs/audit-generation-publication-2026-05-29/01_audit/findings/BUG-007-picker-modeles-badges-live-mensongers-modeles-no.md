# BUG-007 — Picker modeles: badges 'Live' mensongers — modeles non generables affiches comme disponibles

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | generation-image |
| **Composant** | `src/app/api/admin/content-studio/models/route.ts + ModelPicker.tsx` |
| **Mode mock** | `n/a` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le badge 'Live' indique un modele decouvert via l'API live du provider et donc utilisable.

## État réel vérifié
role=image renvoie 14 modeles badges source:'live' dont AUCUN n'est generable: 6 OpenAI (gpt-image-1/1.5/2, chatgpt-image-latest...) — la cle OpenAI valide cote discovery n'est PAS lue par le flux create (CONTENT_STUDIO_OPENAI_API_KEY vide); 8 Higgsfield (flux_2, flux_kontext, veo3_1...) qui proviennent en realite du FALLBACK statique (discovery.higgsfield='fallback') mais sont marques 'live' a tort.

## Écart
L'UI promet des modeles live qui throw a l'usage (desync UI/realite); l'operateur choisit un modele 'Live', clique Generer, recoit 409.

## Cause racine
(a) Le picker via resolveApiKey('openai') trouve OPENAI_API_KEY (chaine ENV_KEY_MAP) et liste les modeles OpenAI 'live', alors que generateStudioImage lit une AUTRE variable (CONTENT_STUDIO_OPENAI_API_KEY) — sources de cle divergentes entre picker et generateur. (b) materialiseDiscoveredModel (route.ts:62-88) force toujours source:'live' meme quand discoverModels a renvoye source='fallback' (api.higgsfield.ai mort).

## Preuves
- curl GET /api/admin/content-studio/models?role=image -> discovery={openai:live, higgsfield:fallback, anthropic:no-key} ; 14 modeles source=live (6 openai + 8 higgsfield) + dall-e-3/hf-* en static
- curl GET ?role=video -> discovery.higgsfield=fallback MAIS veo3_1/kling3_0/wan2_7... tous source=live
- model-discovery.ts:290-298 fetchHiggsfield cible api.higgsfield.ai/v1 (host mort) + Bearer (auth fausse) -> echoue -> FALLBACK_MODELS
- route.ts:62-88 materialiseDiscoveredModel return {...known, source:'live'} ou {source:'live'} sans tenir compte de r.source='fallback'
- ModelPicker.tsx:505-523 badge 'Live' affiche si model.source==='live'

## Reproduction
GET /api/admin/content-studio/models?role=image avec cookie admin. Observer discovery.higgsfield='fallback' mais tous les modeles higgsfield avec source:'live'. Cote OpenAI: source:'live' mais generateStudioImage echoue (cle differente).

## Piste de correction
1) Propager r.source dans materialiseDiscoveredModel: si source!=='live' marquer 'cache'/'static'. 2) Aligner la source de cle: le picker doit refleter ce que le generateur peut reellement utiliser (meme resolveApiKey, ou meme env var). 3) Corriger fetchHiggsfield (host platform.higgsfield.ai + auth 'Key KEY_ID:KEY_SECRET') pour que la discovery soit reelle.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Probe GET /api/admin/content-studio/models?role=image confirme: discovery={openai:live, higgsfield:fallback, anthropic:no-key} MAIS les 8 modeles higgsfield (flux_2, flux_kontext, cinematic_studio_2_5, text2image_soul_v2, gpt_image_2, seedream_v5_lite, nano_banana_2, image_auto) — IDENTIQUES a FALLBACK_MODELS.higgsfield (model-discovery.ts:116-124) — portent tous source:'live'. Cause: route.ts:62-88 materialiseDiscoveredModel retourne {...known, source:'live'} (l.72) ou {source:'live'} (l.87) sans propager r.source='fallback'. Cote OpenAI: discovery reellement live (resolveApiKey('openai') resout OPENAI_API_KEY via ENV_KEY_MAP api-key-manager.ts:42), les gpt-image-* sont de vrais modeles decouverts MAIS generateStudioImage lit CONTENT_STUDIO_OPENAI_API_KEY (vide) -> badge 'Live' promet une capacite de generation qui echoue (409). ModelPicker.tsx:505-521 affiche 'Live' si source==='live'. Gap reel.
- **Contre-preuve / nuance :** Nuance (n'invalide pas le finding): pour OpenAI le badge 'Live' n'est pas faux quant a la DECOUVERTE (discovery.openai='live', modeles reellement listes par /models) — la tromperie est sur la CAPACITE de generer (cle differente). Pour Higgsfield le badge est faux sur les deux axes (source reelle=fallback + non generable). Severity critical maintenue.

> Réf. registre : `bug-register.csv` ligne `BUG-007` · matrice : `gap-matrix.csv`.
