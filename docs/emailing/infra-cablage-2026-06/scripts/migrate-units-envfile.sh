#!/usr/bin/env bash
# migrate-units-envfile.sh — P1a : sortir CRON_SECRET des fichiers d'unité systemd.
#
# Pour chaque unité cron PROD (femiglow-cron-*, staging exclu) :
#   - 'Bearer <littéral hex>'          → 'Bearer ${CRON_SECRET}'
#   - EnvironmentFile divergent/absent → EnvironmentFile=/etc/femiglow-cron.env
# Supprime le template femiglow-cron@.service (secret passé en %i : dangereux).
#
# Prérequis : /etc/femiglow-cron.env existe (0600) avec le CRON_SECRET COURANT.
# Idempotent. Backup systématique avant toute écriture.
set -euo pipefail

ENV_FILE=/etc/femiglow-cron.env
UNIT_DIR=/etc/systemd/system
BACKUP_DIR="/root/femiglow-systemd-backup-$(date +%Y%m%d-%H%M%S)"

[[ -f "$ENV_FILE" ]] || { echo "ABSENT: $ENV_FILE — créez-le d'abord (cf. runbook P1a)" >&2; exit 2; }
[[ "$(stat -c '%a %U' "$ENV_FILE")" == "600 root" ]] || { echo "PERMS: $ENV_FILE doit être 0600 root" >&2; exit 2; }
grep -q '^CRON_SECRET=.\+' "$ENV_FILE" || { echo "CRON_SECRET vide dans $ENV_FILE" >&2; exit 2; }

mapfile -t UNITS < <(ls "$UNIT_DIR"/femiglow-cron-*.service 2>/dev/null | grep -v 'staging' | grep -v '@')
(( ${#UNITS[@]} > 0 )) || { echo "Aucune unité femiglow-cron-* trouvée" >&2; exit 2; }

mkdir -p "$BACKUP_DIR"
cp -a "${UNITS[@]}" "$BACKUP_DIR/"
[[ -f "$UNIT_DIR/femiglow-cron@.service" ]] && cp -a "$UNIT_DIR/femiglow-cron@.service" "$BACKUP_DIR/"
echo "Backup : $BACKUP_DIR ($(ls "$BACKUP_DIR" | wc -l) fichiers)"

CHANGED=0
for u in "${UNITS[@]}"; do
  name="$(basename "$u")"
  before="$(md5sum "$u")"

  # 1. Secret littéral -> variable (64-hex ou +32 hex par prudence).
  sed -i -E 's/Bearer [0-9a-fA-F]{32,}/Bearer ${CRON_SECRET}/' "$u"

  # 2. EnvironmentFile : pointer le fichier commun dédié (moindre privilège).
  if grep -q '^EnvironmentFile=' "$u"; then
    sed -i -E "s|^EnvironmentFile=.*|EnvironmentFile=$ENV_FILE|" "$u"
  else
    sed -i "/^Type=oneshot/a EnvironmentFile=$ENV_FILE" "$u"
  fi

  if [[ "$before" != "$(md5sum "$u")" ]]; then
    echo "migré   : $name"; CHANGED=$((CHANGED+1))
  else
    echo "inchangé: $name"
  fi

  # Garde-fou : plus AUCUN littéral hex, et la variable est bien là.
  if grep -qE 'Bearer [0-9a-fA-F]{32,}' "$u"; then
    echo "ÉCHEC: secret littéral résiduel dans $name — restaurer depuis $BACKUP_DIR" >&2; exit 1
  fi
  grep -q 'Bearer ${CRON_SECRET}' "$u" || { echo "ÉCHEC: $name sans Bearer \${CRON_SECRET}" >&2; exit 1; }
done

if [[ -f "$UNIT_DIR/femiglow-cron@.service" ]]; then
  rm "$UNIT_DIR/femiglow-cron@.service"
  echo "supprimé: femiglow-cron@.service (template au secret en %i)"
fi

systemd-analyze verify "${UNITS[@]}" || { echo "systemd-analyze verify a râlé — vérifier avant reload" >&2; exit 1; }
systemctl daemon-reload
echo "OK — $CHANGED unité(s) migrée(s), daemon-reload fait."
echo "Suite (T16) : systemctl start de chaque service + 'systemctl show -p Result' == success."
