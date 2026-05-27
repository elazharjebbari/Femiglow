# Vérifications staging

> Procédure complète pour valider le fix sur l'env staging avant ship prod.

## 1. Pré-requis

- PR merged dans `master`
- Vercel preview ou env staging dédié pointant sur DB staging
- Cookie session admin staging
- `CHAT_ADMIN_FILTERS_V2=false` configuré en staging (par défaut)

## 2. Phase A — Migration staging

### 2.1 Backup DB staging

```bash
# Si Neon, créer une branche de sauvegarde
neon branches create --parent staging --name pre-cha-lead-v2

# Ou export SQL standard
pg_dump $STAGING_DATABASE_URL > /tmp/staging-pre-cha-lead-v2.sql
```

### 2.2 Appliquer migration

```bash
# Connecté à staging via env var
DATABASE_URL=$STAGING_DATABASE_URL pnpm drizzle-kit migrate

# Vérifier
psql $STAGING_DATABASE_URL -c "\d chat_session" | grep kind
# Attendu : kind | text | not null | default 'chat'
```

### 2.3 Backfill staging

```bash
DATABASE_URL=$STAGING_DATABASE_URL \
  pnpm tsx scripts/backfill-chat-session-kind.ts --dry-run

# Si OK
DATABASE_URL=$STAGING_DATABASE_URL \
  pnpm tsx scripts/backfill-chat-session-kind.ts --execute
```

### 2.4 Audit post-backfill

```bash
psql $STAGING_DATABASE_URL -f - <<'EOF'
SELECT kind, COUNT(*) FROM chat_session GROUP BY 1 ORDER BY 2 DESC;
SELECT COUNT(*) FROM chat_session WHERE id LIKE 's\_%' ESCAPE '\' AND kind = 'chat';
SELECT COUNT(*) FROM chat_session WHERE id LIKE 'cs\_%' ESCAPE '\' AND kind = 'wizard_pivot';
EOF

# Attendu :
# kind     | count
# chat     | XX
# wizard_pivot | XX
# system   | 0 ou peu

# Les 2 derniers counts : 0 (cohérence)
```

## 3. Phase B — Smoke staging avec flag OFF

```bash
# Vérifier que le flag est OFF
# (Vercel dashboard ou env via CLI)
vercel env ls | grep CHAT_ADMIN_FILTERS_V2

# Smoke
pnpm tsx scripts/smoke-chat-purity.ts \
  --url https://staging.femiglow-maroc.com
# Attendu : 3/3 OK

# Visite manuelle
open https://staging.femiglow-maroc.com/admin/chat/conversations
# Attendu : comportement legacy (toutes sessions visibles)
```

## 4. Phase C — Activer flag en staging

### 4.1 Toggle flag

```bash
vercel env rm CHAT_ADMIN_FILTERS_V2 preview
vercel env add CHAT_ADMIN_FILTERS_V2 preview
# Saisir : true

# Re-deploy preview
vercel deploy --target=preview
```

### 4.2 Re-smoke avec flag ON

```bash
pnpm tsx scripts/smoke-chat-purity.ts \
  --url https://staging.femiglow-maroc.com

# Attendu : 3/3 OK
```

### 4.3 Visite manuelle complète

Login admin et tester :

```bash
open https://staging.femiglow-maroc.com/admin/login
# Login admin@femiglow.local + password
```

**Checklist visite manuelle** :

- [ ] `/admin/chat/conversations` charge sans erreur
- [ ] Liste affiche uniquement les vraies conversations (avec messages)
- [ ] Total count en haut affiche un chiffre cohérent (~10-30 si staging mock data)
- [ ] Cliquer "Voir tout (debug)" → mode debug active, plus de rows visibles
- [ ] `/admin/chat/leads` charge sans erreur
- [ ] Aucun lead avec firstName "yasmine" / "test" / phone +212751592310 (cas pollution wizard observés en preview)
- [ ] Badge `<SourceBadge>` visible sur chaque lead, couleur emerald pour chat_widget
- [ ] Cliquer "Inclure leads wizard (debug)" → leads wizard apparaissent avec badge amber
- [ ] `/admin/leads` (vue globale) charge sans erreur
- [ ] Affiche tous les leads (chat + wizard) sans changement vs avant
- [ ] `/admin/chat/audit` charge et affiche section "Pollution chat_session"
- [ ] Tableaux distribution kind + source remplis
- [ ] Bouton "Prévisualiser" fonctionne (count candidates ghost)

## 5. Phase D — Vérification programmatique

### 5.1 Endpoint audit-pollution

```bash
curl -H "cookie: $(read cookie)" \
  https://staging.femiglow-maroc.com/api/admin/chat/audit-pollution | jq

# Attendu : { timestamp, distributions: { session_kind, lead_source }, coherence }
```

### 5.2 Endpoint cleanup dryRun

```bash
curl -X POST \
  -H "cookie: $cookie" \
  -H 'content-type: application/json' \
  -d '{"dryRun": true, "olderThanDays": 30}' \
  https://staging.femiglow-maroc.com/api/admin/chat/cleanup-ghosts | jq

# Attendu : { candidates: N, archived: 0, dryRun: true, criteria: {...} }
```

### 5.3 Endpoint cleanup execute (TEST DESTRUCTIF)

⚠️ Sur staging uniquement (jamais en prod sans review) :

```bash
curl -X POST \
  -H "cookie: $cookie" \
  -H 'content-type: application/json' \
  -d '{"dryRun": false, "olderThanDays": 30}' \
  https://staging.femiglow-maroc.com/api/admin/chat/cleanup-ghosts | jq

# Attendu : { candidates: N, archived: N, dryRun: false, ... }
```

Re-audit après :

```bash
psql $STAGING_DATABASE_URL -c "
  SELECT status, COUNT(*) FROM chat_session WHERE kind='wizard_pivot' GROUP BY 1
"
# Attendu : statut 'archived' incremented
```

## 6. Phase E — Tests Playwright staging

```bash
PLAYWRIGHT_BASE_URL=https://staging.femiglow-maroc.com \
ADMIN_BOOTSTRAP_EMAIL=$STAGING_ADMIN_EMAIL \
ADMIN_BOOTSTRAP_PASSWORD=$STAGING_ADMIN_PASSWORD \
  pnpm playwright test --grep @chat-purity 2>&1 | tail -15

# Attendu : 7 specs passed
```

## 7. Sentry monitoring staging

```bash
# Vérifier que les erreurs sont reportées
# Vérifier https://sentry.io/organizations/femiglow/issues/?project=staging
# Attendu : 0 nouvelle erreur dans la dernière heure

# Vérifier les events custom
# Logs Vercel staging
vercel logs --since 1h | grep "chat.session.create"
# Attendu : events avec kind='chat' OR kind='wizard_pivot'
```

## 8. Décision GO/NO-GO ship prod

### GO (tous OK)
- [x] Migration staging réussie
- [x] Backfill staging sans incoherence
- [x] Smoke 3/3 OK
- [x] Playwright @chat-purity 7/7 verts
- [x] Visite manuelle conforme
- [x] Endpoint cleanup fonctionne
- [x] 0 erreur Sentry dans 1h
- [x] Lead valide le go

### NO-GO (au moins un fail)
- Investiguer l'origine
- Corriger sur la branche
- Re-déployer staging
- Re-tester du début

## 9. Rollback staging (si besoin)

```bash
# 1. Désactiver flag
vercel env add CHAT_ADMIN_FILTERS_V2 preview
# (mettre false)

# 2. Re-deploy
vercel deploy --target=preview

# 3. Smoke avec flag OFF
pnpm tsx scripts/smoke-chat-purity.ts --url https://staging.femiglow-maroc.com

# 4. Si problème data : restore branche Neon
neon branches restore --target staging --from pre-cha-lead-v2
```

## 10. Documentation post-staging

Sauvegarder dans `docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots/staging-after-2026-05-26.json` :

```bash
psql $STAGING_DATABASE_URL -c "..." > docs/.../snapshots/staging-after.json
```

Comparer avec `pre-migration.json` pour validation.
