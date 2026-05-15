# 5. Runbook opérationnel

## 5.1 Pré-requis avant déploiement

### Variables d'environnement (prod)

À configurer dans `/var/www/femiglow/apps/web/.env.production` (ou via systemd Environment) :

```bash
# Endpoint webhook outbound (Trello / CRM)
OUTBOUND_WEBHOOK_URL=https://crm.example.com/femiglow/hook
OUTBOUND_WEBHOOK_SECRET=<32+ caractères aléatoires>

# Secret pour /api/cron/* (anti-trigger non autorisé)
CRON_SECRET=<32+ caractères aléatoires>
```

### Backup DB obligatoire avant migration

```bash
pg_dump -Fc -h 127.0.0.1 -U femiglow femiglow \
  -f /var/backups/femiglow/pre-leads-webhook-$(date +%Y%m%dT%H%M%SZ).sql.gz
ls -lh /var/backups/femiglow/ | tail -3
```

## 5.2 Procédure de déploiement (ordonnée)

### Phase 1 — Migration DB (M1)

```bash
cd /var/www/femiglow/apps/web

# 1. Vérifier que la migration est présente
ls drizzle/migrations/ | grep lead_step1_abandon

# 2. Dry-run du schéma
pnpm db:check

# 3. Appliquer
pnpm db:migrate

# 4. Vérifier les colonnes ajoutées
psql -h 127.0.0.1 -U femiglow -d femiglow -c "\d chat_lead" | grep -E "step1_abandon|step2_webhook"

# 5. Vérifier les settings seedés
psql -h 127.0.0.1 -U femiglow -d femiglow -c \
  "SELECT key, value FROM tracking_settings WHERE key LIKE 'lead.%';"
```

**Critère de succès** : 2 nouvelles colonnes visibles, index `idx_chat_lead_step1_abandon_pending` créé, 2 lignes settings présentes.

### Phase 2 — Build app (M2 + M3 + M4)

```bash
cd /var/www/femiglow

# Run tests
pnpm vitest run src/lib/webhooks --reporter=basic
pnpm vitest run src/lib/tracking/settings --reporter=basic
pnpm vitest run src/app/api/checkout/lead --reporter=basic
pnpm vitest run src/app/api/cron/lead-step1-abandon --reporter=basic

# Si tests OK → build
pnpm build

# Restart prod
systemctl restart femiglow.service
sleep 3
systemctl is-active femiglow.service
curl -sI https://femiglow-maroc.com/ | head -1
```

### Phase 3 — Smoke test post-deploy

```bash
# 1. Vérifier que l'app charge
curl -sf https://femiglow-maroc.com/ > /dev/null && echo "✓ app OK"

# 2. Vérifier que la route cron répond (avec secret)
curl -X POST -H "X-Cron-Secret: $CRON_SECRET" \
  https://femiglow-maroc.com/api/cron/lead-step1-abandon \
  -w "\n%{http_code}\n"
# Attendu: HTTP 200, body { scanned: N, dispatched: 0, failed: 0 } (pas de leads à traiter au début)

# 3. Vérifier la page admin settings
curl -sf https://femiglow-maroc.com/admin/tracking/settings \
  -H "Cookie: <admin-session>" > /dev/null && echo "✓ admin settings OK"
```

### Phase 4 — Activer le cron périodique

Ajouter dans crontab (`crontab -e` ou via systemd timer) :

```cron
# Scanner leads step1 abandonnés — toutes les 2 minutes
*/2 * * * * curl -sS -X POST -H "X-Cron-Secret: $CRON_SECRET" https://femiglow-maroc.com/api/cron/lead-step1-abandon > /dev/null
```

**Pourquoi 2 minutes** : le timeout setting est de 5min par défaut. Avec un poll 2min, on a un lag maximal de ~2min après l'expiration du timeout. C'est acceptable. Si on veut < 1min de latence, passer à `*/1 * * * *`.

Alternative recommandée — systemd timer (plus robuste, log natif) :

```ini
# /etc/systemd/system/femiglow-lead-abandon-scanner.service
[Unit]
Description=FemiGlow lead step1 abandon scanner
After=network.target

[Service]
Type=oneshot
EnvironmentFile=/var/www/femiglow/apps/web/.env.production
ExecStart=/usr/bin/curl -sS -X POST -H "X-Cron-Secret: ${CRON_SECRET}" https://femiglow-maroc.com/api/cron/lead-step1-abandon
```

```ini
# /etc/systemd/system/femiglow-lead-abandon-scanner.timer
[Unit]
Description=Scan abandoned leads every 2 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Unit=femiglow-lead-abandon-scanner.service

[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload
systemctl enable --now femiglow-lead-abandon-scanner.timer
systemctl list-timers | grep femiglow
```

## 5.3 Validation production end-to-end

À faire en navigation privée sur prod :

### Test 1 — Flow nominal A

1. Ouvrir `https://femiglow-maroc.com/commander`
2. Step 1 — Saisir : nom "Test1", phone "0661234567", cocher consent. Submit.
3. Step 2 — Saisir : city "Marrakech", address "12 Rue Test". Submit.
4. Vérifier en DB :
   ```sql
   SELECT id, last_touched_step, lead_captured_at, address_completed_at, step2_webhook_at
   FROM chat_lead WHERE first_name = 'Test1' ORDER BY created_at DESC LIMIT 1;
   ```
   Attendu : `last_touched_step='address'`, `step2_webhook_at IS NOT NULL`.
5. Vérifier le log webhook :
   ```sql
   SELECT event_name, status, attempt_count, response_status, latency_ms
   FROM outbound_webhook_log
   WHERE source = 'lead-step2' AND created_at > now() - INTERVAL '5 min'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Attendu : `status='sent'`, `attempt_count=1`, `response_status=200`.
6. Vérifier dans Trello que la carte est créée.
7. Continuer le checkout : step 3, payer (mode COD). Vérifier création order + webhook `order.completed`.

### Test 2 — Flow B abandon

1. Saisir step 1 avec phone "0612345678" (Test2). Ne PAS faire step 2. Fermer l'onglet.
2. Attendre 5min (ou trigger manuellement `curl -X POST -H "X-Cron-Secret:…" /api/cron/lead-step1-abandon`).
3. Vérifier :
   ```sql
   SELECT step1_abandon_webhook_at FROM chat_lead WHERE first_name = 'Test2';
   ```
   Attendu : timestamp non null.
4. Vérifier log :
   ```sql
   SELECT * FROM outbound_webhook_log
   WHERE event_name = 'lead.step1_abandoned' AND created_at > now() - INTERVAL '10 min';
   ```
   Attendu : `status='sent'`.
5. Vérifier dans Trello que la carte est créée avec seulement nom + phone (pas d'address).

### Test 3 — Flow C chat lead

1. Ouvrir page d'accueil, ouvrir le chat widget.
2. Envoyer "Salam, je veux commander une montre".
3. Quand le formulaire lead s'affiche : nom "Test3", phone "0691111111". Submit.
4. Vérifier en DB :
   ```sql
   SELECT id, trigger_reason, jsonb_array_length(snapshot_messages) AS msg_count, webhook_status
   FROM chat_lead WHERE first_name = 'Test3';
   ```
   Attendu : `trigger_reason='purchase-intent'` (ou similaire), `msg_count >= 2`, `webhook_status='sent'`.
5. Vérifier le payload envoyé :
   ```sql
   SELECT payload->'conversation' AS conv
   FROM outbound_webhook_log
   WHERE source = 'chat-lead' AND event_name = 'chat_lead.created'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Attendu : `conv` est un array JSON non-vide, avec `role`, `name`, `text`, `ts`.

## 5.4 Monitoring & alerting

### Dashboard à créer (Grafana ou admin)

Queries Postgres pour observabilité (à ajouter dans `/admin/tracking/health` ou Grafana) :

```sql
-- Success rate par event sur 24h
SELECT event_name,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 1) AS success_pct
FROM outbound_webhook_log
WHERE created_at > now() - INTERVAL '24 hour'
GROUP BY event_name;

-- Latence p95 par event
SELECT event_name,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_ms
FROM outbound_webhook_log
WHERE status = 'sent' AND created_at > now() - INTERVAL '24 hour'
GROUP BY event_name;

-- Leads abandonnés step 1 cette semaine
SELECT date_trunc('day', step1_abandon_webhook_at) AS day,
  COUNT(*) AS abandonments
FROM chat_lead
WHERE step1_abandon_webhook_at > now() - INTERVAL '7 day'
GROUP BY 1 ORDER BY 1;

-- Ratio step1 → step2 (taux de complétion)
SELECT
  COUNT(*) FILTER (WHERE lead_captured_at > now() - INTERVAL '7 day') AS step1,
  COUNT(*) FILTER (WHERE address_completed_at > now() - INTERVAL '7 day') AS step2,
  COUNT(*) FILTER (WHERE purchased_at > now() - INTERVAL '7 day') AS purchased
FROM chat_lead;

-- Failed webhooks à investiguer
SELECT id, source, event_name, attempt_count, last_error, created_at
FROM outbound_webhook_log
WHERE status = 'failed' AND created_at > now() - INTERVAL '24 hour'
ORDER BY created_at DESC;
```

### Alertes Slack (à câbler quand stable)

| Trigger | Condition | Severity |
|---|---|---|
| Success rate < 90% | `success_pct < 90` sur 1h glissante | warning |
| Success rate < 50% | `success_pct < 50` sur 15min | critical |
| Latence p95 > 3000ms | sur 1h glissante | warning |
| Cron scanner échoue | systemd unit failed | critical |
| Endpoint webhook DOWN | 5 failed consécutifs | critical |

## 5.5 Procédure de rollback

Si la nouvelle logique cause un incident en prod :

### Rollback complet (revert code + migration DOWN)

```bash
cd /var/www/femiglow

# 1. Désactiver le cron
systemctl stop femiglow-lead-abandon-scanner.timer

# 2. Désactiver le webhook step2 sans déployer
psql -h 127.0.0.1 -U femiglow -d femiglow -c \
  "UPDATE tracking_settings SET value = 'false'::jsonb WHERE key = 'lead.step2_webhook_enabled';"

# 3. Si encore un souci, revert le commit
git log --oneline -10
git revert <commit-hash>  # ne pas --hard !

# 4. Rebuild + restart
pnpm build && systemctl restart femiglow.service

# 5. (optionnel) DOWN migration — généralement INUTILE car nouvelles colonnes nullable
psql -h 127.0.0.1 -U femiglow -d femiglow <<SQL
DROP INDEX IF EXISTS idx_chat_lead_step1_abandon_pending;
ALTER TABLE chat_lead DROP COLUMN IF EXISTS step1_abandon_webhook_at;
ALTER TABLE chat_lead DROP COLUMN IF EXISTS step2_webhook_at;
DELETE FROM tracking_settings WHERE key LIKE 'lead.%';
SQL
```

### Rollback partiel (feature-flag)

Plus propre que revert complet : utiliser les settings `lead.step2_webhook_enabled` (déjà câblé) pour couper le step2 sans déployer. Pour le step1_abandon, ajouter un setting similaire `lead.step1_abandon_enabled` (à prévoir en M3).

```sql
-- Couper step2 webhook
UPDATE tracking_settings SET value = 'false'::jsonb WHERE key = 'lead.step2_webhook_enabled';

-- Pour le scanner cron : stop le timer
systemctl stop femiglow-lead-abandon-scanner.timer
```

## 5.6 Procédure de retry manuel

Si un webhook a échoué (visible dans `outbound_webhook_log WHERE status='failed'`), pour rejouer manuellement :

### Option A — Réutiliser le payload existant (post-flight)

```sql
-- Repérer le log
SELECT id, idempotency_key, payload FROM outbound_webhook_log
WHERE status = 'failed' AND id = '<log-id>';

-- Le re-dispatch nécessite un endpoint admin (à créer en M3.6 bonus)
-- ou : update le status à 'pending' + relancer le cron retry (à créer)
```

### Option B — Via une nouvelle clé d'idempotency

Si le receveur Trello a "perdu" un message, il faut envoyer avec une nouvelle clé d'idempotency (sinon court-circuité). Endpoint admin à créer :

```ts
POST /admin/api/webhooks/replay
Body: { logId: '<id>' }
→ relance dispatchOutbound avec idempotencyKey: `${original}:retry-${Date.now()}`
```

## 5.7 Sécurité — checklist

- [ ] `OUTBOUND_WEBHOOK_SECRET` ≥ 32 caractères aléatoires, jamais commité
- [ ] `CRON_SECRET` ≥ 32 caractères aléatoires, jamais commité
- [ ] HTTPS uniquement sur l'endpoint receveur (TLS 1.2+)
- [ ] Vérification signature HMAC côté receveur (Trello custom Power-Up ou middleware Zapier)
- [ ] Pas de PII dans les logs serveur (logger filtre phone/email avant `console.error`)
- [ ] Rate limit IP/session sur les routes lead (déjà en place)
- [ ] Consent capture (champ `consent_version` rempli au step 1, sinon webhook skip)

## 5.8 Maintenance long-terme

- **Tous les 6 mois** : auditer les `outbound_webhook_log` retention (PURGE > 90 jours pour la légèreté DB)
- **Tous les 3 mois** : revoir le setting timeout (5min est conservateur, peut être passé à 10 si trop d'abandons-faux-positifs)
- **Au moindre changement de payload** : bumper le `event_name` (ex. `chat_lead.created` → `chat_lead.created.v2`) pour permettre au receveur Trello d'adapter le parsing sans casser la rétrocompat.

## 5.9 Contacts & escalade

| Souci | Premier point de contact | Escalade |
|---|---|---|
| Webhook 5xx récurrent | Vérifier l'endpoint Trello (URL morte ?) | Désactiver via setting + ticket support Trello |
| Cron scanner ne fire pas | `systemctl status femiglow-lead-abandon-scanner.timer` | Bascule sur crontab classique |
| Migration DB échoue | Backup pré-migration → restore | Ne PAS forcer, debug schema |
| Cards Trello dupliquées | Check `outbound_webhook_log.idempotency_key` (UNIQUE en théorie) | Bug app : faire un dédoublonnage côté Trello via Power-Up |
