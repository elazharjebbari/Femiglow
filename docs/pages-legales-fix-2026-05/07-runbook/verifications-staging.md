# Vérifications staging

## Pré-requis

- PR mergées dans master
- Vercel preview / staging dédié
- Cookie admin staging
- Flag `LEGAL_VARS_V2=false` par défaut staging
- Email `legal@femiglow-maroc.com` setup
- Juriste OK

## Phase A — Migration staging

```bash
# 1. Backup DB staging
neon branches create --parent staging --name pre-legal-v2

# 2. Appliquer migration
DATABASE_URL=$STAGING_DATABASE_URL pnpm drizzle-kit migrate

# Ou direct
psql $STAGING_DATABASE_URL -f apps/web/drizzle/migrations/0075_legal_vars_rename_and_add.sql

# 3. Vérifier
psql $STAGING_DATABASE_URL -c "
SELECT key FROM legal_template_vars
 WHERE key IN ('CONTACT_EMAIL','HOST_ADDRESS','COOLING_OFF_DAYS','CURRENCY','SUPPORT_HOURS');
"
# Attendu : 5+ rows
```

## Phase B — Smoke staging avec flag OFF

```bash
pnpm tsx scripts/smoke-legal-purity.ts --url https://staging.femiglow-maroc.com
# Attendu : 3/3 OK (avec flag OFF, comportement legacy)

# Visite manuelle
open https://staging.femiglow-maroc.com/admin/legal
# Attendu : comportement legacy (drift vars affichées)
```

## Phase C — Activer flag staging

```bash
vercel env add LEGAL_VARS_V2 preview
# Saisir : true

# Re-deploy
vercel deploy --target=preview
```

## Phase D — Smoke + manual

```bash
pnpm tsx scripts/smoke-legal-purity.ts --url https://staging.femiglow-maroc.com

# Visite manuelle
open https://staging.femiglow-maroc.com/admin/legal/template-vars
# Vérifier :
# - Bouton "+ Nouvelle variable" visible
# - 24 vars listées
# - CONTACT_EMAIL, HOST_*, SUPPORT_HOURS présents

# Test création var :
# - KEY : E2E_STAGING_TEST
# - Label : Test
# - Submit
# - Doit créer + revalidate

# Test endpoint cleanup
curl -X DELETE -H "cookie: <admin>" -d '{"dryRun":true,"olderThanDays":7}' \
  https://staging.femiglow-maroc.com/api/admin/legal/cleanup-e2e
# 200 + candidates count
```

## Phase E — Republish 4 pages staging

Via UI admin `/admin/legal/<slug>/edit` pour :
- mentions-legales
- cgv
- confidentialite
- retours-remboursements

Pour chaque :
1. Coller nouveau body_md (cf. `02-backend/templates-refonte.md`)
2. Save
3. Preview `/legal/<slug>?preview=true`
4. Vérifier ICE/RC absents + email contact présent
5. Publier (confirm "PUBLIER")

## Phase F — Playwright staging

```bash
PLAYWRIGHT_BASE_URL=https://staging.femiglow-maroc.com \
ADMIN_BOOTSTRAP_PASSWORD=$STAGING_ADMIN_PASSWORD \
  pnpm playwright test --grep @legal-purity

# Attendu : 7+ specs verts
```

## Phase G — Sentry test

```bash
# Trigger erreur volontaire (fake 500 via curl ?)
curl https://staging.femiglow-maroc.com/legal/non-existent-slug
# 404 attendu, pas d'erreur Sentry

# Vérifier Sentry dashboard : 0 erreur lié à LEGAL-V2
```

## Décision GO/NO-GO ship prod

### GO si :
- [ ] Migration staging OK
- [ ] Smoke 3/3 OK avec flag ON
- [ ] Playwright 7+ verts
- [ ] 4 pages republies + smoke ICE/RC absent
- [ ] Email `legal@` fonctionne (test envoi)
- [ ] 0 erreur Sentry dans 1h
- [ ] Lead valide manuel

### NO-GO si :
- Investiguer + corriger sur branche
- Re-déployer staging
- Re-tester du début
