# PR 3 — flou de chargement et import des images générées (runbook)

Ce que la PR 3 apporte, et comment s'en servir sur le serveur. Rien ne change pour les visiteuses : l'import crée des **brouillons**, et l'affichage par audience n'est branché qu'avec la PR 4 (`HERO_MEDIA_VARIANTS=on`).

| Élément | Fichier | Rôle |
|---|---|---|
| Flou de chargement | `lib/media/pipeline/blur-data-url.ts`, `optimize-image.ts` | Miniature WebP ≈ 16×20 px en data URL (< 1,5 Ko), calculée à chaque optimisation d'image et enregistrée dans `media.blur_data_url` (upload admin via le worker, seed, import) |
| Backfill du flou | `lib/media/blur-backfill.ts`, `scripts/backfill-media-blur.ts` | Remplit `blur_data_url` pour les médias existants |
| Ingestion partagée | `lib/media/ingest.ts` | Création ou ré-optimisation idempotente d'une image ; utilisée par le seed (`seed-pipeline.ts`) et par l'import |
| Import | `lib/media/import/*`, `scripts/import-component-media.ts` | Arborescence `generated/` → médias + ensembles en brouillon |

## 1. Prérequis

1. **Migration 0087 appliquée** (`component_media_sets*`, colonne `media.blur_data_url`) : cf. `06-deploiement-pr1-pr2.md`. Sans elle, le backfill et l'import échouent dès la première requête.
2. **Code de la PR 3 déployé** (`bin/deploy-prod.sh`). Aucune migration, aucune dépendance nouvelle.
3. **Registre synchronisé** (bouton de synchronisation de l'admin composants, `syncComponentRegistry`) : l'import vérifie que `site_components.metadata.mediaVariants` existe pour le composant. Sinon chaque ensemble sort en erreur `policy.not_synced` / `component.not_synced`, et **aucun média n'est créé**.
4. Les scripts lisent `apps/web/.env` (comme les autres scripts) et **refusent de tourner sans `DATABASE_URL`** : ils ne basculent jamais en mode mémoire.

Toutes les commandes se lancent depuis `apps/web` :

```bash
cd /var/www/femiglow/apps/web
```

## 2. Backfill du flou

Idempotent : seuls les médias image `ready` / `passthrough`, non supprimés, dont `blur_data_url` est NULL sont traités, par lots triés par id. Relancer reprend là où le passage précédent s'est arrêté.

Source lue pour chaque média (la plus légère d'abord) : le plus petit variant WebP, puis JPEG, puis AVIF, lu par le driver de stockage de l'application (disque en `local`) ; sinon l'URL du variant en HTTP ; sinon `original_url`. Le variant reflète le recadrage réellement affiché.

```bash
pnpm media:backfill-blur -- --dry-run      # 1. compte et calcule, n'écrit rien
pnpm media:backfill-blur -- --limit 20     # 2. premier lot de contrôle
pnpm media:backfill-blur                   # 3. le reste (options : --batch <n>, défaut 50 ;
                                           #    --fetch-timeout <ms>, défaut 15000)
```

- Chaque ligne du journal donne le statut (`updated`, `would_update`, `no_source`, `error`), l'id, le slug et la source lue. Le résumé JSON final donne les compteurs.
- `no_source` : aucun fichier lisible (variants absents du disque…). Ce n'est pas une erreur du script : le média garde son placeholder actuel. Le corriger en ré-uploadant ou en relançant le seed (heal), puis relancer le backfill.
- `error` : image illisible, ou source HTTP qui n'a pas répondu dans le délai (`--fetch-timeout`, 15 s par défaut) alors qu'aucune autre source n'était lisible. Code de sortie 1 s'il en reste ; le reste du lot est quand même traité, et relancer retente ces médias.
- Contrôle :
  ```bash
  psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE blur_data_url IS NULL) AS sans_flou, count(*) AS total FROM media WHERE kind = 'image' AND deleted_at IS NULL AND status IN ('ready','passthrough')"
  ```

Les nouveaux médias (upload admin, seed, import) reçoivent leur flou automatiquement : le backfill ne sert qu'une fois. Le flou n'est jamais bloquant : si son calcul échoue, l'image est quand même optimisée et publiable, avec `blur_data_url` à NULL (le backfill la rattrapera).

## 3. Import des images générées

### 3.1 Convention

```
<root>/<componentKey>/<slot>/<variant>/<locale>/<nn>-<slug>[.mobile].(png|jpg|jpeg|webp)
<root>/<componentKey>/<slot>/<variant>/<locale>/<nn>-<slug>.alt.json   {"fr": "…", "ar": "…", "en": "…"}
<root>/<componentKey>/<slot>/<variant>/<locale>/_alt.json              (facultatif) alts du dossier
```

| Segment | Valeurs | Donne |
|---|---|---|
| `variant` | `default` · `angle-a`…`angle-e`, `angle-temoin` · `ab-<expKey>-<bras>` | (`default`, `*`) · (`angle`, clé) · (`ab:<expKey>`, bras) — la dimension doit être déclarée par le composant |
| `locale` | `fr` · `ar` · `en` · `_all` | langue · `*` avec `crossLocale = true` (image sans texte) |
| `nn` | `01`, `02`… contigus | position ; un seul fichier pour un slot `single` (`primary`), au plus `maxItems` pour une liste (`secondary` : 6) |
| `.mobile` | même `nn` et même slug | recadrage 3:4 → `mobileMediaId` (facultatif) |

- **Alts** : le `.alt.json` de l'image prime ; sinon `_alt.json` du dossier, soit un objet de langues commun à toutes les images, soit des entrées `"<nn>-<slug>"` ou `"<nn>"`. Un alt manquant est un **avertissement** (à compléter dans l'admin), pas une erreur.
- **Ignorés** : à la racine, tout ce qui commence par `_` ou `.` (`_work/`, `_log.csv`) ; partout, les fichiers cachés (`.DS_Store`).
- **Erreurs** (le dossier concerné n'est pas importé, les autres oui) : composant inconnu ou sans `mediaVariants`, slot non déclaré, variante ou langue hors convention, dimension non déclarée, clé d'angle invalide, positions non contiguës, trop d'images, deux images à la même position, `.mobile` sans image desktop, `.alt.json` invalide.
- Le test `lib/media/import/manifest-layout.test.ts` vérifie que toutes les sorties de `manifest.json` passent le parseur sans erreur ni avertissement.

### 3.2 Ce que fait l'import

1. Pour chaque image : sha256, puis slug déterministe `cmv-<composant>-<slot>-<variante>-<langue>-<nn>-<slug>[-mobile]` (`_all` → `all`), puis ingestion (variants AVIF/WebP/JPEG aux breakpoints du composant, blurhash, flou, statut `ready` ; empreinte gardée dans `media.overrides.sourceChecksum`).
2. **Idempotent** :
   - même slug et même empreinte → `skipped` ;
   - fichier identique octet pour octet à un média déjà importé (les 14 copies du pack, soit 28 fichiers) → le média existant est réutilisé (`deduped`), rien n'est stocké en double ;
   - fichier **modifié** depuis l'import précédent → **nouveau** média (slug suffixé par l'empreinte). L'ancienne image, peut-être publiée, n'est jamais remplacée en place ; la nouvelle arrive dans un brouillon.
3. Un ensemble par dossier : `upsertDraftSet(source = 'import')`. Un brouillon ou un publié déjà identique n'est pas réécrit (aucune ligne d'historique de plus). Un **brouillon saisi dans l'admin** n'est jamais écrasé sans `--force` (erreur `set.admin_draft_exists`).
4. **Jamais publié** sans `--publish`.
5. **Échec d'une ré-optimisation** (`--force`, heal) : le média existant n'est pas modifié (statut, empreinte, overrides) et reste affichable ; l'erreur est rapportée. Seul un média créé par le passage en cours passe en `failed`.
6. **Média partagé** (dédoublonné entre dossiers, voire entre composants) : `--force` ajoute les breakpoints de la politique courante à ceux déjà mémorisés (`overrides.breakpoints`), il ne les remplace jamais — aucun variant utile à un autre composant ne disparaît.

### 3.3 Procédure

1. Copier le dossier `generated/` sur le serveur (les images ne sont pas commitées), par exemple dans `/var/www/femiglow/docs/hero-media-par-angle/generated/`.
2. **Passage à blanc** (aucune écriture, ni fichiers ni base) :
   ```bash
   pnpm import:component-media -- --root /var/www/femiglow/docs/hero-media-par-angle/generated \
     --component kit-hero-produit --dry-run --report /tmp/import-dry.json
   ```
   Relire le rapport : `summary` (pour le pack actuel : 62 fichiers image, 34 médias à créer et 28 dédoublonnés — les 14 copies du pack, desktop et mobile —, 13 ensembles `would_create`), `errors` (doit être vide), `warnings`, `ignored` (`_work/`, `_log.csv`).
3. **Import réel** (brouillons) :
   ```bash
   pnpm import:component-media -- --root /var/www/femiglow/docs/hero-media-par-angle/generated \
     --component kit-hero-produit --report /tmp/import.json
   ```
   Compter quelques minutes (encodage AVIF). En cas d'interruption, relancer la même commande : ce qui est fait est ignoré.
   `--actor <adminId|email>` renseigne l'auteur des médias et des ensembles (sinon : aucun). Il est vérifié avant toute écriture : un admin inconnu ou un format invalide arrête l'import sans rien créer.
4. **Relancer la même commande** : le résumé doit indiquer 0 média créé et 13 ensembles `unchanged`.
5. **Publication dans l'admin** (`/admin/components/kit-hero-produit`, onglet « Médias par audience », PR 6) : relire la matrice et les alts FR/AR/EN, régler le point focal si besoin, prévisualiser `/{fr|ar|en}/kit?angle=<a…e|temoin>&hmv_preview=draft`, puis publier.
   - Tant que l'interface admin n'est pas livrée, `--publish` publie tout ce qui a été importé (à réserver à un environnement de recette, ou après relecture du rapport) :
     ```bash
     pnpm import:component-media -- --root … --component kit-hero-produit --publish
     ```
6. L'affichage ne change qu'avec la PR 4 et `HERO_MEDIA_VARIANTS=on` (cf. 05 §7).

### 3.4 Rapport (`--report`)

```jsonc
{
  "root": "…", "componentKey": "kit-hero-produit", "dryRun": false, "publish": false, "force": false,
  "summary": { "files": 62, "sets": 13, "mediaCreated": 34, "mediaReprocessed": 0, "mediaSkipped": 0,
               "mediaDeduped": 28, "setsCreated": 13, "setsUpdated": 0, "setsUnchanged": 0,
               "setsPublished": 0, "errors": 0, "warnings": 0 },
  "created":     [{ "relPath": "…", "slug": "cmv-…", "mediaId": "me_…", "status": "created", "sourceChecksum": "sha256-…" }],
  "reprocessed": [],
  "skipped":     [{ "…": "…", "status": "deduped", "reason": "identique à un média déjà importé" }],
  "errors":      [{ "severity": "error", "code": "…", "path": "…", "message": "…" }],
  "warnings":    [],
  "ignored":     ["_work/", "_log.csv"],
  "sets":        [{ "folder": "kit-hero-produit/primary/angle-e/_all", "slot": "primary", "variantDim": "angle",
                    "variantKey": "e", "locale": "*", "crossLocale": true, "items": 1,
                    "action": "created", "status": "draft", "setId": "cms_…", "version": 1 }]
}
```

Code de sortie : 0 sans erreur, 1 sinon. Les avertissements ne font pas échouer.

### 3.5 Options

| Option | Effet |
|---|---|
| `--root <dir>` | obligatoire ; relatif au dossier de lancement |
| `--component <key>` | n'importe que ce composant (les autres dossiers sont ignorés) |
| `--dry-run` | aucune écriture ; avec `--publish`, annonce `would_publish` |
| `--publish` | publie les ensembles importés (ou leur brouillon identique déjà présent) |
| `--force` | ré-optimise les médias existants (heal, breakpoints ajoutés à ceux déjà présents) et remplace un brouillon admin ; ne remplace jamais une image par un autre fichier |
| `--report <file>` | écrit le rapport JSON complet |
| `--actor <adminId\|email>` | auteur des médias et ensembles ; doit exister dans `admin_users` (vérifié avant toute écriture) |

## 4. Retour arrière

- Brouillons importés : les abandonner dans l'admin (`discardDraft`) ; ils ne sont pas visibles en ligne.
- Ensembles publiés par erreur : dépublier la cellule (repli au niveau suivant) ou restaurer la version précédente depuis l'historique.
- Médias importés non utilisés : les supprimer depuis la médiathèque. Un média référencé par un ensemble ne peut pas être supprimé définitivement (`RESTRICT`).
- Flou : la colonne est purement additive ; `UPDATE media SET blur_data_url = NULL` ramène à l'état antérieur (placeholder blurhash/SVG actuel).
