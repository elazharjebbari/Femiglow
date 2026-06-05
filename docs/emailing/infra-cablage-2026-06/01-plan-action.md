# Plan d'action — Câblage infra emailing prod (timers, webhook Stalwart, durcissement secrets)

> **Date** : 2026-06-05 · **Prérequis** : campagne QA emailing mergée+déployée (master `02375b0`,
> build+restart OK). Ce plan câble la **dernière couche** : les déclencheurs infra qui font
> vivre le système en prod.
>
> **Exécution** : suivre `03-runbook.md` pas à pas. Chaque phase a ses tests dans
> `02-batterie-tests.md` (oracles avant/après) et son rollback.

---

## 1. État des lieux factuel (relevé 2026-06-05, serveur prod)

| Élément | Constat |
|---|---|
| Routes cron email | 6 routes réelles : `email-outbox`, `email-automation`, `email-campaign-sync`, `email-listmonk-cleanup`, `email-audience-purge`, `rituals-email-j45` — toutes `POST` + `Authorization: Bearer $CRON_SECRET` (compare constant-time) |
| Timers existants | **Seul** `femiglow-cron-email-outbox.timer` (60s) existe côté email. `femiglow-cron-tick.timer` (60s) couvre déjà `cart_abandon`, `lead_step1_abandon` **et `campaign_sync`** (cf. logs `cron.tick.completed`) |
| `rituals-email-j45` | **Stub** : `listOrdersForJ45()` retourne `[]` (TODO) **et** `RITUAL_EMAIL_SECRET` absent du `.env` prod → la route répondrait 500 → un timer la pingant serait en échec quotidien |
| Secrets des unités | 🔴 **10 unités prod** embarquent `CRON_SECRET` **en clair dans `ExecStart`** (visible `systemctl cat`, `ps`, backups). 2 unités utilisent `EnvironmentFile` (dont `lead-outbox` qui charge **tout** le `.env` prod — surface excessive). Un template `femiglow-cron@.service` passe même le secret **en nom d'instance** (`%i`) |
| Consommateurs externes de `CRON_SECRET` | **Aucun** : CI GitHub = placeholders dédiés, crontab = scripts sans secret, LiteSpeed = rien → **rotation sûre** |
| Webhook Stalwart | Config dans la **DB interne RocksDB** de Stalwart v0.13 (`config.json` ne contient que le store) → pilotage **uniquement** via l'API admin `:8080` (creds dans `/root/.femiglow-emailing-secrets.local`). URL actuelle → `admin.femiglow-maroc.com` (NXDOMAIN, ~64k err/jour). Récepteur prod : `POST /api/mail/webhook/stalwart`, auth header `X-FG-Webhook-Token: $FEMIGLOW_STALWART_WEBHOOK_SECRET`, **déployé** (fix parser batch R-021 inclus) |
| Listmonk bounce | `bounce.enabled=false` (audit) — décision produit R-013 non tranchée |

## 2. Décisions d'architecture (journal)

| # | Décision | Justification |
|---|---|---|
| **D1** | `email-campaign-sync` : **PAS de timer dédié** — porté par `femiglow-cron-tick` (60s) qui appelle déjà `syncCampaignStatuses()` | Un timer 300s dédié (manifeste campagne v1) **dupliquerait** le poll. Le manifeste v2 le déclare `covered_by: femiglow-cron-tick` avec une sonde sur les logs du tick |
| **D2** | `rituals-email-j45` : unité **créée mais non activée** (`disabled`) | Route = stub no-op + `RITUAL_EMAIL_SECRET` absent → l'activer produirait un échec systemd quotidien (bruit) sans aucun envoi. À activer quand `listOrdersForJ45()` sera implémentée + env posée |
| **D3** | **Migration de TOUTES les unités cron prod** vers `EnvironmentFile=/etc/femiglow-cron.env` (0600 root) **puis rotation de `CRON_SECRET`** | Le secret est en clair dans 10 fichiers d'unité (et a transité dans des sessions d'admin) ; aucun consommateur externe → rotation à coût nul. `lead-outbox` perd l'accès à tout le `.env` (moindre privilège). Le template `femiglow-cron@.service` (secret en `%i`) est supprimé |
| **D4** | Webhook Stalwart : **script idempotent `--show`/`--apply`** + vérification post-apply ; exécution avec les creds admin Stalwart (opérateur ou session autorisée) | L'API settings est la seule voie (config en RocksDB). Le script relit après écriture et échoue bruyamment si la forme d'API diverge (fallback documenté : webadmin) |
| **D5** | Listmonk `bounce.enabled` : **constat lecture seule uniquement**, activation **différée** | Activer le bounce processing exige une mailbox de bounce + POP3/forward — c'est la décision produit R-013, pas du câblage. Le runbook documente la procédure le jour du GO |
| **D6** | Staging : **hors périmètre** (unités/secret staging distincts, inchangés) | Périmètre = prod uniquement, comme demandé |

## 3. Phases

### P0 — Pré-flight (lecture seule, bloquant)
Relevé DB prod (SELECT only) : volumes `email_outbox` par statut, automations actives,
**runs d'automation « dus » qui se réveilleraient** à l'activation du timer automation.
**Gate** : si des runs dormants anciens sont éligibles à l'envoi immédiat → STOP et
arbitrage (annulation/quarantaine) AVANT d'activer le timer. Sauvegarde des unités
systemd dans `/root/femiglow-systemd-backup-<ts>/`.

### P1 — Durcissement secrets (D3)
1. **P1a** : créer `/etc/femiglow-cron.env` (0600) avec le secret **courant** ; migrer les
   12 unités prod (`Bearer <littéral>` → `Bearer ${CRON_SECRET}` + `EnvironmentFile`) ;
   supprimer `femiglow-cron@.service` ; `daemon-reload` ; **test** : `systemctl start` de
   chaque service → exit 0 (200 applicatif).
2. **P1b** : **rotation** — nouveau secret 64-hex, mise à jour `.env` prod +
   `/etc/femiglow-cron.env` + retrait de `/etc/femiglow-cron-insights.env`,
   `systemctl restart femiglow.service` ; **test** : ancien secret → 401, nouveau → 200.

*Rollback P1 : restaurer les unités depuis le backup + `daemon-reload` ; pour P1b,
restaurer la ligne `CRON_SECRET` du `.env` depuis le backup + restart.*

### P2 — Câblage des timers email (D1, D2)
Installer 4 paires unit/timer : `email-automation` (60s, **enabled --now**),
`email-listmonk-cleanup` (03:10, `Persistent=true`, enabled), `email-audience-purge`
(03:30, `Persistent=true`, enabled — **APRÈS** cleanup : garde anti-fuite Listmonk),
`rituals-email-j45` (09:00, **créé disabled**, D2).
**Tests** : batterie `INF-T2x` (présence/cadence/ordre nocturne/déclenchement manuel
200 + JSON métier + zéro erreur journal).

*Rollback P2 : `systemctl disable --now <timer>` (l'application reste saine sans eux —
c'était l'état d'avant).*

### P3 — Webhook Stalwart (D4)
`configure-stalwart-webhook.sh --show` (relevé masqué) puis `--apply` : url →
`https://femiglow-maroc.com/api/mail/webhook/stalwart`, header
`X-FG-Webhook-Token: $FEMIGLOW_STALWART_WEBHOOK_SECRET`, reload, relecture de contrôle.
Puis `verify-webhook-e2e.sh` : mail réel via SMTP local → oracle triple (log Stalwart
POST 200, journal femiglow `mail.webhook.stalwart`, `email_event` en DB).
**Pré-requis d'exécution** : creds admin Stalwart — à lancer par l'opérateur
(`! bash docs/emailing/infra-cablage-2026-06/scripts/configure-stalwart-webhook.sh --apply`)
ou par la session si autorisée.

*Rollback P3 : `--apply` consigne l'URL précédente dans sa sortie ; la repointer
(même script, variable `WEBHOOK_TARGET_URL`). Le récepteur est idempotent et borné
par rate-limit : aucun risque applicatif.*

### P4 — Listmonk bounce (D5)
Constat lecture seule (`settings` Listmonk). **Aucune écriture.** Procédure d'activation
documentée dans le runbook §P4 pour le jour où R-013 est tranchée.

### P5 — Clôture
Batterie complète (`run-battery.sh` : T0x→T4x), commit du dossier + manifeste v2,
push, mise à jour mémoire projet.

## 4. Risques résiduels & surveillance

| Risque | Mitigation |
|---|---|
| Réveil d'automations dormantes à P2 | Gate P0 (SQL dus) + quiet hours/cooldown/daily-cap actifs (campagne) + `sweep` R-028 côté code |
| Forme d'API settings Stalwart divergente | Script verify-after-write + fallback webadmin documenté ; aucune écriture aveugle |
| Fenêtre 401 pendant la rotation (≤60s) | Unités migrées AVANT rotation ; restart femiglow ~2s ; les crons ratés se rattrapent au tick suivant |
| Échec silencieux d'un timer nocturne | `OnFailure=` non câblé (hors scope) — surveillance via `check-timers` (LastTriggerStatus) + santé `/api/health` |
