# 09 — Infrastructure Setup

> Procédure pas-à-pas pour mettre en place l'infra côté VPS : Listmonk, Postgres, nginx reverse proxy, systemd, compte Stalwart, env vars, secrets. Reproductible idempotent.

## §1 — Pré-requis serveur

- VPS Hostinger `srv983171` (46.202.128.168)
- Ubuntu 22.04+, accès root
- Stalwart Mail Server v0.16+ installé et fonctionnel (`stalwart-mail.service` active)
- Postgres 14+ tournant (déjà utilisé par FemiGlow main DB)
- nginx ou autre reverse proxy déjà en place pour le HTTPS du domaine `admin.femiglow-maroc.com`
- UFW configuré (cf. audit § 2.1)
- Crons FemiGlow opérationnels — **bloquant** : tous les `femiglow-cron-*` actuellement en `failed`. Réparer avant ces étapes.

## §2 — Listmonk : installation

### 2.1 — Download binaire

```bash
# Choisir la dernière release stable
LISTMONK_VERSION=4.1.0
cd /tmp
wget https://github.com/knadh/listmonk/releases/download/v${LISTMONK_VERSION}/listmonk_${LISTMONK_VERSION}_linux_amd64.tar.gz
tar -xzf listmonk_${LISTMONK_VERSION}_linux_amd64.tar.gz
sudo install -o root -g root -m 0755 listmonk /usr/local/bin/listmonk
listmonk --version
```

### 2.2 — Utilisateur système

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin listmonk
sudo mkdir -p /etc/listmonk /var/lib/listmonk /var/log/listmonk
sudo chown -R listmonk:listmonk /etc/listmonk /var/lib/listmonk /var/log/listmonk
sudo chmod 750 /etc/listmonk /var/lib/listmonk
```

### 2.3 — Postgres : DB dédiée

```bash
sudo -u postgres psql <<EOF
CREATE ROLE listmonk WITH LOGIN PASSWORD '$(openssl rand -base64 32)';
CREATE DATABASE listmonk OWNER listmonk ENCODING 'UTF8' LC_COLLATE 'fr_FR.UTF-8' LC_CTYPE 'fr_FR.UTF-8' TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE listmonk TO listmonk;
EOF

# Sauvegarder le mot de passe dans /root/listmonk-credentials.txt (chmod 600)
```

### 2.4 — Config Listmonk

```bash
sudo cp /tmp/config.toml.sample /etc/listmonk/config.toml
sudo chown listmonk:listmonk /etc/listmonk/config.toml
sudo chmod 640 /etc/listmonk/config.toml
```

Éditer `/etc/listmonk/config.toml` :

```toml
[app]
address = "127.0.0.1:9000"
admin_username = "admin"
admin_password = "<générer 24 chars>"

[db]
host = "127.0.0.1"
port = 5432
user = "listmonk"
password = "<celui généré au 2.3>"
database = "listmonk"
ssl_mode = "disable"
max_open = 25
max_idle = 25
max_lifetime = "300s"
```

Important :
- **`address = "127.0.0.1:9000"`** → loopback uniquement, jamais exposé sur Internet.
- L'auth admin Listmonk ne sera jamais utilisée en pratique (proxy + SSO derrière), mais reste comme fallback.

### 2.5 — Init schéma

```bash
sudo -u listmonk listmonk --config /etc/listmonk/config.toml --install
# → migre, crée tables, demande confirmation
```

### 2.6 — systemd unit

`/etc/systemd/system/listmonk.service` :

```ini
[Unit]
Description=Listmonk newsletter manager
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=listmonk
Group=listmonk
WorkingDirectory=/var/lib/listmonk
ExecStart=/usr/local/bin/listmonk --config /etc/listmonk/config.toml
Restart=always
RestartSec=5
StandardOutput=append:/var/log/listmonk/stdout.log
StandardError=append:/var/log/listmonk/stderr.log

# Hardening
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/listmonk /var/log/listmonk
PrivateTmp=yes
NoNewPrivileges=yes
RestrictNamespaces=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now listmonk.service
sudo systemctl status listmonk.service
curl -I http://127.0.0.1:9000/  # → 200 OK
```

## §3 — Configurer Listmonk pour utiliser Stalwart

### 3.1 — Compte Stalwart `noreply@femiglow-maroc.com`

```bash
# Avec stalwart-cli (env vars STALWART_URL/USER/PASSWORD requis)
stalwart-cli create principal \
  --type User \
  --name "noreply@femiglow-maroc.com" \
  --description "App emailing — sender" \
  --password "$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)" \
  --quota 0

# Copier le mot de passe généré dans /root/stalwart-credentials.txt
```

### 3.2 — Configurer SMTP côté Listmonk

Login Listmonk admin (initialement http://127.0.0.1:9000 via SSH tunnel, plus tard via iframe FemiGlow) :
- Settings → SMTP → "+ Add SMTP server"
- Host : `127.0.0.1`
- Port : `587`
- Username : `noreply@femiglow-maroc.com`
- Password : `<celui généré au 3.1>`
- TLS type : `STARTTLS`
- Hello hostname : `mail.lumiereacademy.com`
- Max conns : `10`
- Max msg retries : `2`
- Idle timeout : `15s`
- Wait timeout : `5s`
- Send test → vérifier 250 OK dans logs Stalwart.

### 3.3 — Settings Listmonk généraux

- General → Site name : `FemiGlow Emails`
- General → Site URL : `https://admin.femiglow-maroc.com/admin/emails/listmonk` (utilisé dans les links absolus)
- General → Admin notification email : `admin@femiglow-maroc.com`
- Performance → Concurrency : `10` (limite Stalwart STARTTLS)
- Performance → Message rate : `100/min` (warmup, monter ensuite)
- Privacy → Track campaign views/clicks : `oui` (pixel + click rewrite)
- Privacy → List-Unsubscribe : `Activé (one-click RFC 8058)`
- Bounces → Enable bounces detection : `oui`
- Bounces → Bounce processing mode : `webhook` (Stalwart push directement)

## §4 — API user Listmonk pour FemiGlow

Listmonk admin → Users → "+ Add user" :
- Username : `femiglow-app`
- Email : `app@femiglow-maroc.com`
- Type : `API`
- Role : `Super Admin` (le proxy gère l'autorisation côté FemiGlow ; Listmonk ne fait pas de RBAC fin)
- Status : `enabled`
- Save → noter le **API token** affiché une seule fois.

Ajouter dans `/var/www/femiglow/apps/web/.env` :

```
LISTMONK_INTERNAL_URL=http://127.0.0.1:9000
LISTMONK_API_USER=femiglow-app
LISTMONK_API_TOKEN=<token reçu>
LISTMONK_ADMIN_BASE_URL=http://127.0.0.1:9000/admin
```

## §5 — Stalwart webhooks vers FemiGlow

### 5.1 — Générer secret

```bash
openssl rand -hex 32 > /root/.stalwart-fg-webhook-secret
chmod 600 /root/.stalwart-fg-webhook-secret
```

Mettre dans `/var/www/femiglow/apps/web/.env` :
```
FEMIGLOW_STALWART_WEBHOOK_SECRET=<contenu du fichier>
```

### 5.2 — Configurer webhook

```bash
SECRET=$(cat /root/.stalwart-fg-webhook-secret)
stalwart-cli create webhook \
  --url "https://admin.femiglow-maroc.com/api/mail/webhook/stalwart" \
  --events "message.queued,message.delivered,message.delivery-failed,message.delivery-deferred,auth.failure" \
  --headers "Authorization=Bearer ${SECRET}" \
  --retry-policy "max=3,backoff=exponential"
```

Vérifier dans Stalwart admin → Settings → System → Webhooks.

## §6 — Listmonk webhooks vers FemiGlow

Listmonk admin → Settings → Webhooks → Add :
- URL : `https://admin.femiglow-maroc.com/api/mail/webhook/listmonk`
- Events : `subscriber.created`, `subscriber.updated`, `subscriber.unsubscribed`, `campaign.started`, `campaign.completed`, `subscriber.bounced`, `subscriber.complained`
- Secret : `<générer 32 hex>` → ajouter dans `apps/web/.env` comme `LISTMONK_WEBHOOK_SECRET`

## §7 — Reverse proxy nginx

Le proxy `/api/listmonk/*` est géré **par Next.js** (cf. `03-backend-integration.md` §2.2). Nginx n'a **pas** besoin de proxier directement Listmonk.

Vérifier que le vhost FemiGlow expose seulement Next.js et que `127.0.0.1:9000` reste inaccessible publiquement :

```bash
# Test depuis l'extérieur (depuis ta machine, pas le VPS)
curl -I https://admin.femiglow-maroc.com:9000  # → connection refused expected
curl -I https://admin.femiglow-maroc.com/api/listmonk/api/lists  # → 401 (auth required, mais accessible)
```

UFW :
```bash
sudo ufw status verbose
# Doit montrer que 9000 n'est PAS dans les règles ALLOW.
# Si présent par erreur :
sudo ufw delete allow 9000
```

## §8 — Theming CSS léger côté Listmonk

Listmonk → Settings → Appearance → Custom CSS :

```css
/* Aligner sur la charte FemiGlow */
:root {
  --primary: #7C9A8A;        /* brand-sauge */
  --primary-light: #A4BAB0;
  --bg: #FAFAF9;             /* stone-50 */
  --text: #0F2F2A;           /* brand-encre */
}

.nav-bar { background: var(--text); }
.btn.is-primary { background: var(--primary); border-color: var(--primary); }
.brand-logo { display: none; }
.brand-name::before { content: 'FemiGlow Emails'; font-family: 'Cormorant Garamond', serif; }
.brand-name span { display: none; }
```

Custom HTML (header) :
```html
<script>
  // PostMessage navigation parent
  window.parent.postMessage(
    { type: 'listmonk:navigate', path: location.pathname },
    location.origin
  );
</script>
```

## §9 — Cron services FemiGlow ajoutés

`/etc/systemd/system/femiglow-cron-email-outbox.service` (timer + service comme les autres) :

```ini
# femiglow-cron-email-outbox.service
[Unit]
Description=FemiGlow cron: email outbox pickup
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/var/www/femiglow/apps/web
EnvironmentFile=/var/www/femiglow/apps/web/.env
ExecStart=/usr/bin/curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  http://127.0.0.1:3000/api/cron/email-outbox
StandardOutput=journal
StandardError=journal
```

```ini
# femiglow-cron-email-outbox.timer
[Unit]
Description=FemiGlow cron timer: email outbox pickup

[Timer]
OnBootSec=60
OnUnitActiveSec=60
AccuracySec=5

[Install]
WantedBy=timers.target
```

Idem pour :
- `femiglow-cron-email-suppression-sync` (5 min)
- `femiglow-cron-email-audience-sync` (5 min)
- `femiglow-cron-email-automation` (60 s)
- `femiglow-cron-email-mv-refresh` (5 min)
- `femiglow-cron-email-prune` (quotidien)

```bash
sudo systemctl daemon-reload
for u in email-outbox email-suppression-sync email-audience-sync email-automation email-mv-refresh email-prune; do
  sudo systemctl enable --now femiglow-cron-${u}.timer
done
sudo systemctl list-timers | grep femiglow
```

## §10 — Migrations Drizzle

```bash
cd /var/www/femiglow/apps/web
pnpm db:generate    # génère SQL depuis schema TypeScript
pnpm db:migrate     # applique
pnpm db:studio &    # vérification visuelle
```

Voir migrations attendues dans `02-data-model.md` §4.

## §11 — Variables d'environnement complètes

Ajouter à `apps/web/.env` (chmod 600) :

```bash
# ─── MAIL — SMTP via Stalwart ─────────────────────
SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_USER=noreply@femiglow-maroc.com
SMTP_PASSWORD=<celui généré §3.1>

MAIL_FROM=FemiGlow <noreply@femiglow-maroc.com>
MAIL_REPLY_TO=info@femiglow-maroc.com

# ─── LISTMONK ─────────────────────────────────────
LISTMONK_INTERNAL_URL=http://127.0.0.1:9000
LISTMONK_API_USER=femiglow-app
LISTMONK_API_TOKEN=<celui de §4>
LISTMONK_WEBHOOK_SECRET=<celui de §6>

# ─── WEBHOOKS ENTRANTS ────────────────────────────
FEMIGLOW_STALWART_WEBHOOK_SECRET=<celui de §5>

# ─── CRON ─────────────────────────────────────────
CRON_SECRET=<celui existant ou regen>
```

Étendre la validation Zod dans `apps/web/src/lib/env.ts` pour rendre ces variables `required` en prod et `optional` en dev.

## §12 — Test bout-en-bout post-install

```bash
# 1. Listmonk OK
curl -u "femiglow-app:${TOKEN}" http://127.0.0.1:9000/api/lists | jq

# 2. SMTP OK
echo "Test" | swaks --to me@example.com --from noreply@femiglow-maroc.com \
  --server 127.0.0.1:587 --auth-user noreply@femiglow-maroc.com --auth-password "${SMTP_PASSWORD}" \
  --tls

# 3. FemiGlow → Listmonk via proxy
curl -b "<session cookie admin>" https://admin.femiglow-maroc.com/api/listmonk/api/lists

# 4. Webhook Stalwart → FemiGlow
SECRET=$(cat /root/.stalwart-fg-webhook-secret)
curl -X POST https://admin.femiglow-maroc.com/api/mail/webhook/stalwart \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"event":"message.delivered","messageId":"<test@x>","queueId":"1","rcpt":"a@b.c","ts":"2026-05-13T12:00:00Z"}'
# → 202 (unknown messageId, expected) ou 200 si seeded

# 5. UI admin Emails
xdg-open https://admin.femiglow-maroc.com/admin/emails
```

## §13 — Backups

| Quoi | Quand | Où | Rétention |
|---|---|---|---|
| `pg_dump listmonk` | quotidien (cron) | `/var/backups/listmonk/listmonk-YYYYMMDD.sql.gz` | 30 j local, 90 j S3 |
| Stalwart RocksDB | déjà existant (backup-upgrade) | `/etc/stalwart-mail-backup-*/` | inchangé |
| DB FemiGlow (incluant `email_*`) | déjà existant | déjà existant | inchangé |
| `/etc/listmonk/config.toml` + `.env` | hebdomadaire | S3 chiffré | versionné Git séparé |

`/etc/cron.d/listmonk-backup` :

```cron
0 3 * * * postgres pg_dump --no-owner --no-privileges listmonk | gzip > /var/backups/listmonk/listmonk-$(date +\%Y\%m\%d).sql.gz
0 4 * * * root find /var/backups/listmonk -name "listmonk-*.sql.gz" -mtime +30 -delete
```

## §14 — Hardening sécurité

- **Listmonk admin password** : non utilisé, mais rotation annuelle.
- **API token Listmonk** : rotation tous les 6 mois (UI Listmonk → Users → regenerate).
- **SMTP password noreply@** : rotation annuelle ou si fuite suspectée.
- **Secrets `.env`** : permissions 600, owner `nodeapp:nodeapp`. Pas dans Git.
- **Logs** :
  - `/var/log/listmonk/` : rotation 7 jours via logrotate.
  - `/etc/stalwart-mail/logs/` : rotation native Stalwart.
- **UFW** : 9000 jamais ouvert publiquement.
- **Postgres** : Listmonk user `listmonk` n'a accès qu'à sa DB.
- **SELinux/AppArmor** : si actif, profile Listmonk dans `RestrictNamespaces`.

## §15 — Plan de rollback

Si Listmonk se révèle problématique en M3+ :
1. `systemctl stop listmonk.service` → l'UI iframe affiche un placeholder, le transactional continue via nodemailer direct.
2. Désactiver les webhooks Listmonk dans Listmonk admin (tant que le service est arrêté, aucun webhook entrant).
3. Toutes les campagnes en cours (status='sending') sont **idempotentes** : Listmonk reprend où il s'était arrêté au restart.
4. Pour rollback total : `pg_dump` final + `apt remove` + supprimer unit file.

## §16 — Checklist install

- [ ] Listmonk binaire installé `/usr/local/bin/listmonk`
- [ ] User `listmonk` créé
- [ ] DB Postgres `listmonk` créée avec password
- [ ] Config `/etc/listmonk/config.toml` correct (loopback only)
- [ ] Schema migré (`--install`)
- [ ] `listmonk.service` enable & active
- [ ] Compte Stalwart `noreply@femiglow-maroc.com` créé
- [ ] SMTP test Listmonk → 250 OK
- [ ] API user `femiglow-app` créé, token stocké
- [ ] Webhook Stalwart → FemiGlow configuré
- [ ] Webhooks Listmonk → FemiGlow configurés
- [ ] CSS theming + script postMessage ajoutés
- [ ] 6 crons FemiGlow emails enable & timer active
- [ ] Migrations Drizzle appliquées
- [ ] `.env` mis à jour (11 nouvelles vars)
- [ ] UFW vérifié (9000 closed)
- [ ] Backup cron actif
- [ ] Test bout-en-bout OK (§12)

## §17 — Références

- Listmonk docs install : https://listmonk.app/docs/installation/
- Stalwart CLI : `stalwart-cli --help`
- Pattern crons existants : `/etc/systemd/system/femiglow-cron-*`
- nginx vhost existant : à identifier (probablement `/etc/nginx/sites-enabled/femiglow`)
