# Incidents catalogue & playbooks

> Pour chaque incident probable : symptômes, diagnostic, résolution.

## ⚠ Audience preview > 5s timeout

**Symptômes** : Le panneau preview audience affiche "Calcul en cours..."
sans jamais revenir. Erreur côté serveur "preview-timeout" dans les logs.

**Diagnostic**
```bash
# Voir les queries qui timeout
sudo -u postgres psql femiglow -c "
SELECT query, mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%audience_preview%'
ORDER BY mean_exec_time DESC LIMIT 5;
"

# Voir si l'index est utilisé
sudo -u postgres psql femiglow -c "
EXPLAIN ANALYZE 
SELECT COUNT(*) FROM leads WHERE ... -- la query générée par compiler
"
```

**Résolutions possibles**
1. Index manquant sur orders(lead_id, created_at) → ajouter
2. Trop de critères → l'admin doit simplifier
3. Pas de cache Redis → vérifier `REDIS_URL` set

---

## ⚠ Snapshot bloqué en status='running' depuis > 1h

**Symptômes** : `email_audience_snapshot.status='running'` ancien.
La campagne associée est bloquée.

**Diagnostic**
```sql
SELECT id, audience_id, status, created_at FROM email_audience_snapshot
WHERE status = 'running' AND created_at < now() - interval '1 hour';
```

**Résolutions**
1. Si > 1h → marquer errored manuellement :
```sql
UPDATE email_audience_snapshot 
SET status='errored', errored_reason='manual_reset_stuck'
WHERE id = '...';
```
2. Re-trigger la snapshot via UI

---

## ⚠ Listmonk push échoue 100%

**Symptômes** : Toutes les campagnes finalize échouent avec
"listmonk upstream error".

**Diagnostic**
```bash
# Service running ?
systemctl status listmonk.service

# Loopback OK ?
curl -u admin:$LISTMONK_API_TOKEN http://127.0.0.1:9000/api/health

# Logs Listmonk
journalctl -u listmonk.service --since "1 hour ago"

# Env vars OK ?
grep ^LISTMONK_ /var/www/femiglow/apps/web/.env
```

**Résolutions**
1. Service down → `systemctl restart listmonk.service`
2. Auth fail (401) → vérifier API token dans .env
3. Postgres Listmonk plein → vérifier disk space

---

## ⚠ Automation runner ne tick plus

**Symptômes** : Runs restent en status='pending' avec next_action_at
dépassé.

**Diagnostic**
```bash
# Cron systemd en marche ?
systemctl status email-automation.timer  # ou via cron Vercel

# Endpoint répond ?
curl -X POST http://127.0.0.1:8011/api/cron/email-automation \
  -H "authorization: Bearer $CRON_SECRET"

# Quelle latency ?
sudo journalctl -u femiglow.service --since "10 min ago" | grep cron
```

**Résolutions**
1. Cron pas déclenché → vérifier scheduler (Vercel cron, systemd timer)
2. Cron timeout → augmenter timeout dans config
3. Runner bloque sur 1 run → cancel ce run manuellement

---

## ⚠ Cmd-K palette ne s'ouvre pas

**Symptômes** : ⌘K ne déclenche rien dans le navigateur.

**Diagnostic** (côté browser)
- Console errors ?
- L'event listener est-il monté ?
- Conflit avec un raccourci OS / navigateur ?

**Résolutions**
1. Bug JS → check Sentry
2. Composant pas monté → vérifier ErrorBoundary plus haut
3. Conflit raccourci → tester Ctrl+K aussi

---

## ⚠ Rate limit declenché pour /preview-size

**Symptômes** : 429 sur preview audience après quelques modifs rapides.

**Cause** : Le rate limit per-IP est trop strict (default 60/min).

**Résolution**
- Le debounce 800ms côté client doit limiter ; vérifier qu'il est bien
  en place
- Si pertinent, augmenter limit dans `lib/mail/rate-limit.ts` pour la
  scope `audiences-preview`

---

## ⚠ Email automation envoie pendant quiet hours

**Symptômes** : Email reçu à 23h alors que quiet_hours_end = 22h00.

**Diagnostic**
```sql
SELECT a.slug, a.quiet_hours_enabled, a.quiet_hours_tz, r.next_action_at
FROM email_automation a
JOIN email_automation_run r ON r.automation_id = a.id
WHERE r.id = '...';
```

**Résolutions**
1. Timezone mismatch → vérifier `quiet_hours_tz` matche prod
2. Flag pas respecté → bug runner ; check logic `applyQuietHours()`
3. Bypass intentionnel (mode test) → vérifier env

---

## ⚠ user_event explose en volume

**Symptômes** : Table > 50M rows, queries lentes.

**Diagnostic**
```sql
SELECT count(*), pg_size_pretty(pg_relation_size('user_event'))
FROM user_event;
```

**Résolutions**
1. Partitionner par mois (pg_partman ou natif PG13+)
2. Purge events > 90j si pas utilisés
3. Archive vers cold storage (S3 + suppression DB)

---

## ⚠ Audit log saturated

**Symptômes** : `admin_audit_log` grossit beaucoup, queries lentes.

**Résolution** : purge events > 1 an (sauf events legal/compliance).

---

## Escalation

Si un incident persiste > 30 min :
1. Activer feature flag pour désactiver la section concernée (V2)
2. Alerter via Slack #ops
3. Si critique (impact emails clients) : rollback la dernière phase
