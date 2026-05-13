# 80.2 — Runbook rollback

## Quand rollback ?

- ❌ /api/track p95 > 500ms ou 5xx > 5% (suspecter resolver lent ou broken)
- ❌ Conversions providers chute > 50% en 1h (mappings cassés → dispatcher skip tout)
- ❌ Page admin /mappings retourne 500 systématiquement
- ❌ Erreur 'cannot read property mappings of null' dans logs serveur

## Procédure A — Rollback code seul

```bash
cd /var/www/femiglow

# Identifier le commit pré-event-mappings
git log --oneline -10

# Reset hard
sudo systemctl stop femiglow.service
git reset --hard <commit-sha-pre-event-mappings>
rm -rf apps/web/.next
pnpm --filter @femiglow/web build
sudo systemctl start femiglow.service
until ss -tlnp | grep -q ':8011'; do sleep 2; done
```

Le code revient à `event-mapping.ts` hardcoded → dispatcher reprend son ancien comportement immédiatement. Les tables `event_mapping_versions` et `event_mapping_audit` restent en DB (additif) — pas de perte.

## Procédure B — Rollback DB

Si problème spécifique sur les tables :

```bash
sudo systemctl stop femiglow.service

psql "$DATABASE_URL" <<'SQL'
BEGIN;
DROP TABLE IF EXISTS event_mapping_audit;
DROP TABLE IF EXISTS event_mapping_versions;
DELETE FROM drizzle.__drizzle_migrations
  WHERE hash IN (
    -- 0032, 0033, 0034 hashes
  );
COMMIT;
SQL

sudo systemctl start femiglow.service
```

(Calcul hashes via `sha256sum apps/web/drizzle/migrations/0032_*.sql` etc.)

## Procédure C — Désactiver le resolver (feature flag)

Si on veut garder les tables mais désactiver le resolver et faire fallback au code immédiatement :

```typescript
// lib/tracking/server/dispatcher.ts (modif temporaire)
// const mapping = await resolveEventMapping(eventName, kind);
const mapping = { mappedName: mapEventName(eventName, kind), isCustom: false, isEnabled: true };
```

Plus rapide qu'un rollback complet, mais nécessite un build/restart.

Mieux : ajouter une env var `MAPPING_USE_DB=false` qui bascule resolver vers le fallback code-only.

## Vérifications post-rollback

- [ ] `/api/track` retourne 202 sur events test
- [ ] Login admin OK
- [ ] `/admin/tracking/events/mappings` retourne 404 (route supprimée par rollback) — ok
- [ ] Dispatcher utilise `event-mapping.ts` (vérifier 1 event via `tracking_events_log.providers_results.meta.mappedName`)
- [ ] Aucune erreur 500 dans logs serveur

## Post-mortem

J+1 : documenter dans `docs/incidents/<date>-event-mappings-rollback.md`
- Timeline
- Root cause
- Action items
