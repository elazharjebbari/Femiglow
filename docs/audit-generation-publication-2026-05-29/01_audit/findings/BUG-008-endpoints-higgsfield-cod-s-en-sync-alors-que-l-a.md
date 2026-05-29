# BUG-008 — Endpoints Higgsfield codés en SYNC alors que l'API réelle est ASYNC (submit+poll différents) — live cassé même avec credential

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | generation-video |
| **Composant** | `src/lib/content-studio/video-generation.ts:157,187` |
| **Mode mock** | `n/a` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le code parle à l'API officielle platform.higgsfield.ai pour soumettre puis poller une génération vidéo.

## État réel vérifié
Le code POST sur `${base}/v1/videos/generate` et poll `${base}/v1/videos/status/{jobId}` (chemins synchrones inventés). La vraie API Higgsfield est async: submit `/v1/image2video/<model>` (ou text2video) puis poll `/v1/requests/{id}/status`. Le host et l'en-tête (Key KEY_ID:KEY_SECRET) sont désormais corrects (higgsfield-auth.ts), MAIS les chemins/forme de réponse ne le sont pas. Le commentaire TODO l'admet (video-generation.ts:153-155).

## Écart
Même avec un credential complet, chaque appel live échouerait (404 / forme de réponse inattendue: le code attend {job_id} et {status,video_url} qui ne correspondent pas à l'API réelle).

## Cause racine
Migration host/auth faite, migration endpoints/modèle async non faite.

## Preuves
- video-generation.ts:157 → fetch(`${higgsfieldBaseUrl()}/v1/videos/generate`, {method:'POST'...})
- video-generation.ts:187 → fetch(`${higgsfieldBaseUrl()}/v1/videos/status/${jobId}`)
- video-generation.ts:153-155 → TODO(higgsfield): l'API réelle utilise /v1/image2video/<model> + polling /v1/requests/{id}/status
- higgsfield-auth.ts:14-16 → NOTE: les CHEMINS d'endpoints ... et le modèle asynchrone (submit + polling) restent à réécrire
- MEMORY higgsfield-api-mismatch.md → endpoints encore SYNCHRONES faux

## Reproduction
Lecture de video-generation.ts:157,187 vs API réelle documentée (platform.higgsfield.ai async). Non exerçable live (credential incomplet + bloquant déjà avant réseau).

## Piste de correction
Réécrire submit en POST /v1/image2video/<model> (ou /v1/text2image pour image) et poll /v1/requests/{id}/status; adapter le parsing (id de requête, status, urls de sortie). Valider contre un vrai credential en staging avant prod.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie directement: video-generation.ts:157 POST `${base}/v1/videos/generate`, :187 poll `${base}/v1/videos/status/${jobId}`, parse {job_id}/{jobId} et {status,video_url}. Le TODO :153-155 admet que l'API reelle est /v1/image2video/<model> + poll /v1/requests/{id}/status. higgsfield-auth.ts:14-16 le confirme aussi. Host+auth corrects (base par defaut platform.higgsfield.ai, header 'Key KEY_ID:KEY_SECRET') mais chemins/forme de reponse synchrones inventes. Meme avec credential complet, le live echouerait (404/forme inattendue). Severite critical adaptee (sous le blocker du credential, c'est le 2e mur).
- **Contre-preuve / nuance :** video-generation.ts:157 fetch(`${higgsfieldBaseUrl()}/v1/videos/generate`); :187 fetch(`.../v1/videos/status/${jobId}`); :176 submitJson.job_id??submitJson.jobId; :153-155 TODO(higgsfield) API reelle /v1/image2video/<model>+/v1/requests/{id}/status. higgsfield-auth.ts:14-16 NOTE chemins restent a reecrire.

> Réf. registre : `bug-register.csv` ligne `BUG-008` · matrice : `gap-matrix.csv`.
