# Deploy production — Procédure step-by-step

> Cette procédure couvre V5 ship et chaque release suivante (V5.0.1 hotfix, V5.1.0 minor, V6.0.0 major). Lire intégralement avant de commencer. Compter 2h de bout en bout (incluant smoke test).

## Préconditions — À vérifier la veille

- [ ] CI verte sur la branche release (`release/v5.0.0` ou `master` selon convention).
- [ ] Test ULTIMATE pipeline pass (voir `docs/dossier-chat-v2/12-tests/ultimate-pipeline-test.md`).
- [ ] DoD Release/Ship complétée (voir `09-plan-developpement/definition-of-done.md`).
- [ ] PO Selma a validé la staging dans les 24h précédentes.
- [ ] Care Karim sait que la prod va bouger et est standby.
- [ ] Backup DB prod taken (`pg_dump` daté).
- [ ] Variables d'env prod alignées avec staging (cf. checklist plus bas).
- [ ] Feature flag `ENABLE_CHAT_V2` à `false` en prod (sera `true` à la fin).
- [ ] Slack `#chat-launch` informé : "Deploy V5 lundi 10h, maintenance silencieuse 2h".

## Variables d'environnement requises en prod

```env
# Database
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/femiglow_prod
DATABASE_DIRECT_URL=...  # sans pgbouncer pour migrations

# LLM providers
OPENAI_API_KEY=sk-***
ANTHROPIC_API_KEY=sk-ant-***
MISTRAL_API_KEY=***
GEMINI_API_KEY=***

# Webhooks
N8N_WEBHOOK_URL=https://n8n.femiglow.com/webhook/lead
N8N_HMAC_SECRET=***  # 32+ bytes random

# Sessions admin
ADMIN_SESSION_SECRET=***  # 32+ bytes random

# Sentry
SENTRY_DSN=https://***@sentry.io/***
NEXT_PUBLIC_SENTRY_DSN=...

# Feature flags
ENABLE_CHAT_V2=false  # passera à true en fin de déploiement

# Budget
LLM_BUDGET_USD_MONTHLY=300
LLM_BUDGET_ALERT_THRESHOLDS=0.5,0.8,1.0

# Service level overrides (optionnel, défaut = auto)
SERVICE_LEVEL_MANUAL=  # vide = auto

# Rate limits
RATE_LIMIT_PER_IP_PER_HOUR=100
LEAD_RATE_LIMIT_PER_PHONE=3
```

## Étape 1 — Préparation (T-30 min, 10h CET le jour J)

### 1.1 Confirmer équipe sur place

```bash
# Slack message check-in dans #chat-launch
"Deploy V5 démarrage T-30. Équipe prête ?
- dev_lead : ✋
- dev_intermediate : ✋
- po_selma : ✋
- care_karim : ✋ (standby)"
```

### 1.2 Vérifier état staging (dernière fois)

```bash
# Smoke test staging avant deploy prod
curl -s https://staging.femiglow.com/api/chat/health | jq '.serviceLevel'
# Doit retourner 1 (NOMINAL)

curl -s -X POST https://staging.femiglow.com/api/chat/session \
  -H 'Content-Type: application/json' \
  -d '{"audience":"b2c","language":"fr"}' | jq '.sessionId'
# Doit retourner un UUID
```

### 1.3 Backup DB prod

```bash
# Sur server admin (ou local avec accès)
pg_dump $DATABASE_URL_PROD \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=backups/femiglow_prod_pre_v5_$(date +%Y%m%d_%H%M%S).dump

# Vérifier taille raisonnable
ls -lh backups/
```

**Conservation** : 30 jours minimum sur stockage froid (S3 Glacier).

### 1.4 Snapshot Vercel deployment courant

```bash
vercel ls --prod | head -5
# Noter le deployment ID actuel (rollback target si besoin)
echo "PREVIOUS_DEPLOYMENT_ID=dpl_xxx" >> deploy-session.log
```

## Étape 2 — Migrations DB (T-10 min)

### 2.1 Dry-run migrations sur staging (re-validation)

```bash
# Confirmer rollback path testé
npm run db:migrate:status -- --env=staging
# Voit toutes les migrations appliquées + pending

npm run db:migrate:up -- --env=staging --dry-run
# Output SQL sans exécuter
```

### 2.2 Appliquer migrations prod

```bash
# DIRECT URL (pas via pgbouncer) pour migrations
DATABASE_URL=$DATABASE_DIRECT_URL_PROD \
  npm run db:migrate:up -- --env=prod

# Doit afficher
# ✓ 0017_intent_centroids.sql
# ✓ 0018_intent_examples.sql
# ...
# ✓ 0027_rgpd_retention_columns.sql
# 11 migrations applied in 12.4s
```

### 2.3 Vérifier intégrité post-migration

```bash
psql $DATABASE_URL_PROD <<EOF
SELECT COUNT(*) FROM intent_centroids;
SELECT COUNT(*) FROM canned_pairs;
SELECT COUNT(*) FROM chat_faq_entries;
SELECT COUNT(*) FROM kb_chunks;
\d+ kb_chunks;  -- vérifier index HNSW présent
EOF
```

**Si migration échoue** → voir `rollback.md` section "Rollback migrations".

## Étape 3 — Seeds prod (T-5 min)

### 3.1 Seeds production-safe (idempotent)

```bash
# Ces seeds sont idempotent (ON CONFLICT DO NOTHING)
npm run db:seed:prod:intents
npm run db:seed:prod:pairs
npm run db:seed:prod:faq
npm run db:seed:prod:kb-initial
```

### 3.2 Calcul initial centroïdes

```bash
# Premier compute centroïdes (cron prendra le relai ensuite)
npm run cron:intent-recompute -- --once
```

## Étape 4 — Deploy Vercel (T-0)

### 4.1 Déclencher deploy prod

```bash
# Option A : via GitHub merge sur master (CI deploy auto)
git checkout master
git merge --no-ff release/v5.0.0
git push origin master
git tag v5.0.0
git push origin v5.0.0

# Option B : via Vercel CLI direct
vercel --prod
```

### 4.2 Attendre build

```bash
vercel ls --prod | head -1
# Status doit passer : BUILDING → READY
# Durée typique : 3-5 min
```

### 4.3 Vérifier deployment id

```bash
NEW_DEPLOYMENT_ID=$(vercel ls --prod --limit=1 --json | jq -r '.[0].uid')
echo "NEW_DEPLOYMENT_ID=$NEW_DEPLOYMENT_ID" >> deploy-session.log
```

## Étape 5 — Smoke test post-deploy (T+5 min)

### 5.1 Health endpoint

```bash
curl -s https://femiglow.com/api/chat/health | jq
# Attendu :
# {
#   "serviceLevel": 1,
#   "providers": { "openai": "ok", "anthropic": "ok", ... },
#   "uptime": "..."
# }
```

### 5.2 Session creation

```bash
SESSION=$(curl -s -X POST https://femiglow.com/api/chat/session \
  -H 'Content-Type: application/json' \
  -d '{"audience":"b2c","language":"fr"}')
SESSION_ID=$(echo $SESSION | jq -r '.sessionId')
echo "Test session: $SESSION_ID"
```

### 5.3 Message simple (canned)

```bash
curl -N -X POST https://femiglow.com/api/chat/message \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"text\":\"bonjour\"}"
# Doit streamer 7 events SSE incluant un event canned ou delta
```

### 5.4 Lead form submission

```bash
curl -X POST https://femiglow.com/api/chat/lead \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"phone\":\"+212600000000\",\"city\":\"Casablanca\",\"intent\":\"smoke-test\"}"
# Doit retourner 200 + leadId
```

### 5.5 Admin login

```bash
# Manuel : ouvrir https://femiglow.com/admin
# Login avec credentials test
# Vérifier sidebar visible + leads inbox visible
```

## Étape 6 — Activer feature flag (T+10 min)

```bash
# Mettre à jour env Vercel
vercel env rm ENABLE_CHAT_V2 production
echo "true" | vercel env add ENABLE_CHAT_V2 production

# Redéployer pour propager (Vercel ne hot-reload pas env)
vercel --prod
```

**Attention** : ce redeploy peut prendre 3-5 min. C'est la dernière étape risquée.

## Étape 7 — Monitoring 1h post-deploy (T+10 min → T+1h10)

### 7.1 Dashboards à surveiller

- **Sentry** : pas de nouveau type d'erreur dans 30 dernières minutes.
- **Dashboard Health** (Grafana) : service level = 1 stable.
- **Dashboard Business** : chat_opened events arrivent.
- **Vercel logs** : pas de 500 systématique.

### 7.2 Métriques cible

| Métrique | Cible 1h post-deploy |
|---|---|
| Error rate | < 1% |
| First token p50 | < 800ms |
| Provider success | > 99% |
| Session creation success | > 99.5% |
| Sentry P0/P1 | 0 |

### 7.3 Si tout vert à T+1h10

```bash
# Slack annonce dans #chat-launch
"✅ V5 déployé avec succès, smoke tests passés, monitoring 1h vert.
- Deployment ID : $NEW_DEPLOYMENT_ID
- Tag : v5.0.0
- Métriques nominales
- Care team standby reste activée 24h

Merci équipe ! 🎉"
```

## Étape 8 — Post-deploy J+1, J+2, J+7

### 8.1 J+1 (lendemain matin)

- [ ] Review Sentry alerts overnight (anomalies ?)
- [ ] Review budget consommé J+0 vs forecast
- [ ] Review premiers leads créés en prod par Care
- [ ] Premier daily standup post-ship — questions / retours

### 8.2 J+2

- [ ] Premier KPI review (chat_to_purchase_conversion_rate baseline)
- [ ] Premier care feedback (Karim debrief)
- [ ] Hot fixes si applicable (tag v5.0.1)

### 8.3 J+7

- [ ] Review uptime semaine (cible > 99.5%)
- [ ] Review provider mix (qui a servi combien)
- [ ] Décision Gate V5 → V6 (PO Selma)
- [ ] Retro release publiée

## Variantes deploy

### Hotfix (v5.0.X)

Mêmes étapes mais :
- Pas de seeds (déjà en place).
- Pas de migration (sauf urgence schema).
- Smoke test focused sur le fix.
- Pas de "monitoring 1h" obligatoire (mais recommandé si fix touche pipeline core).

### Minor release (v5.X.0)

Mêmes étapes + :
- Communication marketing si user-facing nouveau (par PO Selma).
- Annonce stakeholders externes.

### Major release (vX.0.0)

Mêmes étapes + :
- War room sur place pendant 4h post-deploy.
- Communication CEO + investisseurs.
- Plan de rollback étendu.

## Commandes utiles cheat-sheet

```bash
# Status courant
vercel ls --prod --limit=3
psql $DATABASE_URL_PROD -c "SELECT version();"
curl -s https://femiglow.com/api/chat/health | jq

# Logs en live
vercel logs --since 5m --follow

# Sentry CLI
sentry-cli releases list --org femiglow --project chat-v2 | head -5
sentry-cli releases set-commits v5.0.0 --auto

# Backup à la volée
pg_dump $DATABASE_URL_PROD --format=custom --file=quick_backup.dump
```

## Anti-patterns deploy

- ❌ Déployer vendredi soir : si bug, on perd le weekend.
- ❌ Déployer sans backup DB pris dans la dernière heure.
- ❌ Déployer sans avoir testé le rollback récemment (< 7 jours).
- ❌ Déployer sans care team prévenue.
- ❌ Déployer avec feature flag déjà activé (on perd l'option du rollback partiel).
- ❌ Ignorer une erreur Sentry "isolée" pendant les 30 premières minutes.
