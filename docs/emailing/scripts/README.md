# Scripts emailing — installation & opérations

Tous les scripts sont **idempotents** (re-runnables sans casser) et supportent `DRY_RUN=1` pour un preview sans effet.

## Installation from scratch (un serveur vierge, ou après reset DB)

Un **seul script** orchestre tout :

```bash
# Dry-run d'abord (recommandé)
sudo DRY_RUN=1 bash /var/www/femiglow-emailing/docs/emailing/scripts/install-from-scratch.sh

# Si OK, applique
sudo bash /var/www/femiglow-emailing/docs/emailing/scripts/install-from-scratch.sh
```

Il enchaîne ce qui suit :

| # | Étape | Script appelé |
|---|---|---|
| 0 | Vérification prerequisites | inline |
| 1 | `pnpm install` (worktree + prod) | inline |
| 2 | `pnpm db:migrate` + backup DB | inline |
| 3 | Fix crons systemd (3 scripts) | `M0-fix-crons.sh`, `M0-fix-residuals.sh`, `M0-fix-cron-final.sh` |
| 4 | Bootstrap (secrets, noreply@, .env, webhook, timer) | `M0-bootstrap-infra.sh` |
| 5 | Health check final | inline |

## Prerequisites server-side

- Ubuntu 22.04+ (testé) ; root accessible.
- **Stalwart Mail Server** déjà installé et atteignable sur `http://127.0.0.1:8080` avec :
  - un compte admin (`admin@lumiereacademy.com`) dont les creds sont stockés dans `${WORKTREE}/.emailing-secrets.local`
  - le domaine `femiglow-maroc.com` déclaré dans Stalwart (id `c` par défaut — voir `STALWART_DOMAIN_ID` env si autre)
- **Postgres** atteignable via `DATABASE_URL` dans `${PROD}/apps/web/.env`
- **systemd** (Linux moderne)
- `pnpm` v11+ disponible dans `$PATH` pour root et pour `nodeapp`
- `curl`, `jq`, `psql`, `openssl` installés
- (optionnel mais recommandé) `swaks` pour le smoke test SMTP

## Fichiers attendus dans le worktree

```
WORKTREE = /var/www/femiglow-emailing
PROD     = /var/www/femiglow

WORKTREE/
├── .emailing-secrets.local          ← gitignored, chmod 600, contient les creds Stalwart admin
├── apps/web/
│   ├── package.json                 ← inclut nodemailer + @react-email/* + html-to-text
│   ├── pnpm-lock.yaml
│   ├── drizzle.config.ts            ← schema-emails.ts dans le glob
│   ├── drizzle/migrations/
│   │   ├── 0028_emailing.sql        ← 10 tables + enums + indexes + FK (idempotent)
│   │   ├── 0029_emailing_seed.sql   ← seed email_template_meta + email_settings
│   │   └── meta/_journal.json       ← entries jusqu'à idx=30
│   └── src/
│       ├── lib/db/schema-emails.ts  ← schéma Drizzle
│       ├── lib/mail/...             ← module mailer complet
│       └── app/api/
│           ├── mail/webhook/stalwart/route.ts
│           ├── mail/unsubscribe/route.ts
│           └── cron/email-outbox/route.ts
└── docs/emailing/scripts/
    ├── install-from-scratch.sh      ← ce script
    ├── M0-fix-crons.sh
    ├── M0-fix-residuals.sh
    ├── M0-fix-cron-final.sh
    └── M0-bootstrap-infra.sh
```

## Scripts détaillés (utilisables individuellement)

| Script | But | Sécurité |
|---|---|---|
| `M0-fix-crons.sh` | Ajoute `-X POST` aux 18 unit files `femiglow-cron-*.service` (curl GET → POST). Backup avant modif. | idempotent, DRY_RUN |
| `M0-fix-residuals.sh` | Fix URL `chat` + log non-HttpError dans `lib/errors/http-error.ts` + chown `.next` + rebuild + restart | idempotent, DRY_RUN, backup |
| `M0-fix-cron-final.sh` | Fix `chat` method (POST→GET) + copy 2 patches Drizzle (media-jobs + tracking-purge) + rebuild + verify | idempotent, DRY_RUN, backup |
| `M0-bootstrap-infra.sh` | Génère secrets + crée `noreply@` Stalwart + update `.env` prod + restart service + smoke test SMTP + create webhook + install email-outbox timer | idempotent, DRY_RUN, backup |
| `install-from-scratch.sh` | **Master** : orchestre tout dans l'ordre, avec checks. | idempotent, DRY_RUN, backup |

## Variables d'environnement injectées dans `apps/web/.env`

Le bootstrap ajoute (à la fin du fichier) :

```
# ─── Emailing (added by M0-bootstrap-infra.sh) ─
SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_USER=noreply@femiglow-maroc.com
SMTP_PASSWORD=<généré 24 chars base64>
MAIL_FROM='FemiGlow <noreply@femiglow-maroc.com>'
MAIL_REPLY_TO=info@femiglow-maroc.com
FEMIGLOW_STALWART_WEBHOOK_SECRET=<généré hex 32 bytes>
MAIL_UNSUB_TOKEN_SECRET=<généré hex 40 bytes>
```

Les valeurs des secrets générés sont **aussi stockées** dans `.emailing-secrets.local` pour récupération.

## Validation post-install

```bash
# 1. Tables présentes (10)
psql "$DATABASE_URL" -c "\dt email_*"

# 2. Templates seedés (2)
psql "$DATABASE_URL" -c "SELECT slug, version, active FROM email_template_meta;"

# 3. Settings singleton (1 ligne 'global')
psql "$DATABASE_URL" -c "SELECT key FROM email_settings;"

# 4. Compte Stalwart noreply@
stalwart-cli --user admin@lumiereacademy.com --password <…> \
  --url http://127.0.0.1:8080 query Account | grep noreply

# 5. Webhook Stalwart actif
stalwart-cli ... query WebHook

# 6. Timer email-outbox actif
systemctl is-active femiglow-cron-email-outbox.timer

# 7. Endpoint cron répond 200
curl -X POST -H "Authorization: Bearer $(grep '^CRON_SECRET=' /var/www/femiglow/apps/web/.env | cut -d= -f2)" \
  http://127.0.0.1:8011/api/cron/email-outbox

# 8. Tests Vitest passent
cd /var/www/femiglow-emailing/apps/web && pnpm test src/lib/mail
```

Si les 8 checks passent, l'installation est validée.

## Reset / désinstallation

Pour ré-installer from scratch :

```bash
# 1. Drop email_* tables (irréversible)
psql "$DATABASE_URL" <<SQL
BEGIN;
DROP TABLE IF EXISTS email_event, email_outbox, email_template_meta,
  email_audience_link, email_campaign_link, email_subscriber_link,
  email_suppression, email_automation, email_automation_run,
  email_settings CASCADE;
DROP TYPE IF EXISTS email_outbox_status, email_event_type, email_event_source,
  email_bounce_type, email_template_category, email_audience_type,
  email_audience_optin, email_campaign_status, email_subscriber_status,
  email_suppression_reason, email_suppression_source,
  email_automation_trigger_type, email_automation_run_status CASCADE;
DELETE FROM drizzle.__drizzle_migrations
  WHERE hash IN (SELECT hash FROM drizzle.__drizzle_migrations
                 WHERE created_at >= 1778693000000);
COMMIT;
SQL

# 2. Disable + remove email-outbox timer
sudo systemctl disable --now femiglow-cron-email-outbox.timer || true
sudo rm -f /etc/systemd/system/femiglow-cron-email-outbox.{service,timer}
sudo systemctl daemon-reload

# 3. Delete Stalwart noreply@ account
stalwart-cli ... delete Account <id-of-noreply>
stalwart-cli ... delete WebHook <id-of-webhook>

# 4. Remove emailing vars from .env
sed -i '/^# ─── Emailing/,$d' /var/www/femiglow/apps/web/.env

# 5. Re-install
sudo bash docs/emailing/scripts/install-from-scratch.sh
```

## Diagnostics & troubleshooting

Cf. `docs/emailing/10-observability-debugging.md` (logs, Sentry, recipes par symptôme).

## Évolution future

- Pour ajouter un template : créer `apps/web/src/lib/mail/templates/<slug>.tsx` + enregistrer dans `catalog.ts` + ajouter une migration `00NN_seed_<slug>.sql` (suivre pattern `0029_emailing_seed.sql`).
- Pour ajouter une dépendance npm : commit `package.json` + `pnpm-lock.yaml` ; `install-from-scratch.sh` les pickera.
- Pour changer le domaine d'envoi : éditer `DOMAIN_ID` dans `M0-bootstrap-infra.sh` (ou exporter `STALWART_DOMAIN_ID=<id>` avant le run).
