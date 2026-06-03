# Runbook — batterie QA navigation admin & onglet Coupons

> Tout depuis `apps/web/`. Suivre l'ordre des vagues (cf. `90-action-plan`). Conventions outillage :
> [`coupon-loyalty-qa-ui-2026-06-03/99-runbook`](../../coupon-loyalty-qa-ui-2026-06-03/99-runbook/runbook.md).

## Pré-vol
```bash
cd apps/web && pnpm typecheck
# Vérifier : src/test/msw/nav-settings-handlers.ts créé (W0).
```

## Vagues (boucle de correction par fichier : écrire → run → triage → vert → non-régression)
```bash
cd apps/web
# W0 — fondation MSW
pnpm test src/test/msw/nav-settings-handlers.smoke.test.ts

# W1 — config & contrat
pnpm test src/lib/admin-config/nav-config.test.ts
pnpm test src/lib/admin-config/resolve.nav.test.ts
pnpm test "src/app/api/admin/settings/[section]/route.nav.test.ts"

# W2 — AdminShell + intégration onglet
pnpm test src/components/admin/AdminShell.nav.test.tsx
pnpm test src/app/admin/coupons/page.test.tsx

# W3 — NavEditor
pnpm test src/components/admin/settings/NavEditor.test.tsx
pnpm test src/components/admin/settings/NavEditor.save.test.tsx

# Non-régression périmètre nav
pnpm test src/components/admin src/lib/admin-config "src/app/api/admin/settings"

# W4 — E2E (serveur requis ; baseURL via PLAYWRIGHT_BASE_URL, storageState admin)
pnpm exec playwright test --project=chromium e2e/admin-nav-coupons.spec.ts e2e/admin-nav-editor.spec.ts

# W5 — durcissement
pnpm typecheck && pnpm lint
for i in 1 2 3; do pnpm test src/components/admin/AdminShell.nav.test.tsx src/components/admin/settings || break; done
pnpm exec playwright test --repeat-each=2 e2e/admin-nav-coupons.spec.ts
```

## Pièges
- `cd apps/web` obligatoire (un `cd` ailleurs casse `pnpm vitest` → « command not found »).
- **Vitest n'a PAS `--repeat-each`** (flag Playwright) → boucle `for`.
- MSW : cycle par fichier (`beforeAll listen` / `afterEach reset` / `afterAll close`), policy `onUnhandledRequest:'error'`.
- E2E admin : storageState `.auth/admin.json` produit par `global.setup` ; sans serveur sur le baseURL, les specs échouent en redirection login. En dev-mode, lancer en `--workers=1` si le serveur sature (cf. dossier précédent).
- N03 : tester l'**onglet** au niveau composant (`AdminShell active="coupons"`) ; le RSC réel `/admin/coupons` est couvert par l'E2E N10 (éviter de rendre un RSC async en Vitest).

## Sortie
Toutes les gates vertes → mettre à jour `traceability-matrix.csv` + `feature-inventory.csv` (statut=fait) et
consigner écarts/dette dans `90-action-plan/decision-log.md`.
