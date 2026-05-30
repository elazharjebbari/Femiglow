# BUG-032 — Vitest EXIT 1 (unhandled rejection) masqué par 1695 'passed' — test polling status=failed laisse une promesse rejetée orpheline

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-video |
| **Composant** | `src/lib/content-studio/video-generation.test.ts:198-224 + video-generation.ts:205-209` |
| **Mode mock** | `broken` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le test 'polling status=failed → throw' valide que generateStudioVideo rejette sur statut failed; vitest devrait sortir 0.

## État réel vérifié
Vitest rapporte 'Test Files 137 passed', 'Tests 1695 passed', MAIS 'Errors 1 error' et VITEST_EXIT=1. L'erreur: Unhandled Rejection 'Higgsfield video failed: content policy violation' originant de video-generation.ts:206 dans generateHiggsfieldStudioVideo. Le test avance les fake-timers de 6000ms puis await le rejet, mais entre l'avance du timer et le throw il y a deux awaits (fetch poll + .json()) → le throw échappe à la chaîne résolue par advanceTimersByTimeAsync, laissant une promesse rejetée non gérée.

## Écart
Rapport tout-vert trompeur: la CI sur 'passed count' croit le suite saine alors que le process échoue (exit 1). Illustration exacte du décalage test↔réalité.

## Cause racine
Mauvaise gestion fake-timers/microtâches dans le test (multiples awaits après l'avance unique), pas de drain complet des timers avant l'assertion de rejet.

## Preuves
- /tmp/audit-vitest.log:6006-6016 → 'Unhandled Rejection: Error: Higgsfield video failed: content policy violation' ❯ generateHiggsfieldStudioVideo video-generation.ts:206:13
- /tmp/audit-vitest.log tail → 'Test Files 137 passed', 'Tests 1695 passed', 'Errors 1 error', 'VITEST_EXIT=1'
- video-generation.test.ts:220 → await vi.advanceTimersByTimeAsync(6_000); puis :221 await expect(promise).rejects...
- video-generation.ts:186-209 → boucle: await setTimeout, await fetch, await .json(), puis throw si status==='failed'

## Reproduction
1) pnpm vitest run; echo $? → 1. 2) grep 'Unhandled Rejection' dans la sortie → 'Higgsfield video failed: content policy violation'.

## Piste de correction
Dans le test, drainer entièrement les timers/microtâches avant l'assertion (ex: await vi.runAllTimersAsync() ou plusieurs advanceTimersByTimeAsync couvrant l'intervalle de poll) et attacher le .rejects au même tick. Vérifier que la boucle de poll ne laisse pas de promesse pendante.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie directement dans /tmp/audit-vitest.log: 'Test Files 137 passed', 'Tests 1695 passed', 'Errors 1 error', 'VITEST_EXIT=1'. L'Unhandled Rejection 'Higgsfield video failed: content policy violation' origine de generateHiggsfieldStudioVideo video-generation.ts:206:13, attribuee au test polling status=failed (test :198-224). Le test :220 avance les fake-timers de 6000ms puis :221 await expect(promise).rejects — entre l'avance unique du timer et le throw il y a plusieurs awaits (setTimeout, fetch poll, .json()) -> la promesse rejetee echappe a la chaine drainee par advanceTimersByTimeAsync. Rapport tout-vert masquant exit 1: illustration exacte du decalage test<->realite.
- **Contre-preuve / nuance :** /tmp/audit-vitest.log:6006-6008 'Unhandled Rejection: Error: Higgsfield video failed: content policy violation ❯ generateHiggsfieldStudioVideo video-generation.ts:206:13'; tail 'Tests 1695 passed','Errors 1 error','VITEST_EXIT=1'. video-generation.test.ts:220 advanceTimersByTimeAsync(6_000) puis :221 expect(promise).rejects. video-generation.ts:185-209 boucle await setTimeout/await fetch/await .json()/throw.

> Réf. registre : `bug-register.csv` ligne `BUG-032` · matrice : `gap-matrix.csv`.
