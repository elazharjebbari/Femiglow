# 30 — Boucle de correction & vérification

> Le moteur d'exécution du plan : une **boucle TDD par finding**, pilotée par le runbook
> ([`../40-runbook/runbook-execution.md`](../40-runbook/runbook-execution.md)). Diagramme :
> [`boucle.puml`](boucle.puml).

## 1. La boucle (par finding du registre)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. SELECT  : prendre le finding de plus haute priorité encore 'open'   │
│ 2. RED     : écrire/activer le test de non-régression -> il ÉCHOUE      │
│ 3. FIX     : appliquer le correctif minimal (code applicatif)          │
│ 4. GREEN   : le test passe ; relancer la couche concernée              │
│ 5. REGRESS : relancer TOUTE la suite analytics (unit+composant+e2e)    │
│ 6. A11Y    : si UI, axe sans violation                                 │
│ 7. CLOSE   : statut 'closed' dans findings-register.csv + lien test    │
│ 8. LOOP    : retour 1 tant qu'il reste des findings selon la priorité   │
└──────────────────────────────────────────────────────────────────────┘
```

Règle d'or : **on ne corrige rien sans test rouge d'abord**, et **on ne ferme rien sans suite
complète verte**. Un correctif qui casse un autre test rouvre le finding correspondant.

## 2. Critères de passage entre étapes

| Étape | Sortie attendue |
|---|---|
| RED | le test échoue **pour la bonne raison** (assert métier, pas erreur d'infra) |
| FIX | diff minimal, ciblé sur le finding, sans régression de typage (`pnpm typecheck`) |
| GREEN | le(s) test(s) du finding passent en local |
| REGRESS | `vitest run` (analytics) + `test:e2e` (analytics) verts, **bi-fuseau** pour les cas temporels |
| A11Y | `axe` 0 violation critique/serious sur l'onglet touché |
| CLOSE | `findings-register.csv` : `status=closed`, colonne test renseignée |

## 3. Boucle macro (par phase)

```
Phase N :
  pour chaque finding de la phase (par priorité) :
      exécuter la boucle micro (§1)
  quand tous 'closed' :
      lancer la suite COMPLÈTE 3× (anti-flaky)
      vérifier la couverture >= seuils
      si KO -> corriger -> recommencer la vérif
  passer à Phase N+1
```

## 4. Garde-fous

- **Quarantaine flaky** : un test e2e instable est isolé (`@flaky`) + ticket ; il ne bloque pas la
  CloseList mais doit être stabilisé avant la fin de phase.
- **No-merge sans vert** : la gate CI (T5.2) rend la suite analytics bloquante sur les chemins
  `lib/analytics/**`, `components/admin/analytics/**`, `app/api/admin/analytics/**`,
  `app/admin/analytics/**`.
- **Traçabilité** : chaque PR référence les `task_id` (plan-action.csv) et `finding_id` traités.

## 5. Sortie de boucle (fin de chantier)

La boucle s'arrête quand : **tous les findings P0/P1 `closed`**, **tous les `FN-*` couverts**,
**suite verte stable 3×**, **couverture aux seuils**. → bascule sur le **Go** de la checklist
([`../40-runbook/checklist-go-no-go.md`](../40-runbook/checklist-go-no-go.md)).
