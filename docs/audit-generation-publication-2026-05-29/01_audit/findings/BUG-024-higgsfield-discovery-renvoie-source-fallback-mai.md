# BUG-024 — Higgsfield discovery renvoie source='fallback' mais les modeles sont materialises avec source='live' (badge Live trompeur)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | create-ui-flow |
| **Composant** | `models/route.ts materialiseDiscoveredModel + ModelPicker badge Live` |
| **Mode mock** | `n/a` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le badge 'Live' n'apparait que pour des modeles reellement disponibles via l'API live du provider.

## État réel vérifié
Pour role=image et role=video, discovery:{'higgsfield':'fallback'} (pas une vraie reponse live) mais les modeles flux_2, veo3_1, kling3_0, etc. sortent avec source='live' et donc badge vert 'Live' dans le picker. Or le credential Higgsfield est incomplet => 100% de ces modeles throwent invalid_state a la generation.

## Écart
materialiseDiscoveredModel force source='live' independamment de la source reelle (fallback) renvoyee par discoverModels.

## Cause racine
models/route.ts:74 et :85 retournent toujours source:'live' pour les modeles discovered, sans propager r.source ('fallback'/'cache'/'live').

## Preuves
- curl GET /models?role=video => discovery:{'higgsfield':'fallback'}; 'veo3_1 | source=live | provider=higgsfield'
- curl GET /models?role=image => 'flux_2 | source=live | provider=higgsfield' avec discovery higgsfield='fallback'
- models/route.ts:73-88 materialiseDiscoveredModel returns source:'live' inconditionnellement
- ModelPicker.tsx:505 model.source === 'live' => badge 'Live'

## Reproduction
1. /create, picker video. 2. Modeles Higgsfield affiches avec badge 'Live'. 3. Selectionner veo3_1, generer en live => invalid_state credential incomplet.

## Piste de correction
Propager la vraie source (fallback/cache/live) dans materialiseDiscoveredModel; ne badger 'Live' que si discovery.source==='live'. Idealement masquer/desactiver les modeles d'un provider sans credential generation-ready.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Confirmé: GET models?role=video => discovery {'higgsfield':'fallback'} mais veo3_1/kling3_0/flux_2 (role=image) sortent source=live -> badge Live (ModelPicker.tsx:505). Cause racine vérifiée: materialiseDiscoveredModel (route.ts:73 et 85) retourne TOUJOURS source:'live' sans propager r.source. Les modèles concernés viennent de FALLBACK_MODELS.higgsfield (model-discovery.ts:116-127: flux_2, veo3_1, kling3_0, seedream_v5_lite, nano_banana_2...), retournés par discoverModels avec source:'fallback' (model-discovery.ts:385) car higgsfield n'a pas d'appel live réussi (credential mono-token sans ':'). higgsfieldAuthHeader()=null (higgsfield-auth.ts:30-43: clé hf_... sans ':' + AI_ENGINE_HIGGSFIELD_API_SECRET absent). 100% de ces modèles throwent invalid_state à la génération (prouvé pour hf-flux-pro).
- **Contre-preuve / nuance :** Aucune. Le forçage source:'live' est inconditionnel dans les deux branches de materialiseDiscoveredModel.

> Réf. registre : `bug-register.csv` ligne `BUG-024` · matrice : `gap-matrix.csv`.
