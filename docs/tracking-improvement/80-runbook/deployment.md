# 80.1 — Runbook de déploiement

## Pré-requis

- [ ] Tous les tests Jest verts (`pnpm test`)
- [ ] Tous les e2e Playwright verts (`pnpm test:e2e`)
- [ ] **Test ultime pipeline** vert
- [ ] Code review approuvée
- [ ] Migrations testées en staging
- [ ] OAuth Google Ads configuré (refresh token chiffré, customer_id en DB)
- [ ] Documentation à jour (ce dossier)
- [ ] Backup DB récent (< 24h)

## Étapes

### 1. Phase préparatoire (J-1)

```bash
# Sur le serveur prod
cd /var/www/femiglow
git fetch origin master
git log master..origin/master --oneline  # vérifier les commits à déployer

# Backup DB
pnpm --filter @femiglow/web reset list-backups
# Si pas de backup récent : créer
pnpm --filter @femiglow/web reset run --mode=soft --confirm=RESET --skip-after=backup --non-interactive
```

### 2. Mode maintenance (optionnel mais recommandé)

```bash
# Activer maintenance via tracking_settings ou env var
# Cf. tracking_settings.maintenance_mode = true
```

### 3. Déploiement code

```bash
# Pull code
git pull --ff-only origin master

# Stop service
sudo systemctl stop femiglow.service

# Migrations DB
pnpm --filter @femiglow/web db:migrate 2>&1 | tee /var/log/femiglow-migrate-$(date +%F).log

# Vérifier migrations appliquées
psql "$DATABASE_URL" -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5"

# Build
rm -rf apps/web/.next
pnpm --filter @femiglow/web build 2>&1 | tee /var/log/femiglow-build-$(date +%F).log

# Start service
sudo systemctl start femiglow.service

# Wait for listening
until ss -tlnp | grep -q ':8011'; do sleep 2; done
```

### 4. Smoke tests

Voir `smoke-tests.md` pour la liste complète. Quick :

```bash
# Health
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8011/api/health
# /kit accessible
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8011/kit
# /admin/tracking accessible (need auth)
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8011/admin/tracking
```

### 5. Vérification fonctionnelle

- [ ] Login admin OK
- [ ] `/admin/tracking/gtm` liste les versions
- [ ] `/admin/tracking/events/categorization` charge correctement
- [ ] `/admin/tracking/analytics/providers` affiche les KPIs
- [ ] Test manuel : créer une nouvelle version GTM via wizard
- [ ] Test manuel : envoyer un test event Google Ads CAPI via `/admin/tracking/test-event`

### 6. Vérification Google Ads CAPI

```bash
# Envoyer une conversion test
curl -sS -b "$AUTH_COOKIE" -X POST http://127.0.0.1:8011/api/admin/tracking/test-event \
  -H 'Content-Type: application/json' \
  -d '{
    "providerId": "tp_gads_001",
    "eventName": "purchase",
    "params": {
      "transaction_id": "test-deploy-' "$(date +%s)" '",
      "value": 1.00,
      "currency": "MAD",
      "email": "test@femiglow-maroc.com"
    }
  }' | jq

# Attendre 30s, vérifier dans Google Ads UI :
# Tools & Settings → Conversions → Conversion Actions → Last conversion
```

### 7. Désactiver maintenance

```bash
# Désactive maintenance
```

### 8. Monitor 1h post-deploy

- Watch logs : `journalctl -u femiglow.service -f`
- Watch dashboard `/admin/tracking/analytics/providers`
- Watch GA4 real-time
- Watch Meta Events Manager

## Timing

| Étape | Durée estimée |
|---|---|
| Préparatoire | 10 min |
| Maintenance + stop | 1 min |
| Migrations | 1-2 min |
| Build | 3-5 min |
| Start + smoke | 2 min |
| Vérifs fonctionnelles | 10 min |
| Test Google Ads CAPI | 5 min |
| **Total** | **30-35 min** |

## Window de déploiement recommandée

- **Évite** : 14h-18h (peak trafic)
- **Préfère** : 02h-06h ou 10h-12h
- **Jour** : mardi-jeudi (pas vendredi soir / lundi matin)

## Communication

- Annonce Slack 1h avant
- Status page : "Maintenance planifiée"
- Email aux stakeholders après succès
