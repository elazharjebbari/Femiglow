# 80.3 — Smoke tests post-deploy

> Liste de tests automatisables à exécuter immédiatement après déploiement
> pour valider que la pipeline fonctionne.

## Script bash unique

```bash
#!/bin/bash
# scripts/smoke-tracking.sh
# Usage: ./smoke-tracking.sh [base_url]
set -e

BASE_URL=${1:-http://127.0.0.1:8011}
echo "=== Smoke tests on $BASE_URL ==="

# 1. Health checks
echo "--- Health ---"
curl -sS -o /dev/null -w '/api/health: HTTP %{http_code}\n' "$BASE_URL/api/health"
[ $? -eq 0 ] || exit 1

# 2. Public pages
echo "--- Public pages ---"
for path in / /kit /commander /contact /mentions-legales; do
  printf '%-20s ' "$path"
  curl -sS -o /dev/null -w 'HTTP %{http_code}\n' "$BASE_URL$path"
done

# 3. Tracking endpoints (no auth needed for /api/track/pixels)
echo "--- Tracking ---"
curl -sS "$BASE_URL/api/track/pixels" -o /tmp/pixels.json
echo "Pixels endpoint snippets: $(jq -r '.snippets | length' /tmp/pixels.json)"

# 4. Send test event to /api/track
echo "--- /api/track event ---"
EVENT_ID=$(uuidgen)
curl -sS -X POST "$BASE_URL/api/track" \
  -H 'Content-Type: application/json' \
  -d '{
    "events": [{
      "event_id": "'$EVENT_ID'",
      "name": "form_start",
      "received_at": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
      "params": { "form_id": "smoke_test", "first_field": "test" },
      "page": { "url": "'$BASE_URL'/", "path": "/", "title": "Test" },
      "user": { "anonymous_id": "smoke-test" },
      "consent": { "ad_storage": "granted", "analytics_storage": "granted",
                    "ad_user_data": "granted", "ad_personalization": "granted",
                    "functional_storage": "granted" }
    }]
  }' -o /tmp/track-res.json -w "HTTP %{http_code}\n"
cat /tmp/track-res.json | jq

# 5. Admin login (need ADMIN_BOOTSTRAP creds in env)
echo "--- Admin login ---"
JAR=$(mktemp)
EMAIL=$(grep ^ADMIN_BOOTSTRAP_EMAIL apps/web/.env | tail -1 | cut -d= -f2-)
PASS=$(grep ^ADMIN_BOOTSTRAP_PASSWORD apps/web/.env | tail -1 | cut -d= -f2-)
curl -sS -c "$JAR" -X POST "$BASE_URL/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  -o /dev/null -w 'login: HTTP %{http_code}\n'

# 6. Admin tracking endpoints
echo "--- Admin tracking ---"
for path in /api/admin/tracking/gtm /api/admin/tracking/providers/snapshot /api/admin/tracking/events/categorization /api/admin/tracking/analytics/providers; do
  printf '%-50s ' "$path"
  curl -sS -b "$JAR" -o /dev/null -w 'HTTP %{http_code}\n' "$BASE_URL$path"
done

# 7. Vérifier DB integrity
echo "--- DB integrity ---"
DATABASE_URL=$(grep ^DATABASE_URL apps/web/.env | tail -1 | cut -d= -f2-)
export DATABASE_URL
psql "$DATABASE_URL" -c "
  SELECT 'providers' as t, count(*) FROM tracking_providers WHERE status = 'enabled'
  UNION ALL SELECT 'event_definitions', count(*) FROM tracking_event_definitions
  UNION ALL SELECT 'event_overrides', count(*) FROM tracking_event_overrides
  UNION ALL SELECT 'events_log_24h', count(*) FROM tracking_events_log WHERE received_at >= now() - interval '24 hours'
"

# 8. Pixel content check (le snippet google_ads doit être dans la réponse)
echo "--- Pixel content (google_ads expected) ---"
jq -r '.snippets[] | .kind' /tmp/pixels.json | sort

rm -f "$JAR" /tmp/pixels.json /tmp/track-res.json
echo "=== Done ==="
```

## Checklist manuelle

### Public

- [ ] `/kit` charge sans erreurs console
- [ ] Onglet Network : `/api/track/pixels` HTTP 200
- [ ] Onglet Network : 3 `<script>` injectés (data-tracking-pixel=*)
- [ ] Focus sur premier champ wizard → `/api/track` POST avec event `form_start`
- [ ] Click bouton continue → events `lead_capture`, `begin_checkout` envoyés
- [ ] event_id présent dans tous les payloads

### Admin

- [ ] Login `/admin/login` → 200 + redirect /admin
- [ ] `/admin/tracking` affiche dashboard
- [ ] `/admin/tracking/gtm` affiche les versions, active marquée
- [ ] `/admin/tracking/events/categorization` charge le tableau
- [ ] `/admin/tracking/analytics/providers` affiche les KPIs
- [ ] Création d'une version GTM via wizard fonctionne (1 cycle complet)
- [ ] Modification d'une version existante fonctionne (clone + diff)
- [ ] Override d'une catégorie persiste après reload

### Google Ads spécifique

- [ ] `/admin/tracking/test-event` envoie une conversion test
- [ ] Réponse `{ status: "success" }`
- [ ] Conversion visible dans Google Ads UI (sous 1h)
- [ ] event_id présent dans la requête vers Google Ads (DevTools Network)
- [ ] Si conversion client + serveur : Google déduplique (1 seule comptée)

## Stop conditions

Annuler le déploiement et rollback si :
- HTTP 500 sur `/kit` ou `/`
- /api/track retourne > 10% d'erreurs
- Login admin cassé
- Aucun event reçu côté tracking_events_log après 5 min de trafic réel
- Provider google_ads à 100% errors

## Automatisation CI

```yaml
# .github/workflows/post-deploy-smoke.yml
- name: Smoke tests
  run: |
    bash scripts/smoke-tracking.sh "$DEPLOY_URL"
  env:
    DEPLOY_URL: ${{ secrets.PROD_URL }}
```
