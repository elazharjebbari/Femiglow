# 10 — Observabilité & Debugging

> Logs, Sentry, dashboards, recettes de debug. À lire après la mise en prod et conserver près du runbook.

## §1 — Stratégie de logs

3 niveaux de granularité :

| Source | Volume | Outil | Rétention |
|---|---|---|---|
| Application FemiGlow (`logger.info/warn/error`) | élevé | stdout → journald → Sentry sur error | 7 j journald, 30 j Sentry |
| Listmonk | moyen | `/var/log/listmonk/*.log` | 7 j local |
| Stalwart | élevé | `/etc/stalwart-mail/logs/stalwart.YYYY-MM-DD` | 30 j local |

Tag commun pour traçabilité cross-system : **`X-FG-Trace`** ou **`X-FemiGlow-Trace`** (ulid). Propagé :
- côté client → Next.js (header injecté par middleware admin)
- côté Next.js → Listmonk (proxy injecte)
- côté Next.js → Stalwart (via headers `X-FG-Outbox-Id` qui inclut le trace si pertinent)

Permet de tracer un mail de la requête web jusqu'à la livraison SMTP.

## §2 — Logs FemiGlow

### 2.1 — Conventions

Utiliser `apps/web/src/lib/logging/logger.ts`. Format :

```ts
logger.info('mail.send.queued',     { outboxId, template, to, idempotencyKey, traceId });
logger.info('mail.send.attempted',  { outboxId, attempts });
logger.info('mail.send.delivered',  { outboxId, queueId, smtpMessageId });
logger.warn('mail.send.failed',     { outboxId, error, attempts });
logger.error('mail.send.crashed',   { outboxId, error, stack });
logger.info('mail.webhook.stalwart.received', { event, messageId, traceId });
logger.info('mail.webhook.listmonk.received', { event, campaignId, subscriberId });
logger.info('mail.suppression.added', { email, reason, source });
logger.info('mail.automation.run.started', { runId, automationSlug, recipient });
logger.warn('mail.automation.run.errored', { runId, step, error });
logger.info('mail.proxy.request', { method, path, user, traceId });
logger.warn('mail.proxy.upstream_error', { status, path });
```

### 2.2 — Niveaux

- `debug` : payload variables (jamais en prod, dev only)
- `info` : tous les events normaux (queued, delivered, suppressed, retry, …)
- `warn` : retries, soft bounces, listmonk timeout, fallback
- `error` : crash inattendu, schema mismatch, hard failure non-business

### 2.3 — Sentry

```ts
// Tag dédié pour filtrer dans Sentry
Sentry.setTag('subsystem', 'mailer');
Sentry.setTag('outbox_id', outboxId);
Sentry.captureException(err);
```

Dashboard Sentry → filtre `subsystem:mailer` pour vue dédiée.

## §3 — Logs Stalwart

Fichiers : `/etc/stalwart-mail/logs/stalwart.YYYY-MM-DD`.

Clés utiles pour debug :
- `smtp.connection-start` : connexion entrante.
- `smtp.message-received` : message accepté en entrée.
- `queue.message-queued` : message en queue sortante.
- `queue.message-delivered` : livré au MX destinataire.
- `queue.message-failed` : échec permanent.
- `queue.message-deferred` : en attente retry.
- `dkim.signature-added` : signature DKIM appliquée.
- `auth.success` / `auth.failure` : connexions submission 587/465.
- `tls.handshake-failed` : problème TLS.

Filtrage rapide :

```bash
# Tous les mails envoyés par noreply@femiglow-maroc.com aujourd'hui
grep "noreply@femiglow-maroc.com" /etc/stalwart-mail/logs/stalwart.$(date +%Y-%m-%d) | grep auth.success

# Bounces hard du jour
grep "queue.message-failed" /etc/stalwart-mail/logs/stalwart.$(date +%Y-%m-%d) | grep -oP 'errorCode = \d+' | sort | uniq -c

# Retrouver un mail par Message-ID
grep "<01HYW...@femiglow-maroc.com>" /etc/stalwart-mail/logs/stalwart.2026-05-13
```

## §4 — Logs Listmonk

Fichiers : `/var/log/listmonk/stdout.log`, `/var/log/listmonk/stderr.log`.

```bash
# Suivre en temps réel
sudo journalctl -u listmonk.service -f

# Erreurs SMTP côté Listmonk
sudo grep -i "smtp" /var/log/listmonk/stderr.log | tail -20

# Campaigns workflow
sudo grep -E "campaign|push" /var/log/listmonk/stdout.log | tail -30
```

## §5 — Dashboards

### 5.1 — Dashboard admin FemiGlow `/admin/emails`

Source de vérité utilisateur. KPI lus depuis `mv_email_kpi_daily` + `mv_email_template_perf`. Cf. `04-frontend-admin.md` §3.1.

### 5.2 — Health check programmatique

`GET /api/admin/emails/health` (protégé `requireAdmin`) :

```json
{
  "smtp": { "ok": true, "tested_at": "2026-05-13T16:00:00Z" },
  "listmonk": { "ok": true, "version": "4.1.0", "queue_size": 0 },
  "outbox": { "pending": 3, "failed": 0, "dlq": 0, "oldest_pending_age_s": 12 },
  "matview_lag_s": 42,
  "last_webhook_received_s_ago": 8
}
```

Utilisé par le composant `<EmailsHealthBadge>` et par un cron monitoring externe.

### 5.3 — Sentry alerts (Issues + Alerts)

Configurer dans Sentry :

| Alerte | Critère | Notification |
|---|---|---|
| Outbox DLQ growing | `> 10 dlq events / hour` | Slack `#femiglow-alerts` |
| SMTP auth failure | `> 5 errors / 10 min` | Slack |
| Listmonk down | `mail.listmonk.upstream_error > 0 for 5 min` | Slack + email admin |
| Stalwart Redis NOAUTH (regression) | `mail.stalwart.redis_noauth events any` | Email immédiat |
| High hard bounce rate | `> 5 % hard_bounce / 24 h` | Email immédiat |
| Spam complaints | `any complaint event` | Email immédiat |

## §6 — Métriques persistées

`mv_email_kpi_daily` (cf. `02-data-model.md` §5) contient sent/delivered/opened/clicked/bounced/suppressed/dlq par jour.

Ad-hoc :
```sql
-- Délai p50/p95 entre queued et delivered
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM delivered_at - created_at)) AS p50_s,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM delivered_at - created_at)) AS p95_s
FROM email_outbox
WHERE status = 'delivered'
  AND created_at >= now() - interval '24 hours';

-- Top raisons de hard bounce
SELECT bounce_reason, COUNT(*)
FROM email_outbox
WHERE status = 'bounced_permanent'
  AND created_at >= now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
```

## §7 — Debug recipes

### 7.1 — "Un utilisateur dit ne pas avoir reçu son mail"

```
1. Récupérer son email
2. /admin/emails/transactional?search=<email>
   → trouver la ligne. Statut ?
     - delivered  → OK côté serveur, problème côté boîte destinataire (spam, règle filtre, alias). Lui demander de vérifier "Spam".
     - sent       → en attente livraison. Voir Stalwart logs avec queueId.
     - bounced_hard → adresse invalide. Page suppression list.
     - bounced_soft → temp, retry en cours.
     - dlq        → expiré. Cliquer "Replay" après diag.
     - suppressed → adresse était dans suppression. Voir pourquoi.
3. Si delivered, vérifier en plus l'aperçu HTML (détail outbox > Voir HTML) pour confirmer rendu correct.
```

### 7.2 — "Le wizard ne sauve plus mon brouillon"

```
1. Console navigateur → onglet Network → filtrer POST /draft
2. Code retour 401/403 → session expirée → relogin
3. Code 500 → Sentry → identifier l'erreur
4. Network OK mais brouillon perdu au refresh → vérifier URL contient draftId
5. Si pas de draftId → bug : step 1 n'a pas créé le draft (vérifier logs server)
```

### 7.3 — "Listmonk iframe ne s'affiche pas"

```
1. F12 → console → iframe blocked ? CSP ? Voir Content-Security-Policy.
2. Network → /api/listmonk/* statut ?
   - 401 → session admin perdue
   - 502 → listmonk.service down → systemctl status listmonk
   - 504 → listmonk lent → check load + DB
3. Listmonk loopback OK ? curl -I http://127.0.0.1:9000 depuis VPS
4. Si Listmonk OK mais proxy KO → vérifier LISTMONK_API_USER/TOKEN dans .env
```

### 7.4 — "Webhook Stalwart ne met pas à jour le statut"

```
1. Tail logs FemiGlow : journalctl -u femiglow.service -f | grep mail.webhook
2. Si rien → Stalwart n'envoie pas. Vérifier config webhook Stalwart : stalwart-cli query webhook
3. Si Stalwart envoie mais 401 → mismatch FEMIGLOW_STALWART_WEBHOOK_SECRET
4. Si 400 → payload non conforme → mettre à jour Zod schema (parser.test.ts contract)
5. Si 200 mais pas d'update DB → SmtpMessageId pas matching. Vérifier que outbox.smtp_message_id est rempli après envoi.
```

### 7.5 — "Trop de bounces soudain"

```
1. /admin/emails/transactional?status=bounced_permanent → top reasons
2. Si "550 5.7.1 ... blocked" → reputation issue. Postmaster Tools Google + SNDS Microsoft
3. Si "550 5.4.1 ... recipient address rejected" → liste contient des adresses obsolètes. Lancer un nettoyage.
4. Si Listmonk : Settings → Bounces → vérifier seuils. Désactiver campagnes en cours si > 5% bounce rate.
5. Vérifier SPF/DMARC/DKIM : dig
```

### 7.6 — "Le test send marche mais pas le vrai envoi"

```
1. /admin/emails/transactional → trier par created_at desc
2. Le mail est-il bien dans outbox ?
   - Oui, status pending : cron pickup ne tourne pas → systemctl status femiglow-cron-email-outbox.timer
   - Oui, status failed : voir last_error
   - Non : sendTransactional n'a pas été appelé. Logs côté business logic (api/contact, api/newsletter, …)
3. Cron OK mais pas de pickup → vérifier que CRON_SECRET correspond
```

### 7.7 — "Listmonk envoie trop vite, Stalwart limite"

```
1. Logs Stalwart : grep "421 too many" /etc/stalwart-mail/logs/stalwart.*
2. Listmonk admin → Settings → Performance → Message rate → baisser (50/min en warmup)
3. Stalwart admin → Settings → SMTP → rate limit submission 587 → vérifier
4. Redis OK ? (cf. audit § 4) — l'absence de auth cassait les rate limits
```

## §8 — Outils & commandes utiles

```bash
# Lister la queue Stalwart
stalwart-cli query queue --limit 50

# Forcer un retry sur un message en queue Stalwart
stalwart-cli update queue --id <id> --action retry

# Voir un compte
stalwart-cli get principal --id 9

# Listmonk : forcer rebuild campaign metrics
curl -X POST -u "$LISTMONK_API_USER:$LISTMONK_API_TOKEN" \
  http://127.0.0.1:9000/api/maintenance/refresh-counts

# DB FemiGlow : refresh matview à la main
pnpm db:studio   # ou psql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_email_kpi_daily;

# DB Listmonk : voir les bounces
sudo -u postgres psql -d listmonk -c "SELECT created_at, subscriber_email, type, source FROM bounces ORDER BY created_at DESC LIMIT 10;"

# Tester deliverability publique (sans envoyer)
swaks --to test-fhalrydl9@srv1.mail-tester.com --from noreply@femiglow-maroc.com \
  --server 127.0.0.1:587 --auth-user noreply@femiglow-maroc.com --auth-password "$SMTP_PASSWORD" \
  --tls --header "Subject: Test deliverability $(date)"
# → puis ouvrir https://www.mail-tester.com/test-fhalrydl9 pour le score
```

## §9 — Postmaster tools (réputation)

Inscrire le domaine **`femiglow-maroc.com`** dans :
- Google Postmaster Tools : https://postmaster.google.com (vérification DNS TXT)
- Microsoft SNDS : https://sendersupport.olc.protection.outlook.com/snds/
- Mail-tester.com (occasionnel : score 0-10)

Surveiller hebdomadairement le 1er mois après mise en prod, mensuel ensuite.

## §10 — Smarthost relay — plan B

Si la réputation IP s'effondre, configurer Stalwart pour relayer via un smarthost externe (SendGrid, Brevo, Amazon SES) :

```bash
# Stalwart admin → Settings → Outbound → Relay
# Host: smtp.sendgrid.net  Port: 587  Auth: <api-key>
# Routing: route outbound to relay (override MX lookup)
```

Avantage : zéro changement côté app FemiGlow (Stalwart reste le seul interlocuteur). Coût : SaaS récurrent. Bascule en < 10 min.

## §11 — Procédures d'incident

### P0 — Tous les envois échouent

```
1. /admin/emails → health badge rouge
2. Stalwart down ? systemctl status stalwart-mail.service
3. Stalwart OK mais auth.failure ? mot de passe noreply@ rotaté sans MAJ .env ?
4. Postgres FemiGlow indispo ? outbox INSERT failing
5. Si > 30 min : envoyer comm aux clients en attente via canal alternatif
```

### P1 — Listmonk indisponible

```
1. Transactional continue (passe direct via nodemailer, n'a pas besoin de Listmonk)
2. Broadcasts en pause (status='paused' implicite)
3. systemctl restart listmonk.service
4. Si reboot KO : check DB Listmonk Postgres, check disque, check RAM
```

### P2 — Bounces > 10 %

```
1. Pause campagnes en cours (Listmonk admin → Campaigns → pause)
2. Identifier top reasons
3. Nettoyer liste : retirer subscribers dont last_event_at > 6 mois
4. Re-send sur audience nettoyée
```

## §12 — Audit log

Chaque action admin "modifie l'envoi" est tracée via `lib/audit/log-event.ts` :

```
mail.outbox.manual_retry        outboxId, by_user
mail.campaign.create             campaignId, by_user
mail.campaign.schedule           campaignId, scheduledFor, by_user
mail.campaign.cancel             campaignId, by_user
mail.template.test_send          templateSlug, recipient, by_user
mail.suppression.add             email, reason, by_user
mail.suppression.remove          email, by_user
mail.settings.update             changedKeys[], by_user
```

Consultable dans `/admin/audit` (vue existante).

## §13 — Références

- Logger : `apps/web/src/lib/logging/logger.ts`
- Audit : `apps/web/src/lib/audit/log-event.ts`
- Sentry config : `apps/web/src/sentry.{client,server}.config.ts`
- Stalwart admin webmail : https://mail.femiglow-maroc.com/
- Logs Stalwart : `/etc/stalwart-mail/logs/`
- Logs Listmonk : `journalctl -u listmonk.service`
- Tests contract : `08-tests-strategy.md` §8
