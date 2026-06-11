# Commandes canoniques

> **Toujours** `cd apps/web` d'abord. Gestionnaire : `pnpm`.

## Statique
```bash
cd apps/web && pnpm typecheck            # tsc --noEmit
cd apps/web && pnpm lint                 # next lint
```

## Vitest (unit / intégration / composant)
```bash
cd apps/web && pnpm test                                  # tout
cd apps/web && pnpm test src/components/admin/coupons      # un dossier
cd apps/web && pnpm test CouponsManager.create.test.tsx    # un fichier
cd apps/web && pnpm test -t "F08"                          # par id (titre préfixé)
cd apps/web && pnpm vitest run --reporter=verbose <f>      # détaillé
cd apps/web && for i in 1 2 3; do pnpm test <f> || break; done   # anti-flaky (Vitest n'a PAS --repeat-each)
cd apps/web && pnpm test:coverage                          # couverture
```

## Playwright (E2E)
```bash
cd apps/web && pnpm exec playwright test                                   # tout
cd apps/web && pnpm exec playwright test e2e/loyalty-redemption.spec.ts    # un spec
cd apps/web && pnpm exec playwright test --project=chromium
cd apps/web && pnpm exec playwright test --grep @coupon-redemption         # par tag
cd apps/web && pnpm exec playwright test --grep "F17"                      # par id
cd apps/web && pnpm exec playwright test --ui                              # debug interactif
cd apps/web && pnpm exec playwright test --repeat-each=2 <spec>            # anti-flaky
cd apps/web && pnpm exec playwright show-report
```

## Seeds & ops fidélité (E2E)
```bash
cd apps/web && node --env-file=.env --import tsx scripts/seed-coupons.ts            # templates coupons
cd apps/web && node --env-file=.env --import tsx scripts/seed-e2e-loyalty.ts        # template actif + grant pré-activé (F18)
cd apps/web && node --env-file=.env --import tsx scripts/_loyalty-activate-now.ts <CODE>   # forcer activation passée
cd apps/web && node --env-file=.env --import tsx scripts/_loyalty-cleanup.ts        # purge grants de test
```

## Filtrage par identifiant de cas
Chaque test porte son id dans le titre (`it('F02-M009 …')`) :
```bash
cd apps/web && pnpm test -t "F02"                       # Vitest
cd apps/web && pnpm exec playwright test --grep "F16"   # Playwright
```
