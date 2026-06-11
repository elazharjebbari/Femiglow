# Batterie de tests — câblage infra emailing prod

> Chaque test a un **oracle** binaire. `scripts/run-battery.sh` exécute T01→T46
> (sauf tests marqués `manuel`/`opérateur`) et sort `exit 0` ssi tout passe.
> Les tests T5x (webhook E2E) vivent dans `verify-webhook-e2e.sh`.
> **Aucun test n'écrit en DB applicative** — les écritures observées sont celles
> du système lui-même (routes cron/webhook), déclenchées par leurs voies normales.

## T0x — Pré-flight (lecture seule, AVANT toute action)

| ID | Test | Oracle |
|---|---|---|
| T01 | `preflight-db-state.sh` : volumes `email_outbox` par statut | Relevé affiché ; pas de critère bloquant (information) |
| T02 | Automations actives + **runs dus** (`status IN (running,waiting) AND next_action_at <= now()`) | **GATE** : si `runs_dus > 0`, STOP → arbitrage avant P2 (réveil contrôlé) |
| T03 | Backup unités systemd dans `/root/femiglow-systemd-backup-<ts>/` | ≥ 12 fichiers copiés, lisibles |
| T04 | `git -C /var/www/femiglow status` | Arbre propre (le déploiement n'a pas laissé de résidu) |

## T1x — Durcissement secrets (P1)

| ID | Test | Oracle |
|---|---|---|
| T11 | `/etc/femiglow-cron.env` | Existe, `root:root`, mode `0600`, contient exactement `CRON_SECRET=` |
| T12 | Hygiène des unités : `grep -E 'Bearer [0-9a-f]{32,}' /etc/systemd/system/femiglow-cron-*.service` | **0 occurrence** (plus aucun secret littéral) |
| T13 | Toutes les unités cron prod référencent `EnvironmentFile=/etc/femiglow-cron.env` | 12/12 (la liste exacte est dans le script) |
| T14 | Template dangereux | `femiglow-cron@.service` absent |
| T15 | `systemd-analyze verify` sur chaque unité modifiée/créée | exit 0, zéro warning bloquant |
| T16 | Re-déclenchement réel : `systemctl start femiglow-cron-<unit>.service` pour CHAQUE service migré | `Result=success` (`systemctl show -p Result`), donc curl `-f` a reçu 2xx |
| T17 | **Rotation** : ancien secret → `POST /api/cron/email-outbox` | **401** |
| T18 | **Rotation** : nouveau secret (lu de l'env file) → même route | **200** |
| T19 | `/etc/femiglow-cron-insights.env` retiré ; unité insights-refresh migrée sur le fichier commun | Fichier absent + T16 vert pour insights-refresh |

## T2x — Timers email (P2)

| ID | Test | Oracle |
|---|---|---|
| T21 | Présence : les 5 paires unit/timer du manifeste v2 existent (`email-outbox`, `email-automation`, `email-listmonk-cleanup`, `email-audience-purge`, `rituals-email-j45`) | `systemctl cat` OK pour chaque |
| T22 | Activation conforme : `is-enabled` == manifeste (`enabled`×4, **`disabled` pour j45** — D2) | Conformité 5/5 |
| T23 | Cadences : `OnUnitActiveSec=60` (outbox, automation) ; `OnCalendar` 03:10 / 03:30 / 09:00 | Valeurs exactes dans `systemctl show -p TimersMonotonic/TimersCalendar` |
| T24 | **Ordre nocturne** : cleanup (03:10) **strictement avant** purge (03:30) | 03:10 < 03:30 lu depuis les unités (pas le manifeste) |
| T25 | Tir manuel `email-automation` : `systemctl start` | `Result=success` + journal applicatif sans `level:"error"` corrélé + réponse JSON métier (processed/swept) dans les logs du service |
| T26 | Tir manuel `email-listmonk-cleanup` et `email-audience-purge` | `Result=success` ×2 (200 applicatif ; no-op accepté) |
| T27 | Auth fermée : `POST` chaque route cron **sans** token puis avec token **faux** | 401 ×2 par route (aucune route cron ouverte) |
| T28 | D1 : le tick continue de porter campaign_sync | Dernier `cron.tick.completed` du journal contient `"campaign_sync"` sans `"error"` |
| T29 | Timer automation vit en continu | Deux ticks successifs du timer espacés ≤ 90s (`LastTriggerUSec` évolue) |

## T3x — Webhook Stalwart (P3)

| ID | Test | Oracle | Exécution |
|---|---|---|---|
| T31 | Récepteur vivant et fermé : `POST https://femiglow-maroc.com/api/mail/webhook/stalwart` sans token | **401** (pas 404/503) | run-battery |
| T32 | DNS : l'URL cible résout (≠ `admin.femiglow-maroc.com` NXDOMAIN) | `getent hosts femiglow-maroc.com` non vide | run-battery |
| T33 | Config Stalwart : `--show` liste le webhook avec `url = https://femiglow-maroc.com/api/mail/webhook/stalwart` et le header `X-FG-Webhook-Token` présent (valeur masquée) | Relecture API == cible | opérateur |
| T34 | Le flux d'erreurs Stalwart s'arrête : taux d'erreurs webhook dans les logs Stalwart sur 10 min post-apply | ≈ 0 nouvelle erreur `admin.femiglow-maroc.com` | opérateur |

## T4x — Listmonk (P4, constat seulement)

| ID | Test | Oracle |
|---|---|---|
| T41 | `bounce.enabled` actuel (lecture seule, SELECT sur `settings` Listmonk) | Valeur affichée ; attendu `false` aujourd'hui — la batterie **n'échoue pas** dessus tant que D5/R-013 non tranchée (WARN) |

## T5x — Webhook bout-en-bout (`verify-webhook-e2e.sh`, opérateur)

| ID | Test | Oracle |
|---|---|---|
| T51 | Envoi d'un mail réel via SMTP Stalwart local (compte noreply → mailbox locale) | SMTP accepte (250) |
| T52 | Stalwart émet le webhook vers la prod | Stalwart ne loggue PAS les POSTs réussis (seulement les échecs `telemetry.webhook-error`) → oracle = **0 erreur webhook** dans `stalwart.YYYY-MM-DD` (sans extension `.log` !) depuis le restart ; en cas de doute : tcpdump SYN locaux vers :443 au rythme du throttle (1 s) |
| T53 | La prod reçoit et journalise | `journalctl -u femiglow` : `"event":"mail.webhook.stalwart.received"` + champ `stalwart_event=<type>` (fix collision de clé `event` 2026-06-05 — avant ce fix, le log apparaissait sous le nom de l'événement Stalwart et le grep ratait tout). `ignored`/`unknown-message-id` est CORRECT pour un message-id hors outbox : prouve auth+parse |
| T54 | Chaîne complète outbox (différé) | Sous 24h de trafic réel : `email_outbox` voit apparaître des `delivered` (lecture seule) — première fois depuis l'audit (KPI Livrés > 0) |

## Critères de sortie globaux

- `run-battery.sh` exit 0 (T01–T29, T31–T32, T41-WARN toléré) ;
- T33/T34/T51–T53 verts en exécution opérateur ;
- T54 : contrôle J+1 (`SELECT count(*) FROM email_outbox WHERE status='delivered' AND updated_at > now()-interval '1 day'` > 0).
