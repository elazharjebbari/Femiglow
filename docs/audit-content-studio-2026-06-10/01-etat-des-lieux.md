# 01 — État des lieux : infra, branches, base de données, cron

Tous les faits de ce document ont été **vérifiés empiriquement le 2026-06-10** (commandes exécutées sur le serveur, pas seulement lus dans le code).

## 1. Runtime : plus aucune instance du studio ne tourne

| Élément | État constaté |
|---|---|
| PM2 (root) | **Vide** — le process `web` qui servait staging sur :8012 n'existe plus |
| Port :8012 | Réattribué à **`corolle-reviews`** (Django/gunicorn, `/var/www/corolle-reviews/backend`) — un autre projet a pris le port historique du staging |
| `https://staging.femiglow-maroc.com/api/health` | **404** (le vhost ne pointe plus vers l'app femiglow-staging) |
| Build `.next` du staging | Daté du **2026-06-01 14:45** — compilé depuis l'ancien master local (avec les features média), donc **désynchronisé du working tree actuel** (origin/master) |
| Prod `/var/www/femiglow` (next-server v14, :8011) | Health **200**. Contient `content-studio-v2` (état ~22 mai) mais **aucun flag `CONTENT_STUDIO_ENABLED`/`CONTENT_STUDIO_V2_ENABLED` dans son `.env`** → `requireContentStudioEnabled()` renvoie 403, le studio est **désactivé en prod** |
| Orphelins | Un next-server v16 (`/var/www/ecom-method`, :8006) et le next prod v14 (:8011) tournent hors PM2 root, sous `nodeapp` (pm2 nodeapp vide aussi → lancés autrement) |

**Conséquence d'audit** : « ce qui marche sur l'interface » est aujourd'hui **invérifiable en conditions réelles** — il n'existe plus d'URL où ouvrir le studio. La dernière vérification empirique de l'interface complète date du **2026-05-30/06-01** (e2e `media-studio-tracks.spec.ts`, 3 passed, contre le staging vivant de l'époque) — sur le code de la branche backup, pas sur master.

## 2. Git : le schisme

```
                       6e23d4f4 (2026-05-22, base commune)
                      /                \
   origin/master = master              backup-staging-2026-06-01
   +146 commits                        +77 commits
   (tracking, chat, i18n, emails…)     (AI-Engine, audit exec, média P0–P5)
   AUCUN commit studio après 05-22     JAMAIS poussée sur origin
```

- `master` (HEAD actuel `c55add4b`) : le studio y est **figé à l'état du 2026-05-22** (UI v2 livrée, mais aucun des correctifs des audits du 28-30 mai).
- `backup-staging-2026-06-01` (HEAD `f15ebe68`) : créée le 01/06 pour préserver l'ancien master local avant `git reset --hard origin/master`. Contient tout le cycle audit → plan → exécution (détail : `08-delta-branche-backup.md`).
- La prod (`/var/www/femiglow`, master local propre à elle, HEAD `efbf5b5` emailing) a la même lignée studio que le master staging : **sans** le travail média.
- Risque de perte : la branche backup n'existe **que localement sur ce serveur**. Un `git gc` agressif ne la supprimera pas (elle est référencée), mais une suppression de branche ou une perte du disque efface définitivement ~209 000 lignes de travail.

## 3. Base de données : la DB est en avance sur le code (régression active, vérifiée)

La branche backup a appliqué les migrations `0064` (enum `media_kind` += `subtitles`) et `0065` (`content_asset_binding.meta_json` + backfill `role: 'primary'` → `'primary_image'`/`'primary_video'`) sur la base staging le 2026-05-30. Ces migrations **ne figurent pas dans le code master** (master saute de 0062 à 0073-0078).

**Vérification du 2026-06-10 sur la base staging :**

```
select role, count(*) from content_asset_binding group by role;
 primary_image  | 63
 primary_video  | 47
 voiceover      |  2
 subtitles      |  1
 composed_video |  1
-- zéro ligne role='primary'

colonne meta_json : présente
enum media_kind : image, video, audio, subtitles
```

Or le code master requête littéralement `role === 'primary'` (`apps/web/src/lib/content-studio/repository.ts:453,465,509,522`).

**Conséquences si on relance l'app depuis master sur cette base :**
1. **Aucun binding existant n'est visible** : les 110 visuels liés aux drafts disparaissent de l'UI (les drafts semblent « sans visuel », le gate d'approbation re-bloque tout).
2. Les nouveaux bindings seraient créés avec `role='primary'` → état mixte `primary`/`primary_image` ingérable.
3. Le schéma drizzle de master ignore `meta_json` (bénin en lecture) et l'enum `subtitles` (les lignes media de ce kind deviennent intypées).
4. Le journal de migrations (`meta/_journal.json`) est divergent : appliquer les migrations master 0073-0078 sur cette base est possible (pas de collision de numéros) mais laisserait 0063-0065 sans source dans le repo = **drift indocumenté permanent**, plus 10 tables `ai_engine_*` orphelines.

**La seule réconciliation propre est le merge de la branche backup** (qui contient les sources SQL 0063-0065 et le code qui comprend les rôles typés).

## 4. Cron media-optimize : cassé chaque nuit depuis le 02/06

Le crontab root contient toujours :

```
15 3 * * * /usr/bin/flock -n /tmp/femiglow-media-optimize.lock /var/www/femiglow-staging/apps/web/scripts/media-optimize-tick.sh >> /var/log/femiglow-media-optimize.log 2>&1
```

Mais `apps/web/scripts/media-optimize-tick.sh` n'existe que sur la branche backup (commit `f15ebe68`) — il a **disparu du working tree** avec le reset sur origin/master. `/var/log/femiglow-media-optimize.log` confirme :

```
flock: failed to execute /var/www/femiglow-staging/apps/web/scripts/media-optimize-tick.sh: No such file or directory
(répété chaque nuit)
```

Impact réel limité aujourd'hui (l'app qu'il appelait sur :8012 ne tourne plus de toute façon), mais c'est un symptôme du schisme : l'infra (crontab) référence des artefacts d'une branche non mergée. À corriger en même temps que la décision de branche : soit restaurer le script (`git checkout backup-staging-2026-06-01 -- apps/web/scripts/media-optimize-tick.sh` ou merge), soit retirer l'entrée crontab.

## 5. Flags d'environnement (staging `.env`, intact car gitignoré)

```
CONTENT_STUDIO_ENABLED=true
CONTENT_STUDIO_V2_ENABLED=true
CONTENT_STUDIO_IMAGE_PROVIDER=mock
CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true   ← flag d'une feature qui n'existe pas sur master
```

`SOCIAL_PUBLISHING_MODE` est absent (la variable n'existe d'ailleurs **pas** dans le code master — elle a été introduite sur la lignée backup). Le `.env` staging est donc lui aussi « en avance » sur le code checkouté : il pilote des features invisibles de master.
