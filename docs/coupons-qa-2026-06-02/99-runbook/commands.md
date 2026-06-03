# Commandes — référence détaillée

> Toutes les commandes s'exécutent depuis `apps/web/`. Adapter `pnpm` si le repo utilise un autre runner.

## Tests unitaires & intégration (Vitest)

```bash
pnpm test                                  # toute la suite
pnpm test --watch                          # mode watch (dev)
pnpm test --coverage                       # avec couverture (gates)
pnpm test src/lib/coupons                  # un dossier
pnpm test engine.test.ts                   # un fichier
pnpm test -t "applyCoupon fixed_amount"    # un cas par nom
pnpm vitest run --reporter=verbose         # sortie détaillée
```

## Couverture ciblée (vérifier les gates)

```bash
pnpm test src/lib/coupons --coverage       # engine doit être 100%
# Lire le tableau coverage ; comparer à 00-overview/quality-gates.yaml
```

## Migration Drizzle

```bash
pnpm exec drizzle-kit generate             # génère drizzle/migrations/0080_coupons.sql
pnpm exec drizzle-kit migrate              # applique (env avec DATABASE_URL)
# Vérifier idempotence : ré-appliquer ne doit rien casser
```

## Seed coupon welcome_auto

```bash
pnpm run seed:coupons                      # à créer (registry seeders)
pnpm run seed:coupons                      # 2e run = 0 doublon (idempotent)
```

## E2E (Playwright)

```bash
pnpm exec playwright test                          # tous les specs
pnpm exec playwright test e2e/visitor-coupon.spec.ts
pnpm exec playwright test e2e/admin-coupon.spec.ts
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=webkit
pnpm exec playwright test --grep @charte           # tag charte
pnpm exec playwright test --grep @a11y             # tag accessibilité
pnpm exec playwright test --ui                     # mode UI (debug)
pnpm exec playwright test --repeat-each=3          # anti-flaky (3 reruns)
pnpm exec playwright show-report                   # rapport HTML
```

## Régression visuelle

```bash
pnpm exec playwright test --grep @visual
pnpm exec playwright test --grep @visual --update-snapshots   # MAJ baselines (après revue)
```

## Accessibilité (axe-core)

```bash
pnpm exec playwright test --grep @a11y    # 0 violation critique/grave attendu
```

## Qualité statique

```bash
pnpm lint
pnpm typecheck            # ou: pnpm exec tsc --noEmit
```

## Anti-flaky (stabilité)

```bash
pnpm vitest run --repeat-each 3 src/lib/coupons
pnpm exec playwright test --repeat-each=3
```

## Filtres utiles par feature (CPN-…)

Convention : nommer chaque test avec son ID `CPN-08-E012` dans le titre permet :

```bash
pnpm test -t "CPN-08"                      # tous les cas de la feature 08
pnpm exec playwright test --grep "CPN-08"
```
