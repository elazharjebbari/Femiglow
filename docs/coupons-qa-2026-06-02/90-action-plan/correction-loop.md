# Boucle de correction & vérification

Doctrine : un test rouge est une **information**, pas un obstacle à contourner. La boucle garantit qu'on corrige la **bonne couche** et qu'on ne masque jamais un bug réel.

## 1. Cycle unitaire d'une correction

```
RUN ─► FAIL ─► TRIAGE ─► ROOT CAUSE ─► FIX ─► RE-RUN (vague) ─► GATE ─► STABLE(3x)
                  │                                                  │
                  └────────────── ticket EB-### ─────────────────────┘
```

## 2. Arbre de décision « cause racine »

```
Le test échoue
├─ L'attendu (oracle) est-il correct selon spec.md ?
│   ├─ NON → la SPEC est ambiguë/fausse
│   │        → corriger spec.md PUIS le test (traçabilité), valider avec le métier
│   └─ OUI → l'attendu est bon
│        ├─ Le code produit-il un résultat faux ?
│        │   ├─ OUI → BUG CODE → corriger le code, garder le test tel quel
│        │   └─ NON → le code est bon mais le test échoue
│        │        ├─ Flaky (timing/ordre/état) ? → corriger le TEST (déterminisme), pas le code
│        │        └─ Mock/fixture faux ? → corriger fixture/handler MSW
```

Règle d'or : **on ne modifie l'oracle d'un test que si la spec change.** Sinon le test reste, le code change.

## 3. Catégories d'échec & action par défaut

| Catégorie | Signature | Action |
|---|---|---|
| Bug prix (422) | `price_mismatch`, total ≠ attendu | Vérifier que les 3 surfaces appellent le MÊME `resolveProductPricing` ; bucket déterministe. Couche : code (engine/branchement). |
| Bucket instable | bucket varie pour même `visitorKey` | Hash non déterministe ou clé non stable. Couche : `bucketing.ts`/`context.ts`. |
| Fallback cassé | page plante quand coupon off | `resolveProductPricing` ne retombe pas sur `computePromo`. Couche : engine. |
| Idempotence | 2 events converted | Contrainte unique partielle absente / `!replayed` non vérifié. Couche : repo/route. |
| RBAC | mutation passe sans droit | Permission vérifiée après la mutation. Couche : route (ordre auth→perm→exec). |
| Charte | rouge/countdown/emoji détecté | Couche : composant UI / tokens. |
| Flaky | vert/rouge alterné | Timing réel, état partagé. Couche : test (déterminisme, `resetMemoryStore`, `now` injecté). |
| i18n | درهم/RTL incorrect | Couche : composant / clés i18n. |

## 4. Critères de stabilité (avant de clore une vague)

- 3 exécutions consécutives **vertes** de la vague entière.
- Aucun test en quarantaine non ticketé.
- Gates de la vague (`phases.yaml: exit_gates`) satisfaits.
- `execution-board.csv` : tous les tickets de la vague en `done` avec `test_non_regression` rempli pour les bugs.

## 5. Boucle macro (inter-vagues)

Après chaque vague close, **re-run de TOUTE la suite des vagues précédentes** (non-régression cumulative) avant d'ouvrir la suivante. Un échec en aval rouvre la vague concernée (ticket).

## 6. Journal de correction

Chaque correction note dans `execution-board.csv` : `cause_racine`, `couche_corrigee`, `test_non_regression`. Ce journal est la mémoire de la campagne et alimente le post-mortem.
