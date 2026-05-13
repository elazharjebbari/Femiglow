# 80.3 — Smoke tests post-deploy

## Script bash

```bash
#!/bin/bash
# scripts/smoke-event-mappings.sh
set -e
BASE_URL=${1:-http://127.0.0.1:8011}
COOKIE_JAR=${COOKIE_JAR:-/tmp/admin-cookie.jar}

echo "=== Smoke event-mappings on $BASE_URL ==="

# 1. Page admin protégée
echo "--- Page admin ---"
curl -sS -b "$COOKIE_JAR" -o /dev/null -w '/admin/tracking/events/mappings: HTTP %{http_code}\n' \
  "$BASE_URL/admin/tracking/events/mappings"

# 2. Liste
echo "--- API list ---"
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/admin/tracking/events/mappings" -o /tmp/list.json -w 'HTTP %{http_code}\n'
echo "activeId: $(jq -r '.activeId' /tmp/list.json)"
echo "defaultId: $(jq -r '.defaultId' /tmp/list.json)"
echo "versions count: $(jq '.versions | length' /tmp/list.json)"

# 3. Default version
echo "--- API get __default__ ---"
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/admin/tracking/events/mappings/__default__" -o /tmp/default.json -w 'HTTP %{http_code}\n'
echo "Events count: $(jq '.mappings | keys | length' /tmp/default.json)"
echo "purchase Meta mappedName: $(jq -r '.mappings.purchase.meta.mappedName' /tmp/default.json)"

# 4. Test dispatch
echo "--- API test dispatch purchase ---"
ACTIVE_ID=$(jq -r '.activeId' /tmp/list.json)
curl -sS -b "$COOKIE_JAR" -X POST "$BASE_URL/api/admin/tracking/events/mappings/$ACTIVE_ID/test" \
  -H 'Content-Type: application/json' \
  -d '{"eventName":"purchase"}' \
  -o /tmp/test.json -w 'HTTP %{http_code}\n'
echo "Meta would dispatch: $(jq -r '.results.meta.wouldDispatch' /tmp/test.json)"
echo "Meta mappedName: $(jq -r '.results.meta.mappedName' /tmp/test.json)"

# 5. Export GTM
echo "--- API export GTM ---"
curl -sS -b "$COOKIE_JAR" -X POST "$BASE_URL/api/admin/tracking/events/mappings/$ACTIVE_ID/export-gtm" \
  -H 'Content-Type: application/json' \
  -d '{"env":"production"}' \
  -o /tmp/export.json -w 'HTTP %{http_code}\n'
echo "Export sha256: $(jq -r '.meta.sha256' /tmp/export.json)"
echo "Tags count: $(jq -r '.meta.tagsCount' /tmp/export.json)"
echo "containerJson.exportFormatVersion: $(jq -r '.containerJson.exportFormatVersion' /tmp/export.json)"

# 6. DB integrity
echo "--- DB integrity ---"
DATABASE_URL=$(grep ^DATABASE_URL apps/web/.env | tail -1 | cut -d= -f2-)
psql "$DATABASE_URL" -c "
  SELECT 'versions_total', count(*) FROM event_mapping_versions
  UNION ALL SELECT 'versions_active', count(*) FROM event_mapping_versions WHERE is_active = true
  UNION ALL SELECT 'versions_default', count(*) FROM event_mapping_versions WHERE is_default = true
  UNION ALL SELECT 'audit_24h', count(*) FROM event_mapping_audit WHERE created_at >= now() - interval '24 hours'
"

rm -f /tmp/list.json /tmp/default.json /tmp/test.json /tmp/export.json
echo "=== Done ==="
```

## Checklist manuelle

### Page admin
- [ ] `/admin/tracking/events/mappings` charge sans erreur
- [ ] `__default__` visible avec badge DEFAULT
- [ ] Toolbar avec "Créer version", "Importer JSON", "Reset au default" présents
- [ ] Filtres status fonctionnent

### Création d'une version
- [ ] Click "Créer version" → wizard ouvre
- [ ] Step 1 : 3 options visibles
- [ ] Step 2 : input nom + textarea notes
- [ ] Step 3 : récap correct + submit
- [ ] Redirect vers `/[newId]/edit`

### Édition
- [ ] Matrice rendue avec ~30 events × 6 providers
- [ ] Click cellule → popover ouvre
- [ ] Validation Zod live fonctionne
- [ ] Apply → dirty counter +1
- [ ] Save → modal confirm → nouvelle version créée

### Test mapping
- [ ] Modal test charge
- [ ] Choisir purchase → résultats 6 providers affichés

### Export GTM
- [ ] Modal export ouvre
- [ ] Sélection env production OK
- [ ] Download du fichier .json fonctionne
- [ ] Fichier contient `exportFormatVersion: 2` + tags + variables + triggers

### Reset default
- [ ] Bouton visible si active ≠ default
- [ ] Modal récap des changements
- [ ] Confirm → __default__ devient active

### Activation
- [ ] Click activate sur une autre version
- [ ] Confirm modale
- [ ] Badge active change

### Suppression
- [ ] Soft-delete sur archived OK
- [ ] Tentative delete sur active → modal "Suppression impossible"

## Stop conditions

Annuler le deploy et rollback si :
- HTTP 500 sur `/admin/tracking/events/mappings`
- API list retourne `{ versions: [], activeId: null }` (default pas chargé)
- API test retourne `{ results: {} }` vide
- Test dispatcher : `tracking_events_log.providers_results.meta.mappedName` est null
