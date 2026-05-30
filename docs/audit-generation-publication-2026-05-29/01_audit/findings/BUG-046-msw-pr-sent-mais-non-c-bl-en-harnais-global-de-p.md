# BUG-046 — MSW présent mais non câblé en harnais global de parité ; vitest.setup mocke trop largement (next/navigation, fonts)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `apps/web/vitest.setup.ts + src/test/msw/* (handlers ad-hoc)` |
| **Mode mock** | `partial` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `adjusted` (confiance: high) |

## État supposé (code + tests)
Une couche MSW devrait intercepter les appels réseau de façon fidèle et partagée pour tous les tests, garantissant que les doublures suivent le contrat fournisseur.

## État réel vérifié
vitest.setup.ts ne monte pas de setupServer MSW global et stube next/navigation+next/font globalement; le coverage exclut src/lib/ai-engine. Cependant un serveur MSW (src/test/msw/server.ts) et un contract test Zon<->routes (content-studio-handlers.contract.test.ts) existent et sont utilises ponctuellement: il y a un filet de parite partiel pour les routes internes, mais pas global ni etendu aux providers externes (OpenAI/Higgsfield/Postiz).

## Écart
Pas de garantie de parité : chaque test choisit (ou non) un handler MSW, beaucoup mockent fetch directement (58 fichiers). Le routing étant stubé, les assertions UI ne reflètent pas la navigation réelle (assert UI sans effet). Le coverage n'instrumente pas les 16 nœuds AI-Engine.

## Cause racine
Architecture de test sans serveur MSW central ni politique 'tout réseau passe par MSW' ; mocks globaux dans setup choisis pour faire passer les tests RTL plutôt que pour la fidélité. Coverage volontairement scopé (commentaire vitest.config.ts:19-31).

## Preuves
- node_modules/msw présent ; grep '65' imports msw dans src
- vitest.setup.ts:63-79 vi.mock('next/navigation') useRouter push:()=>{} (no-op global)
- vitest.setup.ts:51-55 vi.mock('next/font/google')
- Aucun setupServer global dans vitest.setup.ts (grep msw sur setup → 0)
- vitest.config.ts:36-42 coverage.include = products/feed + content-studio (PAS src/lib/ai-engine/nodes)
- 58/95 fichiers de test mockent fetch directement plutôt que via MSW

## Reproduction
grep -n msw vitest.setup.ts → vide ; lister src/test/msw/*.ts → handlers par feature, non montés globalement.

## Piste de correction
Monter un setupServer MSW global dans vitest.setup.ts avec onUnhandledRequest:'error' pour forcer tout le réseau à passer par des handlers fidèles ; étendre coverage.include à src/lib/ai-engine/** ; remplacer les vi.spyOn(fetch) par handlers MSW partagés.

## Vérification adversariale
- **Verdict :** adjusted (confiance high)
- **Analyse :** Le coeur est vrai: vitest.setup.ts ne monte AUCUN setupServer global (verifie ligne par ligne) et mocke globalement next/navigation (l.63-79, useRouter no-op) + next/font (l.51-55); coverage.include (vitest.config.ts) cible content-studio mais PAS src/lib/ai-engine/** (16 noeuds non instrumentes). MAIS le cadrage 'MSW present mais non cable en harnais de parite' est exagere: il EXISTE src/test/msw/server.ts (setupServer) ET un veritable contract test (content-studio-handlers.contract.test.ts) qui parse les reponses des handlers contre les schemas Zod des routes pour detecter une divergence mock<->route. Donc un harnais de parite partiel existe (routes internes), meme s il n est ni global ni etendu aux providers externes. Severite major maintenue.
- **Contre-preuve / nuance :** ls src/test/msw/ => server.ts + content-studio-handlers.contract.test.ts (contract test reel). grep msw vitest.setup.ts => 0 (pas de serveur global, vrai). vitest.config.ts coverage.include = [products/feed, content-studio/**] sans ai-engine (vrai). Donc 'non cable EN GLOBAL' = vrai, mais 'aucun harnais de parite' = faux.

> Réf. registre : `bug-register.csv` ligne `BUG-046` · matrice : `gap-matrix.csv`.
