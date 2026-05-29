# BUG-009 — Desync picker↔backend: 8 modèles vidéo Higgsfield 'live' proposés que generateStudioVideo ne sait PAS router

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | generation-video |
| **Composant** | `GET /api/admin/content-studio/models?role=video ↔ src/lib/content-studio/video-generation.ts:100-124` |
| **Mode mock** | `works` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Les modèles proposés dans le ModelPicker vidéo sont consommables par le backend de génération.

## État réel vérifié
Le picker renvoie 8 modèles higgsfield source:'live' (cinematic_studio_3_0, veo3_1, kling3_0, wan2_7, seedance_2_0, minimax_hailuo, marketing_studio_video, soul_cast) + 4 statiques hf-video-* + mock-video-1.0. Mais generateStudioVideo ne reconnaît que /^mock-/ (mock) et model.startsWith('hf-') (Higgsfield). Un modèle live-discovered (ex: veo3_1) en mode live ne matche ni mock ni hf- → tombe à video-generation.ts:119 → throw 'Mode live actif mais aucun modèle vidéo live disponible' (message faux: le modèle EST higgsfield-live). Le défaut suggéré reste mock-video-1.0 (sûr), donc l'opérateur par défaut n'est pas impacté, mais une sélection manuelle l'est.

## Écart
L'UI annonce des modèles vidéo live cliquables qui throw à l'usage, avec un message d'erreur trompeur. Désynchronisation catalogue/exécution.

## Cause racine
Le catalogue est alimenté par découverte live Higgsfield (IDs natifs), mais le routeur de génération attend des IDs internes hf-video-*. Pas de mapping ID-natif→hf-*.

## Preuves
- curl /models?role=video → ids: cinematic_studio_3_0|higgsfield|live, veo3_1|higgsfield|live, kling3_0|higgsfield|live, minimax_hailuo|higgsfield|live, ... + hf-video-mini/lite/standard/turbo|static + mock-video-1.0|static; suggested=mock-video-1.0
- video-generation.ts:100 → if(input.model && /^mock-/i.test(input.model)) mock
- video-generation.ts:104 → if(input.model?.startsWith('hf-')) higgsfield (sinon...)
- video-generation.ts:119-123 → if(mode==='live') throw 'aucun modèle vidéo live disponible. Sélectionne un modèle Higgsfield (hf-video-*)'
- ModelPicker.tsx:115-117 → auto-select suggested.id quand value===null (=> mock-video-1.0 par défaut)

## Reproduction
1) Ouvrir picker vidéo dans /create → modèles live higgsfield visibles. 2) Sélectionner veo3_1, basculer Live, générer → backend throw invalid_state 'aucun modèle vidéo live disponible'. (Live non exercé en POST; déterminé par code + catalogue réel curl.)

## Piste de correction
Soit mapper les IDs live-discovered vers le chemin Higgsfield (utiliser model.provider==='higgsfield' plutôt que startsWith('hf-')), soit filtrer le catalogue vidéo aux seuls modèles réellement supportés tant que l'intégration async n'est pas faite.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Probe curl authentifiee /models?role=video confirme 8 modeles higgsfield source:'live' (cinematic_studio_3_0, veo3_1, kling3_0, wan2_7, seedance_2_0, minimax_hailuo, marketing_studio_video, soul_cast) + 4 hf-video-* static + mock-video-1.0 (isDefault, suggested). Le routeur generateStudioVideo ne reconnait que /^mock-/ (ligne 100) et startsWith('hf-') (ligne 104). Un veo3_1 en live tomberait ligne 119 -> throw 'aucun modele video live disponible' (message trompeur car le modele EST higgsfield-live). Desync catalogue/executeur reel. Le defaut suggere=mock-video-1.0 protege l'operateur passif (comme note par l'auditeur), donc l'impact requiert une selection manuelle live -> severite critical defendable mais portee conditionnelle.
- **Contre-preuve / nuance :** curl /models?role=video: ids=[cinematic_studio_3_0|live, veo3_1|live, kling3_0|live, wan2_7|live, seedance_2_0|live, minimax_hailuo|live, marketing_studio_video|live, soul_cast|live, mock-video-1.0|static(isDefault), hf-video-mini/lite/standard/turbo|static]; suggested.id=mock-video-1.0. video-generation.ts:100 /^mock-/i, :104 startsWith('hf-'), :119-123 throw 'aucun modele video live disponible'.

> Réf. registre : `bug-register.csv` ligne `BUG-009` · matrice : `gap-matrix.csv`.
