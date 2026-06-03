# Plan d'action global — Implémentation & exécution de la batterie de tests

> Méthode : TDD/BDD piloté par les specs du dossier, livraison par vagues, **boucle de correction** systématique, gates qualité bloquants (`00-overview/quality-gates.yaml`).
> Principe : on n'avance à la vague N+1 que si les gates de la vague N sont verts.

## 0. Préalables (décisions à trancher avant de coder)

Ces points ont été relevés par la conception et doivent être arbitrés (1 ligne chacun) :

| ID | Décision | Recommandation | Impact |
|---|---|---|---|
| D-1 | Code HTTP des erreurs Zod sur les routes coupons | **422** (le dossier l'exige) via mapping dédié — or `HttpError('invalid_input')` mappe 400 par défaut (`lib/errors/http-error.ts`) | Oracles des tests C (CPN-10/13) |
| D-2 | Re-seed welcome_auto : préserver `status=paused` si déjà modifié ? | **Oui** (ne pas réactiver un coupon volontairement mis en pause) | CPN-20 |
| D-3 | Comportement holdout en Phase 1 | `holdoutPct=0` (tout treatment) ; brancher le contrat holdout mais ne pas l'activer | CPN-19/04/08 |
| D-4 | Algorithme de hash du bucketing | Hash stable implémentation-définie (ex. FNV-1a / sha1 tronqué) ; les tests figent le **contrat** (stabilité/distribution), pas le mapping | CPN-19 |
| D-5 | Textes arabes du module | Clés i18n ; copie ar validée par la rédaction maison avant gate G-I18N | CPN-14/15 |
| D-6 | Champ « code d'invitation » Phase 1 | **Option A** : disclosure sans champ (inerte total) | CPN-15 |

## 1. Vagues de livraison (chaque vague = code + tests, gate avant suite)

### Vague 0 — Fondations de test (outillage)
**But** : rendre la batterie exécutable avant toute logique métier.
- Créer `apps/web/src/test/msw/{server.ts,coupons-handlers.ts,checkout-handlers.ts}`.
- Créer `apps/web/src/test/factories/coupons.ts` (`makeCoupon`, `makeContext`, `makeCouponEvent`).
- Brancher MSW dans le setup Vitest ; vérifier `resetMemoryStore()` global.
- **Gate** : un test « smoke » MSW + un test factory verts.

### Vague 1 — Data & migration (CPN-01, CPN-17, CPN-20)
- Finaliser tables `coupons`/`coupon_events` (déjà au schéma) → générer `0080_coupons.sql` via `drizzle-kit generate`.
- Implémenter `coupon-repo.ts` + `coupon-event-repo.ts` (dual-driver) + `seed welcome_auto`.
- **Tests** : CPN-01 (U/C), CPN-20 (U/C), socle CPN-17 (U).
- **Gate** : migration forward idempotente ; insertions valides/invalides ; contrainte unique + idempotence converted ; seed ré-entrant.

### Vague 2 — Moteur (CPN-02, CPN-03, CPN-19, CPN-04, CPN-05, CPN-18)
- `lib/coupons/{engine.ts,context.ts,bucketing.ts,eligibility.ts,cache.ts}`.
- **Tests** : tout le niveau unitaire (`engine.test.ts` etc.), table de vérité applyCoupon, déterminisme holdout (10 000 tirages), équivalence contexte SC↔API, cache/invalidation.
- **Gate** : couverture engine = 100 % ; G-HOLDOUT-DETERMINISM ; G-FALLBACK-LEGACY ; G-PRICE-PARITY (niveau unitaire).

### Vague 3 — Branchements prix & checkout (CPN-06, CPN-07, CPN-08, CPN-09, CPN-16) — **CŒUR**
- Brancher `resolveProductPricing` dans `public.ts`, `KitCommanderSectionBound`, `order-repo.ts` (effectivePrice coupon-aware + `couponContext` dans `CreateOrderInput`), `order/route.ts` (contexte + event converted), `kit/page.tsx` (event exposed).
- **Tests** : intégration MSW (PriceBlock, snapshot), contract route (tous codes), **test d'intégration repricing anti-422** (snapshot.totalCents === recompute), events idempotents, tracking value=199.
- **Gate** : G-PRICE-PARITY (intégration + contract) ; G-IDEMPOTENCE ; G-TRACKING-VALUE.

### Vague 4 — Admin (CPN-10, CPN-11, CPN-12, CPN-13)
- Routes `api/admin/coupons/**`, pages `admin/coupons/**`, RBAC additif (`coupons` dans matrice).
- **Tests** : intégration MSW (formulaires, tous états réseau), contract (auth/Zod/idempotence/audit), RBAC (rôle×route×verbe), stats/uplift.
- **Gate** : G-RBAC ; couverture api_routes ≥ 90 % ; ui_components ≥ 85 %.

### Vague 5 — UI landing (CPN-14, CPN-15)
- Composant `CouponWelcomeNote` + disclosure, insertion `PriceBlock`.
- **Tests** : intégration (conditions+textes+charte), visuel (`toHaveScreenshot`), a11y (axe-core), i18n fr/ar.
- **Gate** : G-CHARTE ; G-A11Y ; G-I18N.

### Vague 6 — E2E bout-en-bout & durcissement
- Parcours Playwright complets : visiteur (`/kit`→commande, anti-422) + opérateur (`/admin/coupons` CRUD→activation→/kit→stats).
- Matrice navigateurs (Chromium, WebKit, iPhone 13).
- **Gate** : tous les gates fonctionnels verts sur 3 reruns ; 0 flaky.

## 2. Boucle de correction (à chaque vague)

```
   ┌──────────────────────────────────────────────────────────┐
   │ 1. RUN     : exécuter les tests de la vague (cf. runbook)  │
   │ 2. TRIAGE  : classer les échecs (cf. 99-runbook/triage)   │
   │ 3. ROOT    : cause racine (code ? test ? spec ?)          │
   │ 4. FIX     : corriger la bonne couche (jamais le test     │
   │              pour masquer un bug réel)                    │
   │ 5. RE-RUN  : la vague entière (non-régression)            │
   │ 6. GATE    : vérifier quality-gates.yaml                  │
   │ 7. STABLE  : 3 reruns verts consécutifs → vague close     │
   └──────────────────────────────────────────────────────────┘
              ↑                                        │
              └────────── si non stable / gate rouge ──┘
```

Règles de la boucle :
- **Un échec = un ticket** dans `execution-board.csv` (statut, cause, couche, correctif).
- **Jamais** « corriger » un test pour le faire passer si le bug est réel : remonter à la spec si l'attendu est ambigu (mettre à jour `spec.md` ET le test).
- **Quarantaine** : un test flaky est isolé (`test.fixme`) avec ticket, jamais supprimé silencieusement.
- **Régression** : tout bug corrigé reçoit un test de non-régression rattaché à son `CPN-…`.

## 3. Critère de sortie global (release Phase 1)

- 100 % des cas **P0** verts, ≥ 95 % des **P1** verts.
- Tous les **gates fonctionnels** (`quality-gates.yaml`) au vert.
- 0 test flaky sur 3 exécutions.
- E2E visiteur + opérateur verts sur Chromium + WebKit.
- Rollback validé (désactiver coupon → fallback 199 → 289, sans 422).
- Revue de traçabilité : chaque ligne de `traceability-matrix.csv` couverte.

## 4. Séquencement & dépendances

```
Vague 0 ─► Vague 1 ─► Vague 2 ─► Vague 3 ─► Vague 4 ─► Vague 5 ─► Vague 6
(outillage)(data)   (moteur)  (prix/checkout)(admin)  (UI)     (E2E)
```
Vagues 4 et 5 peuvent être menées en parallèle après la Vague 3 (indépendantes), mais la Vague 6 exige les deux.
