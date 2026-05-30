# BUG-010 — Suite tout-verte (1695 passed) mais EXIT 1 : unhandled rejection masquée par fake timers

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `src/lib/content-studio/video-generation.test.ts + video-generation.ts (polling)` |
| **Mode mock** | `n/a` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
vitest run rapporte 1695 passed / 0 failed / success:true ; la CI lit ce rapport et conclut que tout va bien.

## État réel vérifié
Le process vitest sort EXIT 1. Une 'Unhandled Rejection: Higgsfield video failed: content policy violation' échappe au test 'polling status=failed' (fake timers). Reproduit en isolation : 15 passed MAIS 'Errors 1 error'. La promesse de polling rejette une 2e fois après que le test a déjà capturé son rejet, hors du await du test.

## Écart
Un rapport JSON success:true coexiste avec un code de sortie d'échec. N'importe quel orchestrateur qui se fie au JSON (ou au compteur passed) rate le signal ; seul le code retour le révèle. C'est l'archétype du test qui ment.

## Cause racine
La boucle while(Date.now()<deadline) de generateHiggsfieldStudioVideo utilise setTimeout(HIGGSFIELD_POLL_INTERVAL_MS) sous fake timers. Le test fait advanceTimersByTimeAsync(6_000) puis useRealTimers() après le rejet attendu, laissant une itération/poll planifiée se résoudre/rejeter en dehors du scope du test (promesse pendante non awaitée). Aucun afterEach n'appelle vi.clearAllTimers()/restoreAllMocks() globalement.

## Preuves
- /tmp/audit-vitest.json: {"numTotalTests":1695,"numPassedTests":1695,"numFailedTests":0,"success":true}
- /tmp/audit-vitest.log fin: 'Tests 1695 passed (1695) | Errors 1 error' puis 'VITEST_EXIT=1'
- /tmp/audit-vitest.log: 'Unhandled Rejection — Error: Higgsfield video failed: content policy violation ❯ generateHiggsfieldStudioVideo src/lib/content-studio/video-generation.ts:206:13'
- Repro isolée: `pnpm exec vitest run src/lib/content-studio/video-generation.test.ts` → '15 passed (15) | Errors 1 error'
- video-generation.test.ts:198-224 (test 'polling status=failed') : useFakeTimers + advanceTimersByTimeAsync(6_000) + rejects.toThrow, puis useRealTimers()
- video-generation.ts:185-210 boucle while + setTimeout(5000) + throw l.206

## Reproduction
cd apps/web && pnpm exec vitest run src/lib/content-studio/video-generation.test.ts ; observer 'Errors 1 error' malgré 15 passed. En suite complète: écho $? = 1 alors que le JSON dit success:true.

## Piste de correction
Dans video-generation.test.ts: après advanceTimersByTimeAsync, drainer toute la boucle (advancer jusqu'au throw réel) et await la rejection AVANT useRealTimers ; ajouter afterEach(()=>{vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();}). Côté CI: traiter tout 'Errors N error' et tout EXIT!=0 comme un échec, jamais se fier au seul numFailedTests.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Reproduit en direct: `pnpm exec vitest run src/lib/content-studio/video-generation.test.ts` => '15 passed | Errors 1 error' avec EXIT=1, et la suite complete /tmp/audit-vitest.json dit success:true / numFailedTests:0. Le decalage rapport-vert vs code-de-sortie-echec est reel et c est l archetype du test qui ment. La rejection 'Higgsfield video failed: content policy violation' echappe a video-generation.ts:206 sous fake timers (PromiseRejectionHandledWarning 'rejection id: 5' = la rejection a ete traitee de maniere asynchrone, apres avoir ete momentanement non geree).
- **Contre-preuve / nuance :** Aucune contre-preuve. Confirme: repro isolee 15 passed + 1 error + EXIT=1; vitest.setup.ts n a aucun afterEach global vi.clearAllTimers()/restoreAllMocks(). Le test 198-224 fait advanceTimersByTimeAsync(6_000) puis useRealTimers() apres le throw.

> Réf. registre : `bug-register.csv` ligne `BUG-010` · matrice : `gap-matrix.csv`.
