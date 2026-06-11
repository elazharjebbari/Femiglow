# Stratégie de test — Système de coupons

## 1. Doctrine

- **Risk-based** : chaque cas de test est rattaché à un risque de `feature-inventory.csv`. Pas de risque → pas de test.
- **Shift-left** : les specs sont écrites avant le code ; l'implémentation est dirigée par les critères d'acceptation (TDD/BDD).
- **Orienté opérateur** : on teste prioritairement ce que **voit et fait** l'utilisateur (visiteur sur `/kit`, opérateur sur `/admin/coupons`). Les tests UI/MSW/Playwright priment sur les tests d'implémentation interne.
- **Déterminisme absolu** : aucun test ne dépend de l'horloge réelle, du hasard non contrôlé, de l'ordre d'exécution, ou d'un état partagé non réinitialisé. Le temps est injecté (`now`), le hasard est seedé, `resetMemoryStore()` entre les tests.
- **Oracles forts** : on assert des valeurs exactes (prix en centimes, codes HTTP, textes de charte), pas des approximations.

## 2. Les niveaux de la pyramide et leurs outils

| Niveau | Outil | Cible | Ce qu'on vérifie |
|---|---|---|---|
| Unitaire | Vitest | Fonctions pures (`applyCoupon`, bucketing, éligibilité) | Exactitude math, bornes, fallback, garde promo≥prix |
| Intégration | Vitest + **MSW** + Testing Library | Composants React + hooks + handlers API mockés | États UI (idle/loading/success/error), saisie, validation côté client, accessibilité, charte |
| Contract | Vitest | Route handlers `/api/**` (appel direct) | Auth, Zod 422, idempotence, audit, revalidateTag, codes d'erreur |
| E2E | **Playwright** | Navigateur réel, app montée | Parcours métier visiteur + admin, anti-422, RBAC, charte, i18n |
| Visuel/A11y | Playwright (`toHaveScreenshot`) + axe-core | Pages clés | Régression visuelle module coupon, contraste, focus, ARIA |

## 3. Rôle central de MSW

MSW (Mock Service Worker) est la **colonne vertébrale des tests d'intégration UI**. On intercepte les routes `/api/admin/coupons/**`, `/api/checkout/**`, `/api/checkout/shipping-config` pour :
- tester l'UI admin **sans base de données** (rapide, déterministe) ;
- simuler **tous les états réseau** : succès, `422` (Zod), `403` (RBAC), `409` (conflit de version/stale), `500`, **latence** (spinner), **timeout**, **réponse partielle/corrompue** ;
- vérifier que l'opérateur reçoit le bon **feedback UI** dans chaque cas (toast, message d'erreur inline, état désactivé du bouton, rollback optimiste).

Handlers partagés : `apps/web/src/test/msw/coupons-handlers.ts` (à créer), composables par scénario via `server.use(...)`.

## 4. Données & fixtures

- Fixtures canoniques centralisées : `00-overview/` n'en contient pas ; chaque feature fournit ses `fixtures.*.json/yaml`.
- Coupon de référence Phase 1 (`welcome_auto`, -90 MAD) décrit dans `20-seed-welcome-auto/`.
- Builders de test : `makeCoupon(overrides)`, `makeContext(overrides)` (à implémenter dans `apps/web/src/test/factories/coupons.ts`) pour des fixtures lisibles et minimales.

## 5. Matrice des états à couvrir systématiquement (checklist transverse)

Pour **toute** surface UI/API touchant les coupons, vérifier :

1. **Nominal** (happy path).
2. **Vide** (aucun coupon, liste vide, éligibilité `{}`).
3. **Limite** (montant = prix, pourcentage = 100 %, `endsAt` = maintenant, holdout = 0 et 100).
4. **Invalide** (montant négatif, code dupliqué, promo ≥ prix, devise incohérente).
5. **Erreur réseau** (422/403/409/500/timeout).
6. **Concurrence** (édition simultanée, version stale, double-clic, double soumission).
7. **Cache** (valeur servie après invalidation, bucket non figé).
8. **i18n** (fr / ar — درهم, RTL).
9. **Accessibilité** (focus, ARIA, contraste, navigation clavier).
10. **Charte** (pas de rouge retail, pas de countdown, pas d'emoji, tokens crème/encre/sauge).

## 6. Schéma des fichiers `test-cases.csv`

Colonnes normalisées (séparateur `,`, valeurs avec virgules entre guillemets) :

```
id,feature_id,titre,type,priorite,couche,preconditions,etapes,donnees,resultat_attendu,oracle,risque_couvert,fichier_test_cible
```

- `id` : `CPN-<feat>-<type><nnn>` (voir README §6).
- `type` : `U|I|C|E|V|A|P`.
- `priorite` : `P0` (bloquant release), `P1` (important), `P2` (confort).
- `oracle` : assertion exacte qui tranche pass/fail.
- `fichier_test_cible` : chemin du fichier de test où le cas sera implémenté.

## 7. Definition of Ready / Definition of Done

**DoR (un cas est prêt à être codé)** : risque rattaché, oracle non ambigu, fixtures définies, fichier cible nommé.

**DoD (une fonctionnalité est « testée »)** :
- Tous les cas P0 et P1 implémentés et verts.
- Couverture conforme aux gates (`quality-gates.yaml`).
- Aucun test flaky sur 3 exécutions consécutives.
- Tests E2E du parcours opérateur verts sur Chromium + WebKit.
- Revue croisée du `spec.md` ↔ `test-cases.csv` (traçabilité complète).

## 8. Anti-patterns proscrits

- Tester l'implémentation interne au lieu du comportement observable.
- Mocks qui dupliquent la logique testée (le mock ne doit jamais « savoir » la réponse attendue).
- `sleep`/timers réels en E2E (utiliser `expect.poll`/auto-waiting Playwright).
- Assertions sur des chaînes partielles ambiguës (préférer rôles ARIA + textes exacts de charte).
- Tests dépendants de l'ordre ou d'un état global non réinitialisé.
