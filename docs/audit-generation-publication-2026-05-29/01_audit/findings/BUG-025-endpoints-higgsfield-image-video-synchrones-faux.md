# BUG-025 — Endpoints Higgsfield image/video synchrones faux (API reelle = async submit+poll)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-image |
| **Composant** | `src/lib/content-studio/image-generation.ts (generateHiggsfieldImage) + video-generation.ts` |
| **Mode mock** | `n/a` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Un modele hf-* avec credential complet genere une image/video via l'API Higgsfield.

## État réel vérifié
Meme avec un credential complet, generateHiggsfieldImage POST sur /v1/images/generate (synchrone) et attend json.images[] — alors que l'API reelle platform.higgsfield.ai est ASYNC: submit /v1/text2image/<model> puis poll /v1/requests/{id}/status. video-generation POST /v1/videos/generate + poll /v1/videos/status/{id} (chemins egalement faux). Non verifiable live (credential incomplet) -> casse par defaut.

## Écart
Le chemin Higgsfield ne peut pas fonctionner contre la vraie API meme une fois le credential corrige; les tests le 'valident' contre le mauvais contrat.

## Cause racine
Migration partielle: higgsfield-auth.ts a corrige host+schema d'auth (documente lignes 14-16) mais les endpoints et le modele async n'ont pas ete reecrits (TODO explicites image-generation.ts:167-170 et video-generation.ts:153-155).

## Preuves
- image-generation.ts:171 fetch(`${higgsfieldBaseUrl()}/v1/images/generate`) synchrone
- image-generation.ts:167-170 TODO(higgsfield): l'API reelle utilise async submit+polling /v1/text2image/<model>
- video-generation.ts:157 fetch /v1/videos/generate + 187 poll /v1/videos/status/{id} (chemins faux vs /v1/image2video + /v1/requests/{id}/status)
- image-generation.test.ts:142 test 'POST vers /v1/images/generate' mocke fetch -> valide le MAUVAIS endpoint
- MEMORY higgsfield-api-mismatch: vraie API async /v1/text2image/<model>, /v1/image2video/<model>, poll /v1/requests/{id}/status

## Reproduction
Impossible a exercer live (credential incomplet). Analyse de code: comparer les chemins du code vs l'API reelle documentee.

## Piste de correction
Reecrire generateHiggsfieldImage et generateHiggsfieldStudioVideo selon le modele async reel (submit /v1/text2image/<model> ou /v1/image2video/<model>, poll /v1/requests/{id}/status), puis reecrire les tests pour asserter ce contrat. Valider avec un credential KEY_ID:KEY_SECRET complet.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** image-generation.ts:171 fetch(`${higgsfieldBaseUrl()}/v1/images/generate`) synchrone, attend json.images[] (l.193-196). TODO explicite l.167-170 indique API reelle async submit+poll (/v1/text2image/<model> + /v1/requests/{id}/status). video-generation.ts:157 fetch /v1/videos/generate + 187 poll /v1/videos/status/{id} avec TODO l.153-154 (vraie API /v1/image2video/<model> + /v1/requests/{id}/status). higgsfield-auth.ts l.14-16 documente que chemins/modele async restent a reecrire. Coherent avec MEMORY higgsfield-api-mismatch. Non exercable live (credential incomplet) -> casse par defaut. Severity major coherente.
- **Contre-preuve / nuance :** Aucune contre-preuve. Confirme par lecture: image-generation.ts:171 endpoint synchrone, video-generation.ts:157+187 chemins faux, TODOs presents.

> Réf. registre : `bug-register.csv` ligne `BUG-025` · matrice : `gap-matrix.csv`.
