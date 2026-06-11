# Exécution pas-à-pas

## J+0 — Prep

```bash
# 1. Setup
cd /Users/elazhar/PycharmProjects/template-femiglow
git fetch origin && git checkout master && git pull
nvm use 20
cd apps/web && pnpm install

# 2. Baseline tests
pnpm vitest run 2>&1 | tail -5
# Noter le count

# 3. Branche
cd /Users/elazhar/PycharmProjects/template-femiglow
git checkout -b fix/legal-pages-pollution-and-privacy
git push -u origin fix/legal-pages-pollution-and-privacy

# 4. Snapshot
psql $DATABASE_URL -t -A -c "
SELECT json_build_object(
  'timestamp', NOW()::text,
  'total_pages', (SELECT COUNT(*) FROM legal_pages),
  'pages_by_status', (SELECT json_object_agg(status, n) FROM (SELECT status, COUNT(*) AS n FROM legal_pages GROUP BY 1) t),
  'total_vars', (SELECT COUNT(*) FROM legal_template_vars),
  'vars_by_key', (SELECT json_object_agg(key, value IS NOT NULL AND value != '') FROM legal_template_vars)
)" > docs/pages-legales-fix-2026-05/04-data-strategy/snapshots/pre-migration.json

# 5. Flag dans .env
echo "LEGAL_VARS_V2=false" >> apps/web/.env

# 6. Contact juriste — envoyer email avec wording proposé
# (cf. 02-backend/templates-refonte.md §9)
```

---

## J+1 — Backend

```bash
# 1. Créer feature-flag.ts
cat > apps/web/src/lib/legal/feature-flag.ts <<'EOF'
import { env } from '@/lib/env';
export function isLegalVarsV2Enabled(): boolean {
  return env.LEGAL_VARS_V2 === 'true';
}
EOF

# 2. Étendre env.ts
# (édit manuel — ajouter LEGAL_VARS_V2: z.enum(...).default('false'))

# 3. Migration SQL
# Créer apps/web/drizzle/migrations/0075_legal_vars_rename_and_add.sql
# Cf. 02-backend/migrations.md §1

# 4. Appliquer migration
pnpm db:migrate-safe

# Si la 0075 n'est pas pickée par drizzle :
psql $DATABASE_URL -f apps/web/drizzle/migrations/0075_legal_vars_rename_and_add.sql

# 5. Vérifier migration
psql $DATABASE_URL -c "SELECT key FROM legal_template_vars ORDER BY key;"
# Doit lister CONTACT_EMAIL, HOST_*, etc. (pas COMPANY_EMAIL legacy)

# 6. Étendre vars.ts avec presetVarsForPage
# (édit manuel — cf. 02-backend/helpers.md §2)

# 7. Créer cleanup.ts
# (cf. 02-backend/helpers.md §3)

# 8. Étendre repository.ts avec createTemplateVar
# (cf. 02-backend/helpers.md §5)

# 9. Créer template-vars-helpers.ts
# (cf. 02-backend/helpers.md §4)

# 10. Endpoints
# Créer src/app/api/admin/legal/template-vars/route.ts (étendre avec POST)
# Créer src/app/api/admin/legal/cleanup-e2e/route.ts
# (cf. 02-backend/api-routes.md)

# 11. Type check
pnpm typecheck 2>&1 | grep "src/lib/legal\|src/app/api/admin/legal" | head -10
# Doit être vide (ou seulement les pré-existants)

# 12. Smoke local
curl -X DELETE -H 'content-type: application/json' \
  -d '{"dryRun":true,"olderThanDays":7}' \
  http://localhost:3001/api/admin/legal/cleanup-e2e
# Sans cookie → 401 ✅

# 13. Commit
git add -A
git commit -m "feat(legal-v2): T0+T1 — backend + migration + endpoints"
```

---

## J+2 — Templates refonte

```bash
# 1. Attendre validation juriste (passive)

# 2. Refonte 4 templates
# Édit manuel : docs/legal-pages/60-content/mentions-legales.md
# Édit manuel : docs/legal-pages/60-content/cgv.md
# Édit manuel : docs/legal-pages/60-content/confidentialite.md
# Édit manuel : docs/legal-pages/60-content/retours-remboursements.md
# Cf. 02-backend/templates-refonte.md

# 3. Republish via admin /admin/legal/<slug>/edit
# - Coller nouveau body_md
# - Save → status passe en review/draft
# - Vérifier preview /legal/<slug>
# - Publier avec confirm "PUBLIER"

# 4. Smoke local
pnpm tsx scripts/smoke-legal-purity.ts --url http://localhost:3001
# Doit retourner OK pour mentions_legales, anonymization_marketing

# 5. Vérifier visuellement
open http://localhost:3001/legal/mentions-legales
# Ne doit PAS contenir d'ICE de 15 chiffres en clair
# Doit contenir "legal@femiglow-maroc.com"

# 6. Commit
git add -A
git commit -m "feat(legal-v2): T2 — refonte templates anonymisés"
```

---

## J+3 — Anonymisation + cleanup

```bash
# 1. Anonymiser 6 fichiers marketing
# Cf. 03-frontend-ui-ux/anonymisation-marketing.md pour diffs précis

# Édit manuels :
# - apps/web/src/app/(marketing)/maison/page.tsx
# - apps/web/src/app/(marketing)/contact/page.tsx
# - apps/web/src/app/(marketing)/kit/page.tsx
# - apps/web/src/app/(marketing)/rituel/page.tsx
# - apps/web/src/app/api/rituals/policy/route.ts

# 2. Test invariant
# Créer src/app/(marketing)/__tests__/no-founder-name.test.ts
# Cf. 03-frontend-ui-ux/anonymisation-marketing.md §test invariant

# 3. Run test
pnpm vitest run src/app/\(marketing\)/__tests__/no-founder-name.test.ts

# 4. Cleanup E2E orphelins
# Option A : SQL direct
psql $DATABASE_URL -c "
DELETE FROM legal_pages
 WHERE slug LIKE 'e2e-test-%' AND status = 'draft';
"

# Option B : via endpoint (après auth admin)
curl -X DELETE -H "cookie: <admin>" -H 'content-type: application/json' \
  -d '{"dryRun":false,"olderThanDays":7}' \
  http://localhost:3001/api/admin/legal/cleanup-e2e

# 5. Identifier test Playwright fautif
grep -rn "e2e-test-" apps/web/e2e/ apps/web/src/test/ 2>&1 | head -5

# 6. Ajouter cleanup hook au test fautif (afterAll)

# 7. Grep final
grep -ri "souheila\|souheïla" apps/web/src/app/\(marketing\)/
# Doit retourner 0

# 8. Commit
git add -A
git commit -m "feat(legal-v2): T3 — anonymisation marketing + cleanup E2E"
```

---

## J+4 — Tests

```bash
# 1. Créer fichiers vitest unit
# - src/lib/legal/vars.presetVarsForPage.test.ts
# - src/lib/legal/feature-flag.test.ts
# - src/lib/legal/cleanup.test.ts
# - src/lib/legal/repository.createTemplateVar.test.ts
# - src/lib/legal/template-vars-helpers.test.ts
# - src/lib/legal/__tests__/invariants.test.ts
# - src/app/api/admin/legal/template-vars/route.test.ts
# - src/app/api/admin/legal/cleanup-e2e/route.test.ts
# Cf. 05-tests/unit-vitest.md

# 2. Créer fichiers MSW intégration
# - src/test/integration/legal-vars-rename.integration.test.ts
# - src/test/integration/legal-create-var.integration.test.ts
# - src/test/integration/legal-cleanup-e2e.integration.test.ts
# - src/test/integration/legal-publish-end-to-end.integration.test.ts
# Cf. 05-tests/integration-msw.md

# 3. Créer Playwright
# - e2e/legal-purity.spec.ts
# - e2e/a11y/legal-admin.spec.ts
# Cf. 05-tests/e2e-playwright.md

# 4. Créer scripts/smoke-legal-purity.ts
# Cf. 05-tests/e2e-playwright.md

# 5. Frontend
# - src/components/admin/legal/CreateVarForm.tsx
# - src/components/admin/legal/CreateVarForm.test.tsx
# - (optionnel) src/components/admin/legal/CleanupE2EButton.tsx
# Cf. 03-frontend-ui-ux/components.md

# 6. Modifier pages admin
# - src/app/admin/legal/template-vars/page.tsx
# Cf. 03-frontend-ui-ux/pages-admin.md

# 7. Run all tests
pnpm vitest run src/lib/legal/ src/app/api/admin/legal/
pnpm vitest run src/test/integration/legal-*

# 8. Activer flag pour Playwright
LEGAL_VARS_V2=true pnpm playwright test --grep @legal-purity

# 9. Smoke
LEGAL_VARS_V2=true pnpm tsx scripts/smoke-legal-purity.ts

# 10. Commit
git add -A
git commit -m "test(legal-v2): T4 — vitest + MSW + Playwright"
```

---

## J+5 — Backfill data + monitoring

```bash
# 1. Snapshot post-fix
psql $DATABASE_URL -t -A -c "
SELECT json_build_object(
  'timestamp', NOW()::text,
  'note', 'Post-fix complet',
  'total_pages', (SELECT COUNT(*) FROM legal_pages),
  'e2e_orphans', (SELECT COUNT(*) FROM legal_pages WHERE slug LIKE 'e2e-test-%'),
  'total_vars', (SELECT COUNT(*) FROM legal_template_vars),
  'drift_count', (
    WITH used AS (SELECT DISTINCT regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m FROM legal_pages WHERE slug NOT LIKE 'e2e%')
    SELECT COUNT(*) FROM used WHERE m[1] NOT IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION')
      AND NOT EXISTS (SELECT 1 FROM legal_template_vars WHERE key = m[1])
  )
)" > docs/pages-legales-fix-2026-05/04-data-strategy/snapshots/post-migration.json

# 2. Vérifier drift_count = 0 dans le JSON
cat docs/pages-legales-fix-2026-05/04-data-strategy/snapshots/post-migration.json | jq

# 3. Configurer Sentry rules (manuel via dashboard)

# 4. Configurer Plausible events (manuel via dashboard)

# 5. Cron weekly cleanup-e2e
# - Créer src/app/api/cron/legal/cleanup-e2e/route.ts
# - Ajouter dans vercel.json
# Cf. 04-data-strategy/monitoring.md §5

# 6. Commit
git add docs/pages-legales-fix-2026-05/04-data-strategy/snapshots/
git commit -m "data(legal-v2): T5 — snapshots + cron cleanup"

# 7. Push
git push origin fix/legal-pages-pollution-and-privacy
```

---

## J+6 — Ship

Cf. `verifications-staging.md` + `deploiement-prod.md` pour procédures détaillées.

---

## J+7 — Obs

```bash
# Sentry : checker toutes 2-4h
# Vérifier dashboard /admin/legal/audit (si créé)
# Vérifier KPIs business
# Decision : maintenir flag ON ou rollback
```
