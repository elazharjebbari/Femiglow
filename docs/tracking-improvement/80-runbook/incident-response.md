# 80.5 — Incident response

## Catégorisation des incidents

| Sévérité | Définition | Réponse |
|---|---|---|
| **P0 — Critical** | Production cassée, conversions perdues | Réponse immédiate, page on-call |
| **P1 — Major** | Feature dégradée, impact business modéré | Réponse < 1h |
| **P2 — Minor** | Bug non bloquant, workaround possible | Réponse < 24h |
| **P3 — Low** | Cosmétique, amélioration | Backlog |

## Playbooks par symptôme

### P0 — /kit retourne 500

1. Vérifier les logs : `journalctl -u femiglow.service -f`
2. Identifier l'erreur : DB ? Component ? Tracking ?
3. Si erreur tracking → désactiver google_ads provider (cf. rollback.md procédure C)
4. Si erreur DB → restore backup (cf. rollback.md procédure B)
5. Si erreur code → rollback code (cf. rollback.md procédure A)
6. Communiquer status

### P0 — Aucune conversion Google Ads reçue (>30min)

1. Vérifier `/admin/tracking/analytics/providers` → status google_ads
2. Si status='error' → cliquer sur le provider, voir last_error
3. Si OAuth expired → wizard onboarding pour rafraîchir
4. Si quota exceeded → vérifier Google Ads API quotas, attendre reset
5. Si autre → escalader engineering

### P1 — Provider Meta CAPI à 50% errors

1. Vérifier Meta Pixel ID dans `tracking_providers`
2. Vérifier `capi_token` chiffré et déchiffrable
3. Test event manuel via `/admin/tracking/test-event`
4. Si Token expired → admin doit re-générer dans Meta Business
5. Mettre à jour dans `tracking_providers.capi_token`

### P1 — Latence /api/track > 500ms p95

1. Vérifier DB load : `pg_stat_activity`
2. Vérifier slow queries : `pg_stat_statements`
3. Vérifier `tracking_events_log` taille (peut nécessiter vacuum/cleanup)
4. Vérifier providers : si un provider externe est lent, il bloque le batch
5. Mitigation : timeout réduit + désactiver provider lent temporairement

### P2 — Dashboards `/admin/tracking/analytics/providers` ne se charge pas

1. Vérifier SQL aggregation (postgresql logs)
2. Vérifier que `tracking_events_log` n'est pas vide
3. Forcer refresh : `Ctrl+Shift+R`
4. Si problème persiste : index sur tracking_events_log peut être obsolète :
   ```sql
   REINDEX TABLE tracking_events_log;
   VACUUM ANALYZE tracking_events_log;
   ```

### P2 — Override catégorisation ne persiste pas

1. Vérifier permissions DB (admin_users RBAC)
2. Vérifier que table `tracking_event_overrides` existe
3. Test direct SQL :
   ```sql
   INSERT INTO tracking_event_overrides (event_name, google_ads_category)
   VALUES ('test', 'lead') ON CONFLICT DO NOTHING;
   ```
4. Vérifier logs serveur lors du PUT

## Contacts en cas d'urgence

| Rôle | Personne | Contact |
|---|---|---|
| Tech Lead | (à attribuer) | email + tel |
| Dev Backend | (à attribuer) | email |
| Marketing (Google Ads) | Sara | email |
| Hosting / Infra | Hostinger support | ticket |

## Communication

### Status page

À mettre à jour dès qu'incident détecté :
- ⚠ Performance dégradée
- ❌ Service partiellement indisponible
- ❌ Service indisponible

### Slack #tracking-alerts

Message template :
```
🚨 [P0] Tracking provider down
Provider: google_ads
Symptôme: 100% errors depuis 12:00
Impact: conversions Google Ads non envoyées
ETA fix: 30min
Owner: @backend-dev
Thread → mises à jour
```

### Post-incident

J+1 : post-mortem dans `docs/incidents/<date>-<title>.md`
- Timeline
- Root cause
- What went well
- What didn't
- Action items

## Préparation

### Drills mensuels

1. Simuler une OAuth expiration Google Ads → tester procédure
2. Simuler un Meta CAPI 401 → tester procédure
3. Simuler /api/track 500 → tester rollback

### Backups regulars

- Daily DB backup auto (déjà fait par le reset feature)
- Weekly verification : `pnpm reset list-backups` puis valider sha256

### Documentation à jour

Ce dossier doit être :
- Versionné dans git
- Mis à jour à chaque incident (lessons learned)
- Connu de toute l'équipe
