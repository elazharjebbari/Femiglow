# 40 — Runbook d'exécution

> Pilote l'exécution du plan d'action ([`../30-plan-action/`](../30-plan-action/)) via la boucle
> correction/vérification. Suivre **dans l'ordre**. Commandes exactes :
> [`commandes.txt`](commandes.txt). Décision finale : [`checklist-go-no-go.md`](checklist-go-no-go.md).

## 0. Pré-requis (une fois)

1. Brancher de travail : `git checkout -b fix/analytics-qa-2026-05` (depuis `master` à jour).
2. Vérifier la stack : `pnpm install` ; `pnpm --filter web typecheck` vert.
3. Lire `00-audit/00-synthese-verdict.md` + `findings-register.csv` (la source de vérité des bugs).
4. Configurer la CI bi-fuseau (matrice `TZ=UTC` et `TZ=Africa/Casablanca`) — cf. `config/test-matrix.json`.

## 1. Phase 0 — Socle de test

1. Créer `src/test/fixtures/analytics/` (helpers `ev/session/seedEvents/seedComponents/
   resetMemoryStore` + builders + personae) — cf. `20-test-strategy/02-fixtures-...md`.
2. Créer `src/test/msw/analytics-handlers.ts` (scénarios `nominal/empty/error500/highVolume/firstRun`).
3. Créer les helpers Playwright `e2e/analytics/_helpers.ts` (`loginAsAdmin`, `routeAnalytics`,
   `routeInsights`, horloge).
4. **Vérif** : `pnpm --filter web test -- src/test` vert (harnais à vide).

## 2. Boucle par finding (cœur du runbook)

Pour chaque finding, par priorité (P0 → P1 → P2), répéter la **boucle micro** :

```
# 1. RED — écrire/activer le test (il doit échouer)
pnpm --filter web test -- <fichier-de-test>           # attendu : FAIL (bonne raison)

# 2. FIX — corriger le code applicatif (diff minimal)
pnpm --filter web typecheck                           # attendu : PASS

# 3. GREEN — le test du finding passe
pnpm --filter web test -- <fichier-de-test>           # attendu : PASS

# 4. REGRESS — toute la suite analytics
pnpm --filter web test -- src/lib/analytics src/components/admin/analytics   # unit+composant
pnpm --filter web test:e2e -- e2e/analytics            # e2e
TZ=Africa/Casablanca pnpm --filter web test -- src/lib/analytics/filters     # cas temporels

# 5. A11Y (si UI)
pnpm --filter web test:e2e -- e2e/analytics/a11y.spec.ts

# 6. CLOSE — mettre status=closed + lien test dans findings-register.csv
```

### Ordre recommandé des findings

| # | Finding | Tâches (plan-action.csv) |
|---|---|---|
| 1 | **AF-01** (P0) | T1.1 → T1.2 → T1.3 → T1.4 |
| 2 | **AF-02** (P1) | T2.1 → T2.2 |
| 3 | **AF-04** (P1) | T2.3 |
| 4 | **AF-03** (P1) | T2.4 |
| 5 | **AF-05** (P1) | T2.5 |
| 6 | P2 CTA / Checkout / Insights | T3.1 → T3.2 → T3.3 → T3.4 → T3.5 |
| 7 | Perf & sécurité | T4.1 → T4.2 → T4.3 |
| 8 | a11y & gate | T5.1 → T5.2 |

## 3. Fin de chaque phase

```
# suite complète 3x (anti-flaky)
for i in 1 2 3; do pnpm --filter web test:e2e -- e2e/analytics || break; done
# couverture
pnpm --filter web test:coverage -- src/lib/analytics
```
Vérifier les seuils de `config/coverage-targets.yaml`. Si KO → corriger → recommencer.

## 4. Clôture

1. Tous les findings P0/P1 `closed` ; `FN-*` couverts (matrice).
2. Activer la **gate CI** bloquante (T5.2) sur les chemins analytics.
3. Dérouler [`checklist-go-no-go.md`](checklist-go-no-go.md).
4. PR : référencer `task_id` + `finding_id` traités ; lier ce dossier.

## 5. Rollback / sécurité

- Chaque correctif est isolé par finding (commits atomiques) → revert ciblé possible.
- Les correctifs de **calcul** (AF-02, AF-03, AF-04) changent des chiffres affichés : prévenir
  l'opératrice (la fondatrice) que les historiques vont se recaler (revenu CTA notamment), et
  documenter la date de bascule.
- Les correctifs **perf** (matviews, cache) derrière vérification de parité de résultats
  (mêmes chiffres que le scan direct sur un échantillon).
