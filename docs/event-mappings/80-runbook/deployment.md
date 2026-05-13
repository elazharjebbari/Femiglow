# 80.1 — Runbook de déploiement

## Pré-requis

- [ ] Tests Vitest verts (`pnpm test`)
- [ ] Tests Playwright verts (`pnpm test:e2e`)
- [ ] Test ULTIMATE round-trip GTM (T54) vert
- [ ] Test drift `check-default-mapping` vert
- [ ] Code review approuvée
- [ ] Migrations testées en staging
- [ ] Backup DB récent (< 24h)
- [ ] Branche `feat/event-mappings` mergée sur master

## Étapes

### 1. Préparation (J-1)

```bash
# Sur serveur prod
cd /var/www/femiglow
git fetch origin master
git log master..origin/master --oneline   # vérifier commits attendus

# Backup
pg_dump "$DATABASE_URL" -Fc -f /var/backups/femiglow/pre-event-mappings-$(date +%Y%m%d-%H%M%S).dump
```

### 2. Window de deploy

- Préféré : mardi-jeudi 02h-06h ou 10h-12h
- Comm marketing 24h avant (Sara — pas d'impact direct mais notification courtoisie)

### 3. Deploy

```bash
# Pull code
git pull --ff-only origin master

# Stop service
sudo systemctl stop femiglow.service

# Migrations (0032, 0033, 0034)
pnpm --filter @femiglow/web db:migrate 2>&1 | tee /var/log/femiglow-migrate-$(date +%F).log

# Vérifier migrations appliquées
psql "$DATABASE_URL" -c "SELECT tag FROM (
  SELECT split_part(hash, '_', 1) AS tag, created_at
  FROM drizzle.__drizzle_migrations
  ORDER BY created_at DESC LIMIT 5
) t"
# Doit inclure 0032, 0033, 0034

# Seed __default__ avec le fichier JSON
pnpm --filter @femiglow/web seed:event-mappings 2>&1 | tee /var/log/seed-event-mappings.log

# Vérifier seed
psql "$DATABASE_URL" -c "
  SELECT id, name, status, is_default, jsonb_object_keys(mappings) AS event
  FROM event_mapping_versions
  WHERE id = '__default__'
"
# Doit retourner ~30 lignes (1 par event)

# Activer __default__ si aucune version active (1re install)
psql "$DATABASE_URL" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM event_mapping_versions WHERE is_active = true) THEN
      UPDATE event_mapping_versions
      SET is_active = true, status = 'active', activated_at = now()
      WHERE id = '__default__';
    END IF;
  END
  \$\$;
"

# Build
rm -rf apps/web/.next
pnpm --filter @femiglow/web build 2>&1 | tee /var/log/femiglow-build.log

# Start
sudo systemctl start femiglow.service
until ss -tlnp | grep -q ':8011'; do sleep 2; done
```

### 4. Smoke tests

```bash
# Health
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8011/api/health

# Page admin (besoin auth — utiliser la session admin)
curl -sS -b "$ADMIN_COOKIE" -o /dev/null -w 'HTTP %{http_code}\n' \
  http://127.0.0.1:8011/admin/tracking/events/mappings

# API list
curl -sS -b "$ADMIN_COOKIE" -o /tmp/mappings.json -w 'HTTP %{http_code}\n' \
  http://127.0.0.1:8011/api/admin/tracking/events/mappings
jq '.activeId' /tmp/mappings.json   # doit retourner "__default__" (1re install)
```

### 5. Vérifications fonctionnelles

- [ ] Page `/admin/tracking/events/mappings` accessible (login admin OK)
- [ ] `__default__` visible avec badge "DEFAULT"
- [ ] Click "Voir" sur __default__ → matrice affichée (30 events × 6 providers)
- [ ] Tester un event (`purchase`) → résultats par provider corrects
- [ ] Pas d'erreur 500 dans `journalctl -u femiglow -n 100`

### 6. Vérification dispatcher utilise nouveau resolver

```bash
# Envoyer un event test via /api/track
EVENT_ID=$(uuidgen)
curl -sS -X POST http://127.0.0.1:8011/api/track \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"event":"purchase","event_id":"'$EVENT_ID'", ...}]}'

# Attendre 5s puis vérifier dispatch
psql "$DATABASE_URL" -c "
  SELECT event_name, providers_dispatched, providers_results->'meta'->>'mappedName' AS meta_name
  FROM tracking_events_log
  WHERE event_id = '$EVENT_ID'
"
# meta_name doit être 'Purchase' (résolu depuis event_mapping_versions, pas event-mapping.ts)
```

### 7. Monitor 24h

- Watch logs : `journalctl -u femiglow.service -f | grep event_mapping`
- Watch dashboard `/admin/tracking/analytics/providers` : success rate stable
- Aucune erreur Sentry/Datadog liée aux mappings

## Timing

| Étape | Durée estimée |
|---|---|
| Préparation | 5 min |
| Stop + migrate + seed | 3 min |
| Build | 3-5 min |
| Start + smoke | 2 min |
| Vérifs fonctionnelles | 10 min |
| Test dispatcher | 5 min |
| **Total** | **~25-30 min** |

## Critères Go/No-Go

Annuler le deploy si :
- ❌ Migrations échouent (idempotent → doit toujours passer ; sinon investiguer)
- ❌ Seed `__default__` produit 0 events (check default-mapping.json présent)
- ❌ /admin/tracking/events/mappings retourne 500
- ❌ `resolveEventMapping('purchase', 'meta')` retourne null (le default doit toujours résoudre purchase)

## Comm

- Pré : Slack `#ops` + status page maintenance
- Post : Slack `#marketing-tech` "Le module Mappings est en prod, doc : docs/event-mappings/"
- Sara : email perso avec lien wireframes + guide démarrage rapide
