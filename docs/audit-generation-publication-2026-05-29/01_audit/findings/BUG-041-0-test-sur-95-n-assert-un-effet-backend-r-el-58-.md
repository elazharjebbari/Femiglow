# BUG-041 — 0 test sur 95 n'assert un effet backend réel ; 58 mockent fetch — les doublures ne reflètent pas l'API live

| | |
|---|---|
| **Sévérité** | `major` (ajustée depuis critical) |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `src/lib/content-studio/**.test.ts, src/lib/ai-engine/**.test.ts, src/lib/social-publishing/**.test.ts` |
| **Mode mock** | `works` |
| **Mode live** | `broken` |
| **Verdict vérification** | `adjusted` (confiance: high) |

## État supposé (code + tests)
Les tests 'mode live' (ex. video-generation.test.ts 'mode=live + hf-video-mini → POST /videos/generate + polling', image-generation.test.ts 'provider higgsfield') prétendent valider le chemin live Higgsfield/OpenAI.

## État réel vérifié
Aucun test du perimetre n exerce DB/reseau reel; le contrat fetch Higgsfield est fictif et identique entre code et mock (endpoints synchrones inventes vs API async reelle), donc les tests live restent verts independamment de l API reelle. Le compte exact: ~5 fichiers spyOn(fetch) en perimetre strict, ~42 dans tout src (pas 58). Un contract test MSW/Zod existe pour les routes content-studio mais pas pour les providers externes.

## Écart
Les tests verrouillent un contrat fictif (endpoints synchrones inventés) identique entre code et mock, donc ils restent verts même si l'API réelle est totalement différente. Ils ne testent pas le point de vue opérateur (effet réseau réel) — ils testent que le mock répond au mock.

## Cause racine
Absence de couche de validation de contrat (contract tests / MSW handlers calqués sur l'OpenAPI réel) et absence de tout test d'intégration réseau. Les commentaires du code l'admettent (video-generation.ts:153-155 'TODO(higgsfield): l'API réelle utilise /v1/image2video/<model>... à réécrire'). Les tests ont été écrits AUTOUR du code faux, pas autour de la spec fournisseur.

## Preuves
- grep: 'Files asserting real DB/network: 0' ; 'Files mocking fetch/providers: 58' ; 'Total test files in scope: 95'
- video-generation.test.ts:130 'if (u.endsWith("/videos/generate"))' et :135 '/videos/status/' — endpoints synchrones inventés
- video-generation.ts:153-155 commentaire: 'TODO(higgsfield): l'API réelle utilise /v1/image2video/<model> + polling /v1/requests/{id}/status. Ces chemins doivent être réécrits'
- image-generation.test.ts:52 'vi.spyOn(globalThis, "fetch").mockImplementation' → expect provider toBe('higgsfield') l.167
- MEMORY higgsfield-api-mismatch.md: endpoints encore SYNCHRONES faux

## Reproduction
Lire les mocks fetch dans video-generation.test.ts/image-generation.test.ts ; comparer les chemins (/videos/generate) à l'API réelle platform.higgsfield.ai (/v1/image2video/<model> async). Constater l'absence de contract test.

## Piste de correction
Introduire des handlers MSW calqués sur la vraie OpenAPI Higgsfield/OpenAI (async submit+poll), partagés entre tests et un smoke 'parity' ; ajouter au moins 1 test d'intégration réseau réel (gardé par clé) qui échoue explicitement quand la clé manque, au lieu de mocker une réponse parfaite.

## Vérification adversariale
- **Verdict :** adjusted (confiance high)
- **Analyse :** Le coeur est vrai: 95 fichiers de test en perimetre, aucun ne touche une vraie DB/reseau, et le contrat fetch est fictif (video-generation.test.ts:130 '/videos/generate', code video-generation.ts:157 '/v1/videos/generate' synchrone) alors que l API reelle est async (text2image/image2video + poll /v1/requests/{id}/status, confirme par MEMORY et le TODO l.153-155). Les tests verrouillent un contrat identique entre code faux et mock => verts meme si l API differe totalement. MAIS le chiffre '58/95 fichiers mockent fetch' est gonfle: en perimetre strict (content-studio/ai-engine/social-publishing) seuls ~5 fichiers utilisent spyOn(fetch); repo entier = 42 fichiers de test avec un mock fetch, jamais 58. Severite critical -> major: c est une dette de fidelite des doublures, pas un crash.
- **Contre-preuve / nuance :** grep -rl spyOn(fetch) en perimetre = 5 fichiers (pas 58). grep -rl fetch-mock tout src/*.test = 42 (pas 58). 95 fichiers .test.ts en perimetre confirme. Il existe un contract test (content-studio-handlers.contract.test.ts) qui valide les handlers MSW contre les schemas Zod des routes — donc ce n est pas zero filet de contrat, contrairement au sous-entendu du finding.

> Réf. registre : `bug-register.csv` ligne `BUG-041` · matrice : `gap-matrix.csv`.
