# Runbook — exécution de l'audit & correction analytics

> Tout depuis `apps/web/`. Outillage : conventions de `docs/coupon-loyalty-qa-ui-2026-06-03/99-runbook`.

## 0. Reproduire le diagnostic (preuve)
```bash
cd apps/web
# Introspection READ-ONLY de la vraie base : quels event_name existent vs attendus
node --env-file=.env --import tsx scripts/_analytics-introspect.ts
# Attendu : page_view=0, cta_*=0, view_cart=0 ; view_item/begin_checkout/purchase présents.
```

## 1. Vagues (boucle : test repro vert → fix → test spec vert → non-régression)
```bash
cd apps/web

# W0 — fondations test
pnpm test src/test/msw/analytics-handlers.smoke.test.ts
pnpm test src/lib/analytics/queries/funnel.audit.test.ts        # reproduction (prouve AN-02/06)
pnpm test src/lib/analytics/queries/overview.audit.test.ts      # AN-01/07
pnpm test src/lib/analytics/queries/cta.audit.test.ts           # AN-03/08
pnpm test src/lib/analytics/queries/checkout.audit.test.ts      # AN-04
pnpm test src/app/api/track/route.analytics-taxonomy.test.ts    # AN-03 ingest

# W1 — émission/ingestion (fix) puis revérifier via introspection sur preview
#   après fix : re-run les tests de spec [SPEC après-fix] correspondants

# W2 — agrégation (fix mappings + modèle funnel + consent overview)
pnpm test src/lib/analytics/queries

# W3 — insights + filtres
pnpm test src/lib/analytics/insights/refresh.audit.test.ts src/lib/analytics/filters.audit.test.ts

# W4 — composants + e2e + durcissement
pnpm test src/components/admin/analytics
pnpm exec playwright test --project=chromium e2e/admin-analytics-insights.spec.ts
pnpm typecheck && pnpm lint
for i in 1 2 3; do pnpm test src/lib/analytics src/components/admin/analytics || break; done
```

## 2. Vérification après fix d'émission/ingestion (prod-sensible)
```bash
# Sur la base de preview, après déploiement du fix d'émission :
node --env-file=.env --import tsx scripts/_analytics-introspect.ts
# Vérifier : page_view > 0 ; cta_click/cta_impression > 0 ; (engage) scroll_depth/cta_impression > 0.
# Puis ouvrir /admin/analytics : bounce non nul, top pages peuplée, funnel CTA/Checkout/Purchase > 0,
# drop-off cohérent, onglet CTA peuplé, checkout étapes > 0, insights peuplé (après refresh matviews).
```

## 3. Refresh matviews insights (AN-05)
```bash
# Déclencher le refresh (endpoint admin ou cron) — voir lib/analytics/insights/refresh.ts
# POST /api/admin/analytics/insights/refresh  (auth admin)
# Confirmer que getOverview ne renvoie plus firstRun/vide.
```

## 4. Pièges
- `cd apps/web` obligatoire.
- MSW cycle par fichier ; Vitest n'a pas `--repeat-each` (boucle for) ; `--repeat-each` = Playwright.
- Fixtures = événements **réalistes** (event-taxonomy.csv). Ne pas injecter de `page_view`/`cta_*` synthétiques pour « faire passer » un test de reproduction — ce serait masquer le bug.
- W1 touche le tracking prod (ROAS) : valider par introspection avant/après sur preview.

## 5. Sortie
Findings AN-01..AN-07, AN-11 corrigés (tests spec verts) ; non-régression AN-08/09/10 ; traçabilité à jour ; rapport dans `decision-log.md`.
