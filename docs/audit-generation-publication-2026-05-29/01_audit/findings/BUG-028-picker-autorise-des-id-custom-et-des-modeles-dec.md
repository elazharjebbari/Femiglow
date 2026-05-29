# BUG-028 — Picker autorise des id custom et des modeles decouverts non routables (flux_2, veo3_1) -> 409 a l'usage

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-image |
| **Composant** | `ModelPicker.tsx (allowCustom + items discovery) -> image-generation.ts routing` |
| **Mode mock** | `works` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Tout modele propose ou saisi dans le picker est utilisable pour generer.

## État réel vérifié
Le picker propose les id decouverts Higgsfield (flux_2, flux_kontext, seedream_v5_lite...) et permet la saisie custom. Ces id ne sont ni 'mock-*', ni 'hf-*', ni 'gpt-image-*/dall-e-*'. En live ils tombent au step 5 (OpenAI default) -> cle vide -> 409. En mock ils marchent (court-circuit) mais le run enregistre mock-low-cost-image.

## Écart
Modeles selectionnables mais non routables -> erreur en live, comportement trompeur.

## Cause racine
Le routing de image-generation.ts ne reconnait que les prefixes mock-/hf-/gpt-image-/dall-e-; les id de discovery Higgsfield (flux_2...) et tout id custom non prefixe ne sont pas mappes.

## Preuves
- GET models?role=image -> flux_2, flux_kontext, cinematic_studio_2_5, text2image_soul_v2, seedream_v5_lite, nano_banana_2, image_auto (provider higgsfield, source live)
- ModelPicker.tsx:383-430 allowCustom permet saisie id arbitraire
- image-generation.ts:31-39,71,86 routing ne matche que mock-/hf-/gpt-image-/dall-e-

## Reproduction
En live, choisir flux_2 (badge Live) ou saisir un id custom -> Generer -> 409 invalid_state (tombe sur OpenAI default, cle vide).

## Piste de correction
Mapper les id de discovery Higgsfield reels vers le router (ou prefixer/normaliser cote registry). Valider l'id selectionne cote serveur et renvoyer une erreur explicite 'modele non supporte' plutot qu'un fallback OpenAI silencieux.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Probe GET models?role=image confirme les id higgsfield non-routables (flux_2, flux_kontext, cinematic_studio_2_5, text2image_soul_v2, seedream_v5_lite, nano_banana_2, image_auto) source:'live'. ModelPicker.tsx:52 allowCustom=true defaut; l.383-419 saisie d'id arbitraire; MediaStudio.tsx:491-498 utilise <ModelPicker> SANS override allowCustom -> defaut true dans l'UI operateur. image-generation.ts:31-39,71,86 ne route que mock-/hf-/gpt-image-/dall-e-; un id comme flux_2 tombe au step 5 (OpenAI default) -> cle vide -> 409. En mock ils marchent (court-circuit) mais run=mock-low-cost-image. Severity major coherente.
- **Contre-preuve / nuance :** Aucune contre-preuve. allowCustom defaut true (ModelPicker.tsx:52) non override (MediaStudio.tsx:491-498) + routing par prefixe seulement (image-generation.ts:31-39).

> Réf. registre : `bug-register.csv` ligne `BUG-028` · matrice : `gap-matrix.csv`.
