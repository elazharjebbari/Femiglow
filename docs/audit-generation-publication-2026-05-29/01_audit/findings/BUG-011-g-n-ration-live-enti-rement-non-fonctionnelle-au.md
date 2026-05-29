# BUG-011 — Génération LIVE entièrement non-fonctionnelle aujourd'hui et non couverte par un test qui le révèle

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `image-generation.ts / video-generation.ts (chemins live) + env staging` |
| **Mode mock** | `works` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
L'opérateur peut basculer en mode live (cookie cs_generation_mode=live) et générer images/vidéos via OpenAI/Higgsfield.

## État réel vérifié
Live = broken: CONTENT_STUDIO_OPENAI_API_KEY vide → image live throw HttpError invalid_state (image-generation.ts:88-90). Higgsfield: clé sans ':' et AI_ENGINE_HIGGSFIELD_API_SECRET non défini → higgsfieldAuthHeader()=null → video/image live throw 'credential Higgsfield incomplet'. De plus les endpoints HF du code sont synchrones faux (/v1/videos/generate) vs API async réelle. AUCUN test ne capture cet état réel : les tests live mockent une clé 'hf_test:secret_test' (video-generation.test.ts:125) et une réponse fetch parfaite, donc ils restent verts.

## Écart
L'état 'live cassé' de staging n'est signalé par aucun test ; au contraire les tests live verts donnent l'illusion inverse. Un opérateur qui bascule en live obtient un throw, jamais anticipé par la CI.

## Cause racine
Tests live exercés contre des doublures avec credentials/réponses idéaux ; aucun test n'assert le comportement avec les credentials réels de staging (vides/incomplets). Endpoints HF non réécrits (TODO assumé).

## Preuves
- image-generation.ts:87-90 throw HttpError invalid_state 'CONTENT_STUDIO_OPENAI_API_KEY manquant'
- video-generation.ts:107-113 throw HttpError 'credential Higgsfield incomplet' si higgsfieldAuthHeader()==null
- higgsfield-auth.ts:31-37 higgsfieldCredential() returns null si clé sans ':' et pas de secret ; .env: clé sans ':' (contains colon? NO), SECRET non défini
- video-generation.ts:157 fetch '${base}/v1/videos/generate' (synchrone) vs API réelle async (commentaire l.153-155)
- video-generation.test.ts:125 mocke 'hf_test:secret_test' ; :128-142 mocke des réponses parfaites → test vert
- generation-smoke.spec.ts diagnostic /tmp/audit-playwright.log: 'Outcome: variants' (s'arrête, ne va pas jusqu'à image live confirmée)

## Reproduction
Poser cookie cs_generation_mode=live et tenter generate-visual sur un draft (NON exécuté ici par sécurité) → HttpError invalid_state. Vérifier env: CONTENT_STUDIO_OPENAI_API_KEY vide, HF key sans secret.

## Piste de correction
Ajouter un test/healthcheck qui échoue explicitement quand les credentials live sont absents/incomplets (au lieu de mocker un succès) ; réécrire endpoints HF en async submit+poll et les valider via MSW calqué sur l'API réelle ; aligner UI 'Live' sur la disponibilité réelle de la clé.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Confirme: CONTENT_STUDIO_OPENAI_API_KEY VIDE => image-generation.ts:87-90/98-101/111-112 throw invalid_state en live. AI_ENGINE_HIGGSFIELD_API_KEY sans ':' (probe: colon?=NO) + AI_ENGINE_HIGGSFIELD_API_SECRET NON DEFINI => higgsfield-auth.ts:30-37 higgsfieldCredential()=null => higgsfieldAuthHeader()=null => video-generation.ts:106-114 throw 'credential Higgsfield incomplet'. Endpoints HF synchrones faux (video-generation.ts:157 /v1/videos/generate) vs API async (TODO l.153-155). Aucun test ne capture cet etat: video-generation.test.ts:125 mocke 'hf_test:secret_test' + reponses parfaites => verts. La generation live est entierement non-fonctionnelle aujourd hui et aucun test rouge ne le signale.
- **Contre-preuve / nuance :** Aucune contre-preuve — tout verifie en direct via env + lecture du code. Le test :111 ('mode=live sans cle => erreur') existe mais avec une cle volontairement vide; aucun test n exerce l etat reel staging (cle HF incomplete) comme un echec attendu de healthcheck.

> Réf. registre : `bug-register.csv` ligne `BUG-011` · matrice : `gap-matrix.csv`.
