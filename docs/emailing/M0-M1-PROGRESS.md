# M0 / M1 — Avancement (worktree `emailing-system`)

> **Lieu** : `/var/www/femiglow-emailing` (worktree git, branche `emailing-system`).
> **Date** : 2026-05-13. **État** : code scaffolding M0+M1 livré, infra à exécuter par toi.

## ✓ Livré dans cette session

### M0 — Préparation

| ID | Item | Statut | Fichier |
|---|---|---|---|
| 0.1 | Diagnostic crons FemiGlow failed | ✅ root cause identifié | `docs/emailing/scripts/M0-fix-crons.sh` |
| 0.3 | Drizzle schema email_* (10 tables + enums) | ✅ | `apps/web/src/lib/db/schema-emails.ts` |
| 0.3b | drizzle.config.ts mis à jour | ✅ | `apps/web/drizzle.config.ts` |
| 0.4 | Env vars (13 nouvelles, optional défaut) | ✅ | `apps/web/src/lib/env.ts` |

### M1 — Transactional core

| ID | Item | Statut | Fichier |
|---|---|---|---|
| 1.1 | nodemailer client singleton | ✅ | `apps/web/src/lib/mail/client.ts` |
| 1.2 | catalog typé + 2 templates (sur 5 initiaux) | ✅ partiel | `apps/web/src/lib/mail/catalog.ts` |
| 1.2 | BaseLayout + Header + Footer | ✅ | `apps/web/src/lib/mail/templates/_shared/` |
| 1.2 | contact-acknowledgement template | ✅ | `apps/web/src/lib/mail/templates/contact-acknowledgement.tsx` |
| 1.2 | order-confirmation template | ✅ | `apps/web/src/lib/mail/templates/order-confirmation.tsx` |
| 1.3 | render pipeline (react-email + html-to-text) | ✅ | `apps/web/src/lib/mail/render.ts` |
| 1.4 | sendTransactional + outbox + backoff + retry | ✅ | `apps/web/src/lib/mail/send.ts`, `outbox.ts`, `backoff.ts` |
| 1.4b | Suppression list check | ✅ | `apps/web/src/lib/mail/suppression.ts` |
| 1.4c | unsubscribe token HMAC | ✅ | `apps/web/src/lib/mail/unsub-token.ts` |
| 1.5 | Webhook Stalwart receiver + Zod parser | ✅ | `apps/web/src/app/api/mail/webhook/stalwart/route.ts` |
| 1.5b | Stalwart Zod parser standalone | ✅ | `apps/web/src/lib/mail/webhooks/stalwart-parser.ts` |
| 1.5c | Cron endpoint /api/cron/email-outbox | ✅ | `apps/web/src/app/api/cron/email-outbox/route.ts` |
| 1.5d | /api/mail/unsubscribe (one-click + GET) | ✅ | `apps/web/src/app/api/mail/unsubscribe/route.ts` |
| 1.6 | Tests unit Vitest (4 fichiers, ~35 it()) | ✅ | `apps/web/src/lib/mail/__tests__/` |

### Tests prêts (Vitest, API Jest-compatible)

- `backoff.test.ts` — 8 scénarios
- `unsub-token.test.ts` — 6 scénarios (round-trip, tamper, expiration)
- `stalwart-parser.test.ts` — 11 scénarios (Zod parsing + isHardBounce)
- `catalog.test.ts` — 7 scénarios + `describe.each` par template

## ❌ À faire par toi (infra / déploiement)

### Préalable obligatoire — réparer les crons FemiGlow

```bash
sudo bash docs/emailing/scripts/M0-fix-crons.sh
# Ou en dry-run d'abord :
sudo DRY_RUN=1 bash docs/emailing/scripts/M0-fix-crons.sh
```

Le script :
1. Sauvegarde les 18 unit files dans `/etc/systemd/system/femiglow-cron-backup-<ts>/`
2. Ajoute `-X POST` au `ExecStart` de chacun
3. `systemctl daemon-reload` + redémarre les timers
4. Vérifie qu'aucun cron n'est plus en `failed`

### Installer les dépendances npm dans le worktree

Le code utilise 3 deps qui ne sont pas encore dans `apps/web/package.json` :

```bash
cd /var/www/femiglow-emailing/apps/web
pnpm add nodemailer @react-email/render @react-email/components html-to-text
pnpm add -D @types/nodemailer @types/html-to-text
```

Sans ça, `pnpm typecheck` et les tests vont échouer sur les imports.

### Installer Listmonk (cf. `09-infrastructure-setup.md` §2-3)

Pas modifié dans le worktree — c'est de l'infra système (apt, systemd, postgres). Suivre la procédure §2.1 → §3 du document.

### Migrations Drizzle

Une fois les deps installées :

```bash
cd /var/www/femiglow-emailing/apps/web
DATABASE_URL=<URL DB de staging/dev, pas prod !> pnpm db:generate
# Inspecter la SQL générée dans drizzle/migrations/0028_*.sql
DATABASE_URL=<URL DB de staging/dev> pnpm db:migrate
```

**Ne PAS appliquer sur la DB de prod tant que tu n'as pas review.**

### Compte Stalwart `noreply@femiglow-maroc.com`

```bash
stalwart-cli create principal \
  --type User \
  --name "noreply@femiglow-maroc.com" \
  --password "$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
# Noter le password retourné dans /root/stalwart-credentials.txt
```

### Webhook Stalwart → FemiGlow

```bash
openssl rand -hex 32 > /root/.stalwart-fg-webhook-secret
chmod 600 /root/.stalwart-fg-webhook-secret

stalwart-cli create webhook \
  --url "https://admin.femiglow-maroc.com/api/mail/webhook/stalwart" \
  --events "message.queued,message.delivered,message.delivery-failed,message.delivery-deferred,auth.failure" \
  --headers "Authorization=Bearer $(cat /root/.stalwart-fg-webhook-secret)"
```

### Vars d'env à ajouter dans `apps/web/.env` (prod & staging)

```bash
# SMTP transactional via Stalwart loopback
SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_USER=noreply@femiglow-maroc.com
SMTP_PASSWORD=<celui généré au compte Stalwart>
MAIL_FROM='FemiGlow <noreply@femiglow-maroc.com>'
MAIL_REPLY_TO=info@femiglow-maroc.com

# Webhook Stalwart → FemiGlow
FEMIGLOW_STALWART_WEBHOOK_SECRET=<contenu de /root/.stalwart-fg-webhook-secret>

# Unsubscribe token signing (HMAC) — 32+ chars
MAIL_UNSUB_TOKEN_SECRET=<openssl rand -hex 40>

# Listmonk (rempli en M3 ; vide en M1 = pas d'usage)
LISTMONK_INTERNAL_URL=http://127.0.0.1:9000
LISTMONK_API_USER=
LISTMONK_API_TOKEN=
LISTMONK_WEBHOOK_SECRET=
```

### Cron timer pour `/api/cron/email-outbox`

Créer `/etc/systemd/system/femiglow-cron-email-outbox.service` :

```ini
[Unit]
Description=FemiGlow cron: email-outbox
After=femiglow.service

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -sf -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:8011/api/cron/email-outbox
TimeoutStartSec=60
```

Et `/etc/systemd/system/femiglow-cron-email-outbox.timer` :

```ini
[Unit]
Description=FemiGlow cron timer: email-outbox

[Timer]
OnBootSec=60
OnUnitActiveSec=60
AccuracySec=5

[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload
systemctl enable --now femiglow-cron-email-outbox.timer
```

## 🧪 Test bout-en-bout après infra OK

Une fois infra + deps + migrations + env OK :

```bash
cd /var/www/femiglow-emailing/apps/web

# 1. Type check
pnpm typecheck

# 2. Tests unitaires
pnpm test src/lib/mail

# 3. Verify SMTP
node -e "import('./src/lib/mail/client.ts').then(m => m.verifySmtp()).then(r => console.log(r))"

# 4. Test send manuel (via une route ou script)
# → cf. test-send pattern dans 06-wizard-specification.md §6.3
```

## 📊 Tasks Claude (résumé)

```
M0
  ✓ 0.1 Diagnostic crons        — root cause: curl GET vs POST
  ⏳ 0.2 Documenter fix crons   — script M0-fix-crons.sh livré, à exécuter
  ✓ 0.3 Drizzle schema          — schema-emails.ts (10 tables)
  ✓ 0.4 Env vars + zod          — 13 nouvelles vars

M1
  ✓ 1.1 client.ts               — nodemailer singleton
  ✓ 1.2 catalog + templates     — registry + 2/5 templates (3 à venir)
  ✓ 1.3 render.ts               — react-email pipeline
  ✓ 1.4 send + outbox + backoff — at-least-once SQL
  ✓ 1.5 webhook Stalwart        — auth + Zod + dispatch
  ✓ 1.6 Tests unit              — 4 fichiers, ~35 it()
```

## 🚧 Pas encore fait (suite M1 → M3)

- Câblage des 5 endpoints applicatifs vers `sendTransactional` (modifs `api/contact/route.ts`, `api/newsletter/route.ts`, etc.)
- 3 templates restants : `lead-notification`, `newsletter-confirm`, `password-reset`
- UI admin `/admin/emails/transactional` (RSC liste + détail)
- Tests integration API (handlers webhook + outbox cron)
- Tests E2E Playwright (transactional flow)
- Listmonk client + proxy + iframe (M3)
- Wizard de campagne (M3)

## Note méthodo

Les tests utilisent **Vitest** (déjà en place, `pnpm test`) au lieu de Jest. L'API
est compatible (describe/it/expect) → la stratégie tests doc 08 reste valable
mot pour mot, juste l'outil change. Mentionné aussi dans `08-tests-strategy.md`
si tu veux le mettre à jour (`s/Jest/Vitest/g`).
