# BUG-027 — Rapport de tests tout-vert masque un echec process (vitest EXIT 1) et un mauvais contrat Higgsfield

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-image |
| **Composant** | `vitest suite (video-generation.test.ts) + image-generation.test.ts` |
| **Mode mock** | `n/a` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Les tests verts prouvent que la generation image/video fonctionne.

## État réel vérifié
vitest: 1695 passed / 0 failed MAIS VITEST_EXIT=1 a cause d'une unhandled rejection ('Higgsfield video failed: content policy violation') dans video-generation.test.ts via une promesse fake-timer pendante. De plus image-generation.test.ts:142 valide le POST vers le MAUVAIS endpoint synchrone /v1/images/generate. Les tests passent contre un contrat Higgsfield qui ne correspond pas a l'API reelle.

## Écart
Confiance trompeuse: 'tout vert' alors que le process echoue et que le chemin live Higgsfield teste est faux par construction.

## Cause racine
(a) Promesse non awaited dans un test fake-timer; (b) tests ecrits contre l'ancien contrat synchrone Higgsfield.

## Preuves
- /tmp/audit-vitest.json VITEST_EXIT=1 ; numPassedTests/numFailedTests: 1695 passed 0 failed
- /tmp/audit-vitest.log: 'Vitest caught 1 unhandled error' -> 'Error: Higgsfield video failed: content policy violation' at video-generation.ts:206:13, test 'polling status=failed'
- image-generation.test.ts:142 'mode=live + hf-flux-1 -> POST vers /v1/images/generate' (endpoint faux)

## Reproduction
Lire /tmp/audit-vitest.log (Unhandled Rejection) et l'EXIT code dans /tmp/audit-vitest.json. Comparer l'endpoint asserte dans image-generation.test.ts:142 a l'API reelle.

## Piste de correction
Awaiter/flush la promesse de rejet dans le test fake-timer (rejects.toThrow + runAllTimersAsync). Reecrire les tests Higgsfield sur le contrat async reel. Traiter EXIT!=0 comme un echec CI meme si 0 failed.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** VITEST_EXIT=1 confirme a /tmp/audit-vitest.log:6029 alors que resume '1695 passed / 0 failed' (audit-vitest.json: numPassedTests=1695, numFailedTests=0). Unhandled Rejection log:6006-6008 'Error: Higgsfield video failed: content policy violation' at generateHiggsfieldStudioVideo video-generation.ts:206:13, test 'polling status=failed'. image-generation.test.ts:142+147 asserte le POST vers /v1/images/generate (endpoint synchrone faux). 'Tout-vert' masque EXIT!=0 + contrat Higgsfield errone. Severity major coherente.
- **Contre-preuve / nuance :** Aucune contre-preuve. VITEST_EXIT=1 a log:6029; tail 'Tests 1695 passed / Errors 1 error'; test:142 endpoint faux.

> Réf. registre : `bug-register.csv` ligne `BUG-027` · matrice : `gap-matrix.csv`.
