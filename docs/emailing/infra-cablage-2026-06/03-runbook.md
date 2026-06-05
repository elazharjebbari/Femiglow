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

```bash
# 1. Relevé (lecture seule, masqué)
bash configure-stalwart-webhook.sh --show

# 2. Apply : repointe TOUTES les webhook.<id>.url vers la prod + reload + relecture.
#    L'URL précédente est consignée en sortie (ROLLBACK NOTE).
bash configure-stalwart-webhook.sh --apply

# 3. Preuve bout-en-bout (mail réel interne -> log Stalwart -> journal prod)
bash verify-webhook-e2e.sh

# 4. T34 — le flux d'erreurs s'arrête (10 min après l'apply)
grep -rc 'admin.femiglow-maroc' /etc/stalwart-mail/logs/*.log | tail -1   # compteur stable
```

**Rollback** : `WEBHOOK_TARGET_URL='<url notée en ROLLBACK NOTE>' bash configure-stalwart-webhook.sh --apply`
**Fallback** si l'API settings refuse l'écriture : webadmin Stalwart → Settings → Webhooks
(même cible, même header `X-FG-Webhook-Token`).

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
| _(en attente)_ | P3 webhook | **opérateur** | `--show` → `--apply` → `verify-webhook-e2e.sh` (cf. commandes ci-dessous) |
| 2026-06-05 | P4 Listmonk | session (lecture seule) | `bounce.enabled=false` confirmé — activation différée à R-013 |
