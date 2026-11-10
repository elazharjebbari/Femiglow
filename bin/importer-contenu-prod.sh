#!/usr/bin/env bash
# Copie le CONTENU de la prod (alfenna) vers la base de test locale, pour que
# /kit s'affiche comme en prod : médias et leurs fichiers, composants et
# champs CMS, produits et stock, avis approuvés, stories, SEO, villes,
# coupons, pages légales, menu.
#
# Lecture seule côté prod (\copy … TO STDOUT et rsync en lecture).
# Jamais copié : clientes, leads, commandes, sessions, chat, emails,
# comptes admin, réglages de tracking (pas de GTM ni de pixel en local).
#
# Usage, depuis la racine du dépôt :
#   bash bin/importer-contenu-prod.sh            # base + fichiers médias
#   SANS_FICHIERS=1 bash bin/importer-contenu-prod.sh   # base seulement
#   AVEC_SOURCES=1 bash bin/importer-contenu-prod.sh    # + originaux (lourds)
#
# Base locale visée (conteneur Docker femiglow-test-pg par défaut) :
#   CONTENEUR=femiglow-test-pg BASE=femiglow_test UTILISATEUR=femiglow
set -euo pipefail

CONTENEUR="${CONTENEUR:-femiglow-test-pg}"
BASE="${BASE:-femiglow_test}"
UTILISATEUR="${UTILISATEUR:-femiglow}"
SERVEUR="${SERVEUR:-alfenna}"
APP_PROD="/var/www/femiglow/apps/web"

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

local_psql() { docker exec -i "$CONTENEUR" psql -U "$UTILISATEUR" -d "$BASE" -X -q -v ON_ERROR_STOP=1 "$@"; }

# Table → filtre SQL facultatif. Les colonnes sont prises dans la base LOCALE
# (même schéma), ce qui protège d'un écart de colonnes avec la prod.
TABLES=(
  "media|"
  "media_variants|"
  "media_tags|"
  "media_to_tags|"
  "media_story|"
  "media_story_segment|"
  "site_components|"
  "component_field_bindings|"
  "component_media_bindings|"
  "component_media_sets|"
  "component_media_set_items|"
  "component_animations|"
  "component_animation_bindings|"
  "products|"
  "product_variants|"
  "product_stock|"
  "product_review_photos|"
  "ritual_testimonials|WHERE status = 'APPROVED'"
  "ritual_testimonial_photos|WHERE testimonial_id IN (SELECT id FROM ritual_testimonials WHERE status = 'APPROVED')"
  "ritual_aggregate|"
  "seo_settings|"
  "seo_overrides|"
  "delivery_cities|"
  "coupons|"
  "legal_zones|"
  "legal_pages|"
  "legal_page_placements|"
  "legal_template_vars|"
  "form_config|"
  "app_config|WHERE section IN ('flags', 'nav')"
)

# Colonnes vidées à la copie (identifiants client, notes de modération).
masque() {
  case "$1.$2" in
    ritual_testimonials.customer_hash|ritual_testimonials.order_id|ritual_testimonials.moderation_note) echo "NULL" ;;
    *.created_by|*.updated_by|*.published_by|*.approved_by) echo "NULL" ;;
    *) echo "\"$2\"" ;;
  esac
}

echo "1/3 — Export depuis la prod ($SERVEUR), lecture seule"
for entree in "${TABLES[@]}"; do
  table="${entree%%|*}"; filtre="${entree#*|}"
  cols=$(local_psql -tAc "SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='$table'")
  if [ -z "$cols" ]; then echo "  ! $table absente en local, ignorée"; continue; fi
  select=""
  IFS=',' read -ra liste <<< "$cols"
  for c in "${liste[@]}"; do select+="$(masque "$table" "$c"),"; done
  select="${select%,}"
  # Liste entre guillemets pour le chargement (une colonne s'appelle « order »).
  echo "\"${cols//,/\",\"}\"" > "$TMP/$table.cols"
  # DATABASE_URL lu dans le .env de prod sans le sourcer (il ne l'est pas).
  # La requête passe par l'entrée standard de psql : aucun problème de
  # guillemets (colonnes entre guillemets doubles, filtres entre simples).
  printf '\\copy (SELECT %s FROM %s %s) TO STDOUT\n' "$select" "$table" "$filtre" \
    | ssh "$SERVEUR" "cd $APP_PROD && U=\$(sed -n 's/^DATABASE_URL=//p' .env | tr -d '\"' | tail -1) && psql \"\$U\" -X -q -v ON_ERROR_STOP=1" \
    > "$TMP/$table.tsv"
  printf '  %-30s %6s lignes\n' "$table" "$(wc -l < "$TMP/$table.tsv" | tr -d ' ')"
done

echo "2/3 — Chargement dans $BASE ($CONTENEUR)"
liste_tables=""
for entree in "${TABLES[@]}"; do
  table="${entree%%|*}"
  [ -f "$TMP/$table.tsv" ] && liste_tables+="\"$table\","
done
liste_tables="${liste_tables%,}"
{
  echo "SET session_replication_role = replica;"
  echo "TRUNCATE $liste_tables CASCADE;"
} | local_psql
for entree in "${TABLES[@]}"; do
  table="${entree%%|*}"
  [ -f "$TMP/$table.tsv" ] || continue
  cols=$(cat "$TMP/$table.cols")
  local_psql -c "SET session_replication_role = replica" -c "\\copy \"$table\"($cols) FROM STDIN" < "$TMP/$table.tsv"
done
# Version d'instruction active : exigée par le formulaire (sessions wizard).
local_psql -c "INSERT INTO chat_instruction_version (id, version, scope, body, enabled, created_by)
  SELECT 'civ_local', 1, 'default', 'local', true, 'local'
  WHERE NOT EXISTS (SELECT 1 FROM chat_instruction_version WHERE enabled)"

if [ "${SANS_FICHIERS:-0}" = "1" ]; then
  echo "3/3 — Fichiers médias : ignorés (SANS_FICHIERS=1)"
else
  dossier=$(ssh "$SERVEUR" "cd $APP_PROD && sed -n 's/^MEDIA_LOCAL_DIR=//p' .env | tr -d '\"' | tail -1")
  dossier="${dossier:-./.media-storage}"
  case "$dossier" in /*) source_prod="$dossier" ;; *) source_prod="$APP_PROD/${dossier#./}" ;; esac
  exclure=(--exclude 'sources/')
  [ "${AVEC_SOURCES:-0}" = "1" ] && exclure=()
  echo "3/3 — Fichiers médias : $SERVEUR:$source_prod → apps/web/.media-storage"
  ssh "$SERVEUR" "du -sh '$source_prod' 2>/dev/null" || true
  mkdir -p "$RACINE/apps/web/.media-storage"
  rsync -az --stats ${exclure[@]+"${exclure[@]}"} "$SERVEUR:$source_prod/" "$RACINE/apps/web/.media-storage/"
fi

echo
echo "Terminé. Redémarrer le serveur local pour vider ses caches."
