# Runbook — câblage infra emailing prod (exécutable pas à pas)

> Opérateur : root sur le serveur prod. Tous les chemins sont absolus.
> **Règle d'or** : ne jamais afficher un secret ; chaque étape a son oracle ; en cas
> d'échec d'oracle → STOP, rollback de la phase, investiguer.
>
> ```bash
> cd /var/www/femiglow/docs/emailing/infra-cablage-2026-06/scripts
> chmod +x *.sh
> ```

## P0 — Pré-flight (lecture seule)

```bash
# T04 — arbre git propre
git -C /var/www/femiglow status --short          # attendu : vide

# T01/T02 — état DB + GATE runs dormants (exit 3 = STOP arbitrage)
bash preflight-db-state.sh
```

**Gate** : `GATE T02 : OK (0 run dû)` obligatoire avant P2. Sinon : lister les runs
affichés, décider (annuler les zombies via l'admin, ou accepter le réveil), re-lancer.

## P1a — Migration des unités vers EnvironmentFile

```bash
# Créer le fichier commun avec le secret COURANT (jamais affiché)
umask 077
grep '^CRON_SECRET=' /var/www/femiglow/apps/web/.env | head -1 > /etc/femiglow-cron.env
chmod 600 /etc/femiglow-cron.env

bash migrate-units-envfile.sh        # backup auto + sed + verify + daemon-reload
```

**Oracles** : sortie `OK — N unité(s) migrée(s)` ; puis T16 :

```bash
for s in /etc/systemd/system/femiglow-cron-*.service; do
  s="$(basename "$s" .service)"; [[ "$s" == *staging* ]] && continue
  systemctl start "$s"; echo "$s -> $(systemctl show -p Result --value "$s")"
done                                  # attendu : success partout
```

**Rollback** : `cp /root/femiglow-systemd-backup-<ts>/* /etc/systemd/system/ && systemctl daemon-reload`

## P1b — Rotation du CRON_SECRET

```bash
bash rotate-cron-secret.sh
```

**Oracles** (imprimés par le script) : `T17 ancien -> 401`, `T18 nouveau -> 200`,
femiglow.service répond 200. **Rollback** : restaurer `/root/femiglow-env-backup-<ts>`
vers `.env`, recopier la ligne dans `/etc/femiglow-cron.env`, `systemctl restart femiglow.service`.

## P2 — Timers email

```bash
bash install-email-timers.sh
```

**Oracles** : `list-timers` montre automation/cleanup/purge actifs, j45 **absent de la
liste active** (disabled, D2). Puis tir de validation :

```bash
systemctl start femiglow-cron-email-automation.service
systemctl show -p Result --value femiglow-cron-email-automation.service   # success
journalctl -u femiglow.service --since '2 minutes ago' | grep -i 'automation' | tail -3
```

**Rollback** : `systemctl disable --now femiglow-cron-email-{automation,listmonk-cleanup,audience-purge}.timer`

## Batterie intermédiaire (P1+P2)

```bash
bash run-battery.sh        # attendu : 0 FAIL (T41 WARN toléré) — dure ~2 min (T29 attend un tick)
```

## P3 — Webhook Stalwart (creds admin requis)

> Stalwart 0.16.x : la config se pilote par l'**API objet** (`stalwart-cli get/query/update`,
> type `WebHook`) — l'ancienne API `/api/settings` répond 404. Les logs s'appellent
> `stalwart.YYYY-MM-DD` (sans `.log`). **Un changement de config webhook exige un
> `systemctl restart stalwart-mail.service`** (~2 s de coupure ; le collecteur ne
> recharge pas l'URL à chaud, même via `--reload`/`Action ReloadSettings`).

```bash
# 1. Relevé (lecture seule, masqué) + concordance du token (par sha256, jamais affiché)
bash configure-stalwart-webhook.sh --show
bash configure-stalwart-webhook.sh --check-token

# 2. Apply : repointe l'URL du WebHook vers la prod + relecture de contrôle.
#    L'URL précédente est consignée en sortie (ROLLBACK NOTE).
bash configure-stalwart-webhook.sh --apply
systemctl restart stalwart-mail.service        # OBLIGATOIRE (cache collecteur)

# 3. (Recommandé) Filtrer aux 6 événements traités par le récepteur — sinon le
#    firehose complet (eval.*, store.*, smtp.raw-*) part vers la prod (~32 logs/min).
bash configure-stalwart-webhook.sh --filter-events
bash configure-stalwart-webhook.sh --reload

# 4. Preuve bout-en-bout (mail réel interne -> POST Stalwart -> journal prod)
bash verify-webhook-e2e.sh
# Oracle T53 : journalctl -u femiglow.service | grep mail.webhook.stalwart.received
# (champ stalwart_event=<type> — fix de la collision de clé `event`, 2026-06-05)

# 5. T34 — le flux d'erreurs s'arrête après le restart
awk -v ts="$(systemctl show -p ActiveEnterTimestamp --value stalwart-mail.service)" \
  'BEGIN{print ts}' >/dev/null
grep -c 'admin.femiglow-maroc' /etc/stalwart-mail/logs/stalwart.$(date +%F)   # compteur stable
```

**Rollback URL** : `WEBHOOK_TARGET_URL='<url notée en ROLLBACK NOTE>' bash configure-stalwart-webhook.sh --apply` + restart.
**Rollback filtre** : `stalwart-cli update WebHook <id> --field eventsPolicy=exclude --field 'events={}'` + reload.
**Fallback** si l'API objet refuse l'écriture : webadmin Stalwart (port 8080, `/login`) → Settings → Webhooks.

## P4 — Listmonk bounce (constat SEULEMENT — décision R-013 non tranchée)

```bash
sudo -u postgres psql -d listmonk -Atc \
  "SELECT key, value FROM settings WHERE key LIKE 'bounce.%' ORDER BY key" | head -10
```

Le jour du GO R-013 : activer `bounce.enable`, configurer la mailbox bounce
(POP3 Stalwart dédiée `bounce@`), vérifier `bounce.actions` (soft→none, hard→unsubscribe),
puis re-jouer la suite intégration M10 de la campagne.

## P5 — Clôture

```bash
bash run-battery.sh                                  # batterie complète, 0 FAIL
cd /var/www/femiglow && git add docs/emailing/infra-cablage-2026-06 && \
  git commit -m "docs(emailing): runbook câblage infra prod exécuté (timers, rotation secret, webhook)" && git push
```

Surveiller à J+1 :
```bash
systemctl list-timers | grep email            # nocturnes passés (LAST renseigné)
journalctl -u femiglow-cron-email-listmonk-cleanup.service -n 5
sudo -u postgres psql -d femiglow -Atc \
  "SELECT count(*) FROM email_outbox WHERE status='delivered' AND updated_at > now()-interval '1 day'"   # T54 : > 0
```

## Journal d'exécution

| Date | Phase | Opérateur | Résultat |
|---|---|---|---|
| 2026-06-05 14:45 | P0 pré-flight | session (autorisée) | GATE OK : 0 run dû, 1 automation (inactive), outbox 18 `sent`, 0 suppression |
| 2026-06-05 14:45 | P2 timers | session | 4 paires installées ; automation/cleanup/purge **enabled** (1er tick automation OK : `picked:0`), j45 **disabled** (D2) |
| 2026-06-05 14:46 | P1a migration | session (feu vert utilisateur) | 12 unités migrées, template `@` supprimé, backup `/root/femiglow-systemd-backup-20260605-144651` ; T16 : 15/15 `Result=success` |
| 2026-06-05 14:47 | P1b rotation | session (feu vert utilisateur) | T17 ancien→**401**, T18 nouveau→**200** ; backup `.env` `/root/femiglow-env-backup-20260605-144716` (0600) ; `femiglow-cron-insights.env` retiré |
| 2026-06-05 14:48 | Batterie | session | **34 PASS / 0 FAIL / 1 WARN** (T41 bounce=false, attendu — D5) |
| 2026-06-05 16:46 | P3 apply | session (feu vert utilisateur) | Script porté sur l'API objet 0.16 (`WebHook/iqxgh9qcacaa`) ; garde-fou 401 OK ; token MATCH (sha256) ; URL `admin.femiglow-maroc.com/...` → `femiglow-maroc.com/api/mail/webhook/stalwart` (relue) |
| 2026-06-05 16:49 | P3 restart | session (feu vert utilisateur) | `systemctl restart stalwart-mail` (le collecteur cachait l'ancienne URL) ; **T34 : 0 erreur webhook depuis 16:49:04** (vs 58 928 le jour même avant) |
| 2026-06-05 17:07 | P3 vérif E2E | session | T51 PASS (SMTP 250) ; T52 PASS (tcpdump : POSTs locaux :443 au rythme du throttle 1 s, 0 erreur) ; T53 PASS (`mail.webhook.stalwart.received` en continu dans journald) |
| 2026-06-05 17:14 | Fix observabilité | session | Collision de clé `event` dans les logs des récepteurs Stalwart+Listmonk (le nom du log était écrasé par le type d'événement) → champ renommé `stalwart_event`/`listmonk_event` ; tests 16/16, tsc OK, build+restart femiglow |
| 2026-06-05 17:20 | P3 filtre events | session (feu vert utilisateur) | `--filter-events` : policy=include sur les 6 événements traités (bruit −95 %, fin du transit smtp.raw-*) + reload — **pris à chaud** (vérifié : 0 réception en idle, sonde → `queue.authenticated-message-queued` reçu) |
| 2026-06-05 17:29 | Batterie finale | session | **34 PASS / 0 FAIL / 1 WARN** (T41 bounce, attendu) — P3 CLOS, reste T54 à J+1 |
| 2026-06-05 | P4 Listmonk | session (lecture seule) | `bounce.enabled=false` confirmé — activation différée à R-013 |
