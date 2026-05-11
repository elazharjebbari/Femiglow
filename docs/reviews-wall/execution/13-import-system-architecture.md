# 13 — Système d'import : architecture, data, flux

Spécification complète du système d'import de témoignages avec médias. Permet à Souheila d'importer en masse des rituels (CSV / JSON / JSONL / TSV / ZIP) avec validation, prévisualisation, gestion d'erreurs ligne par ligne et commit transactionnel.

## 1. Cas d'usage cibles

1. **Souheila a 50 témoignages WhatsApp** à intégrer. Elle les recopie dans un CSV. Quelques-uns ont des photos. Elle importe le tout en 10 minutes.
2. **Souheila récupère un export d'un ancien outil** (JSON exporté de Typeform, Google Forms, etc.). Elle mappe les colonnes, importe.
3. **Un partenaire envoie un dataset de témoignages collectés en boutique**, avec photos en archive ZIP. Souheila importe sans avoir à les ressaisir.
4. **Souheila importe sans médias** (texte uniquement) et attache les photos après via l'admin standard.

## 2. Principes directeurs

| Principe | Application |
| --- | --- |
| **Préserver la modération humaine** | Aucun témoignage importé ne passe directement en `APPROVED`. Tout passe par `PENDING` (ou `IMPORTED_PENDING` selon préférence). |
| **Validation avant commit** | Préview obligatoire ; aucun insert avant validation explicite. |
| **Atomicité raisonnable** | Commit par lot (transaction Postgres), rollback si échec critique. |
| **Idempotence** | Hash de chaque row pour dédupliquer intra et inter imports. |
| **Robustesse aux erreurs partielles** | Une row invalide n'empêche pas les autres ; rapport d'erreur détaillé. |
| **Audit complet** | Chaque import laisse une trace (qui, quand, combien, lesquels). |
| **Limite raisonnable** | 500 rows max par import, 5 Mo CSV, 50 Mo ZIP (avec médias). |

## 3. Vue d'ensemble du flux

```
┌──────────────────────────────────────────────────────────────────┐
│  Étape 1 — Choix de la source                                     │
│  Souheila → /admin/rituals/import                                 │
│  ─ Télécharger un modèle (CSV / JSON / ZIP exemple)               │
│  ─ Choisir un fichier ou un ZIP                                   │
│  ─ Choisir le mode (CSV semicolon / comma / JSON / JSONL / ZIP)   │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Étape 2 — Upload et parsing                                      │
│  POST /api/admin/rituals/import/upload                            │
│  ─ Validation du fichier (taille, format, encodage)               │
│  ─ Parsing en streaming                                            │
│  ─ Création d'un ImportBatch (status = PARSING)                   │
│  ─ Création d'ImportRow par ligne (status = PARSED)               │
│  ─ Si ZIP : extraction médias, stockage temporaire                │
│  ─ Lancement async des validations + vision ML                    │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Étape 3 — Mappage colonnes (si nécessaire)                        │
│  GET /api/admin/rituals/import/[batchId]                          │
│  ─ Si les colonnes ne matchent pas le modèle canonique :          │
│    Souheila mappe colonnes source → champs cibles                  │
│  ─ Si les colonnes matchent : étape sautée                         │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Étape 4 — Prévisualisation et corrections                         │
│  ─ Table des rows avec statut (valide / avertissement / erreur)   │
│  ─ Édition ligne par ligne                                         │
│  ─ Bulk : exclure les rows en erreur, appliquer un défaut         │
│  ─ Statistiques globales : N valides, N avertissements, N erreurs │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Étape 5 — Commit                                                  │
│  POST /api/admin/rituals/import/[batchId]/commit                  │
│  ─ Transaction Postgres                                            │
│  ─ Pour chaque row INCLUDED + VALID :                              │
│    ─ INSERT INTO ritual_testimonials (status = PENDING)            │
│    ─ INSERT photos (si présentes, déjà stockées en blob)           │
│    ─ INSERT audit log (action = 'imported')                        │
│  ─ Update ImportBatch (status = COMMITTED, committed_at)           │
│  ─ Logs structurés + dataLayer event                                │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Étape 6 — Rapport final                                           │
│  ─ N témoignages créés en PENDING                                 │
│  ─ N rejetés (raison)                                              │
│  ─ Lien vers la queue admin filtrée par import_batch_id           │
│  ─ Possibilité de rollback dans les 24 h                          │
└──────────────────────────────────────────────────────────────────┘
```

## 4. Modèle de données

### 4.1 Nouvelles tables

#### `ritual_import_batches`

| Colonne | Type | Contrainte | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `actor_id` | `uuid` | FK → `admin_users.id` | Qui a importé |
| `filename` | `text` | not null | Nom du fichier source |
| `file_size` | `int` | not null | Taille en bytes |
| `format` | `enum('csv_semicolon', 'csv_comma', 'tsv', 'json', 'jsonl', 'zip')` | not null | |
| `media_strategy` | `enum('none', 'zip_bundle', 'external_urls')` | default `'none'` | |
| `total_rows_parsed` | `int` | not null default 0 | Lignes lues |
| `total_rows_valid` | `int` | not null default 0 | Lignes valides |
| `total_rows_warning` | `int` | not null default 0 | Lignes avec avertissements |
| `total_rows_error` | `int` | not null default 0 | Lignes en erreur |
| `total_rows_committed` | `int` | nullable | Lignes effectivement créées |
| `column_mapping` | `jsonb` | nullable | Mapping source → cible si différent du modèle canonique |
| `defaults` | `jsonb` | nullable | Valeurs par défaut appliquées (productKey, etc.) |
| `status` | `enum('UPLOADING', 'PARSING', 'PARSED', 'PREVIEW', 'COMMITTING', 'COMMITTED', 'ROLLED_BACK', 'FAILED')` | not null | |
| `error_summary` | `text` | nullable | Si échec global |
| `notes` | `text` | nullable | Note interne de Souheila |
| `created_at` | `timestamptz` | default now | |
| `committed_at` | `timestamptz` | nullable | |
| `rolled_back_at` | `timestamptz` | nullable | |

Indexes :

- `idx_import_actor_created` : `(actor_id, created_at desc)`.
- `idx_import_status` : `(status)` where status in ('PARSING', 'COMMITTING').

#### `ritual_import_rows`

Une ligne par ligne du fichier source.

| Colonne | Type | Description |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `batch_id` | `uuid` FK CASCADE | |
| `row_index` | `int` | Numéro de ligne dans le fichier (1-based, header exclu) |
| `raw_data` | `jsonb` | Données originales de la ligne (pour audit) |
| `normalized_data` | `jsonb` | Données après mapping et défauts appliqués |
| `row_hash` | `text` | SHA-256 du `normalized_data` pour dedup |
| `validation_status` | `enum('PENDING', 'VALID', 'WARNING', 'ERROR')` | |
| `validation_errors` | `jsonb` | Tableau d'erreurs : `[{ field, code, message }]` |
| `validation_warnings` | `jsonb` | Tableau d'avertissements |
| `is_included` | `boolean` | default `true` | Inclus dans le commit ? |
| `is_duplicate` | `boolean` | default `false` | Doublon détecté (même row_hash que témoignage existant) |
| `duplicate_of_testimonial_id` | `uuid` | FK soft | Si doublon, lien vers existant |
| `created_testimonial_id` | `uuid` | FK soft | Après commit |
| `photos_metadata` | `jsonb` | Liste des références médias `[{ filename, blob_key, faces_status, faces_count }]` |
| `created_at` | `timestamptz` | default now | |

Indexes :

- `idx_import_rows_batch` : `(batch_id, row_index)`.
- `idx_import_rows_hash` : `(row_hash)`.
- `idx_import_rows_status` : `(batch_id, validation_status)`.

#### `ritual_import_temp_media`

Stockage temporaire des médias d'un import (purgés après commit ou expiration 7 j).

| Colonne | Type | Description |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `batch_id` | `uuid` FK CASCADE | |
| `filename` | `text` | Nom dans le ZIP source |
| `blob_key` | `text` | Clé Vercel Blob temporaire |
| `temp_url` | `text` | URL accessible pendant l'import |
| `width`, `height`, `byte_size`, `mime` | | Dimensions |
| `faces_status` | `photo_faces_status` | Résultat vision ML |
| `faces_count` | `int` | |
| `expires_at` | `timestamptz` | Auto-purge |
| `created_at` | `timestamptz` | |

Indexes :

- `idx_import_media_batch` : `(batch_id)`.
- `idx_import_media_expires` : `(expires_at)` partial where `expires_at < now() + interval '1 day'`.

### 4.2 Lien avec témoignages

Ajouter une colonne à `ritual_testimonials` :

```sql
ALTER TABLE ritual_testimonials
  ADD COLUMN import_batch_id uuid NULL,
  ADD COLUMN import_row_id uuid NULL;
```

Cela permet de filtrer la queue admin par `import_batch_id` et de rollback un batch en supprimant tous les témoignages qui en proviennent.

### 4.3 Mise à jour de l'enum `ritual_source`

```sql
ALTER TYPE ritual_source ADD VALUE 'import_csv';
ALTER TYPE ritual_source ADD VALUE 'import_json';
ALTER TYPE ritual_source ADD VALUE 'import_zip';
```

Permet de distinguer dans la queue les rituels qui viennent d'un import.

## 5. Migration Drizzle

`apps/web/drizzle/migrations/0018_rituals_import.sql` :

```sql
CREATE TYPE import_format AS ENUM ('csv_semicolon', 'csv_comma', 'tsv', 'json', 'jsonl', 'zip');
CREATE TYPE import_media_strategy AS ENUM ('none', 'zip_bundle', 'external_urls');
CREATE TYPE import_status AS ENUM ('UPLOADING', 'PARSING', 'PARSED', 'PREVIEW', 'COMMITTING', 'COMMITTED', 'ROLLED_BACK', 'FAILED');
CREATE TYPE import_row_validation_status AS ENUM ('PENDING', 'VALID', 'WARNING', 'ERROR');

CREATE TABLE ritual_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  filename text NOT NULL,
  file_size int NOT NULL,
  format import_format NOT NULL,
  media_strategy import_media_strategy NOT NULL DEFAULT 'none',
  total_rows_parsed int NOT NULL DEFAULT 0,
  total_rows_valid int NOT NULL DEFAULT 0,
  total_rows_warning int NOT NULL DEFAULT 0,
  total_rows_error int NOT NULL DEFAULT 0,
  total_rows_committed int,
  column_mapping jsonb,
  defaults jsonb,
  status import_status NOT NULL DEFAULT 'UPLOADING',
  error_summary text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  rolled_back_at timestamptz
);

CREATE INDEX idx_import_actor_created ON ritual_import_batches (actor_id, created_at DESC);
CREATE INDEX idx_import_status ON ritual_import_batches (status) WHERE status IN ('PARSING', 'COMMITTING');

CREATE TABLE ritual_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES ritual_import_batches(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  raw_data jsonb NOT NULL,
  normalized_data jsonb NOT NULL,
  row_hash text NOT NULL,
  validation_status import_row_validation_status NOT NULL DEFAULT 'PENDING',
  validation_errors jsonb NOT NULL DEFAULT '[]',
  validation_warnings jsonb NOT NULL DEFAULT '[]',
  is_included boolean NOT NULL DEFAULT true,
  is_duplicate boolean NOT NULL DEFAULT false,
  duplicate_of_testimonial_id uuid,
  created_testimonial_id uuid,
  photos_metadata jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_rows_batch ON ritual_import_rows (batch_id, row_index);
CREATE INDEX idx_import_rows_hash ON ritual_import_rows (row_hash);
CREATE INDEX idx_import_rows_status ON ritual_import_rows (batch_id, validation_status);

CREATE TABLE ritual_import_temp_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES ritual_import_batches(id) ON DELETE CASCADE,
  filename text NOT NULL,
  blob_key text NOT NULL,
  temp_url text NOT NULL,
  width int NOT NULL,
  height int NOT NULL,
  byte_size int NOT NULL,
  mime text NOT NULL,
  faces_status photo_faces_status NOT NULL DEFAULT 'PENDING_CHECK',
  faces_count int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_media_batch ON ritual_import_temp_media (batch_id);
CREATE INDEX idx_import_media_expires ON ritual_import_temp_media (expires_at) WHERE expires_at < now() + interval '1 day';

-- Extension enum source
ALTER TYPE ritual_source ADD VALUE 'import_csv';
ALTER TYPE ritual_source ADD VALUE 'import_json';
ALTER TYPE ritual_source ADD VALUE 'import_zip';

-- Lien témoignage → import
ALTER TABLE ritual_testimonials
  ADD COLUMN import_batch_id uuid NULL,
  ADD COLUMN import_row_id uuid NULL;

CREATE INDEX idx_ritual_import_batch ON ritual_testimonials (import_batch_id) WHERE import_batch_id IS NOT NULL;
```

## 6. Architecture services

```
┌────────────────────────────────────────────────────────────────┐
│  HTTP API (admin only)                                          │
│  ─ GET    /api/admin/rituals/import/template?format=csv|json    │
│  ─ POST   /api/admin/rituals/import/upload                      │
│  ─ GET    /api/admin/rituals/import/[batchId]                   │
│  ─ PATCH  /api/admin/rituals/import/[batchId]/mapping           │
│  ─ PATCH  /api/admin/rituals/import/[batchId]/rows/[rowId]      │
│  ─ POST   /api/admin/rituals/import/[batchId]/bulk-edit         │
│  ─ POST   /api/admin/rituals/import/[batchId]/commit            │
│  ─ POST   /api/admin/rituals/import/[batchId]/rollback          │
│  ─ DELETE /api/admin/rituals/import/[batchId]                   │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│  Services métier (lib/rituals/import/)                          │
│                                                                  │
│  ─ template-generator.ts   → CSV / JSON / ZIP sample            │
│  ─ file-detector.ts        → détection format depuis MIME + content │
│  ─ parser/                                                       │
│    ├── csv-parser.ts       → papaparse en streaming             │
│    ├── json-parser.ts      → JSON streaming                      │
│    ├── jsonl-parser.ts     → line-by-line                        │
│    └── zip-parser.ts       → unzipper + dispatch                │
│  ─ mapper.ts               → mapping colonnes source → cible    │
│  ─ row-validator.ts        → validation par row (Zod + business) │
│  ─ row-normalizer.ts       → sanitization (réutilise sanitizeBody) │
│  ─ duplicate-detector.ts   → dedup intra + inter via row_hash   │
│  ─ media-extractor.ts      → extraction ZIP + association rows  │
│  ─ media-validator.ts      → reuse vision-ml-faces.ts           │
│  ─ batch-committer.ts      → transaction commit                 │
│  ─ batch-rollback.ts       → suppression témoignages du batch   │
│  ─ cleanup-temp-media.ts   → CRON purge ritual_import_temp_media │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│  Data layer (lib/db/queries/rituals-import.ts)                  │
│  ─ createBatch, getBatch, listBatches                            │
│  ─ insertRows (bulk), updateRow, bulkUpdateRows                  │
│  ─ commitBatch (transaction), rollbackBatch                      │
│  ─ insertTempMedia, listTempMedia, deleteTempMedia               │
└────────────────────────────────────────────────────────────────┘
```

## 7. Détails du flux par étape

### 7.1 Upload et parsing

#### Limites strictes

| Format | Taille max | Rows max | Commentaires |
| --- | --- | --- | --- |
| CSV / TSV | 5 Mo | 500 | UTF-8 obligatoire |
| JSON | 5 Mo | 500 | array ou objet `{ rows: [] }` |
| JSONL | 10 Mo | 1000 | streaming naturel |
| ZIP | 50 Mo | 500 rows + 1500 photos max | Photos ≤ 5 Mo chacune |

Au-delà, l'utilisateur doit splitter ou contacter l'admin.

#### Streaming parsing

Pour ne pas charger 5 Mo en mémoire d'un coup :

- **CSV** : `papaparse` en mode streaming, callback par row.
- **JSONL** : `readline` Node, ligne par ligne.
- **JSON** : si > 1 Mo, utiliser `stream-json` ; sinon parse direct.
- **ZIP** : `unzipper` en stream, traite entry par entry.

#### Validation au parse

À ce stade, validation minimale :

- Format conforme (CSV séparé correctement, JSON valide).
- Encodage UTF-8 (rejeter Latin-1, Windows-1252).
- Pas de colonne en double.
- Si présence d'en-tête : header attendu.

Erreurs globales (encodage, malformations) → status `FAILED`, message clair.

#### ZIP handling

Structure attendue dans le ZIP :

```
import.zip
├── rituels.csv     (ou rituels.json)
└── photos/
    ├── amal-001.jpg
    ├── yasmine-002.jpg
    └── ...
```

Le fichier CSV / JSON référence les photos par leur filename :

```csv
body;wouldRecommend;ritualTags;authorFirstName;authorCity;photos
"Trois mois...";oui;ongles-plus-lisses,plus-de-casse;Amal;Rabat;amal-001.jpg
```

L'extracteur ZIP :

1. Lit le manifest (CSV / JSON).
2. Pour chaque ligne, résout les filenames photos.
3. Pour chaque photo référencée, upload en `ritual_import_temp_media` + lance vision ML.
4. Marque les photos non référencées en orphelines (avertissement, ignorées par défaut).

### 7.2 Mapping de colonnes

Si l'en-tête CSV ne correspond pas au modèle canonique, l'admin propose un mappage interactif :

```
Colonne source              Champ cible
"Témoignage"        →       body
"Recommandation"    →       wouldRecommend
"Mots-clés"         →       ritualTags
"Prénom"            →       authorFirstName
"Ville"             →       authorCity
"Photo"             →       (premier élément photos[])
"Date initiée"      →       initiatedSince
"---"               →       (champ non mappé, ignoré)
```

Mapping stocké dans `ritual_import_batches.column_mapping` :

```json
{
  "Témoignage": "body",
  "Recommandation": "wouldRecommend",
  "Mots-clés": "ritualTags",
  "Prénom": "authorFirstName",
  "Ville": "authorCity",
  "Photo": "photos[0]",
  "Date initiée": "initiatedSince"
}
```

Détection auto : si l'en-tête est exact (insensible casse, accents), mapping pré-rempli.

### 7.3 Validation par row

Chaque row passe par :

1. **Zod schema** (`RitualImportRowSchema`) — strict pour les types.
2. **Sanitization du body** (réutilise `sanitizeBody`).
3. **Détection auto-flags** (réutilise `detectAutoFlags`).
4. **Vérification tags catalogue** : tags inconnus → avertissement (pas erreur).
5. **Vérification ville catalogue** : ville inconnue → mappée sur "Autre" avec avertissement.
6. **Vérification date** : format `YYYY-MM`, dans range raisonnable.
7. **Vérification photos** : référence valide, mime ok, dimensions ≥ 600 px.
8. **Vision ML** : `REJECTED_FACE` → erreur ; `MANUAL_REVIEW` → avertissement.
9. **Dedup** : row_hash existe déjà → marqué `is_duplicate = true`.

Statut résultant :

- `VALID` : aucune erreur, aucune warning.
- `WARNING` : warnings mais pas d'erreur — inclus par défaut, signalé.
- `ERROR` : au moins une erreur — exclu par défaut.

### 7.4 Édition row par row

Dans la prévisualisation, Souheila peut :

- Éditer un body, un signal, des tags, un prénom, une ville, une date.
- Inclure / exclure une row (`is_included`).
- Retirer une photo associée.
- Voir l'erreur en clair et la fixer en place.

Modifications via `PATCH /api/admin/rituals/import/[batchId]/rows/[rowId]`.

Après modification, validation re-déclenchée automatiquement.

### 7.5 Bulk operations dans la preview

Cf. `↗ 16-bulk-management.md` pour le détail UI. Actions disponibles :

- **Tout sélectionner / désélectionner**.
- **Inclure tout / exclure tout / inclure uniquement les VALID**.
- **Appliquer un défaut** sur les champs vides (ex. productKey = 'pack-femiglow' partout).
- **Effacer tous les warnings** (les transformer en silence — marqués `acknowledged`).
- **Régénérer vision ML sur toutes les photos en `MANUAL_REVIEW`**.
- **Supprimer toutes les rows ERROR**.

### 7.6 Commit transactionnel

```sql
BEGIN;

-- Update batch
UPDATE ritual_import_batches SET status = 'COMMITTING' WHERE id = $batchId;

-- Pour chaque row INCLUDED et VALID :
INSERT INTO ritual_testimonials (
  id, public_slug, product_key, body, body_original, would_recommend,
  ritual_tags, author_first_name, author_city, initiated_since,
  is_anonymous, language, status, source, customer_hash,
  verified_purchase, featured, auto_flags,
  import_batch_id, import_row_id,
  created_at
)
SELECT
  gen_random_uuid(), generate_public_slug(),
  defaults->>'productKey',
  normalized_data->>'body',
  raw_data->>'body',
  (normalized_data->>'wouldRecommend')::ritual_signal,
  ARRAY(SELECT jsonb_array_elements_text(normalized_data->'ritualTags')),
  normalized_data->>'authorFirstName',
  normalized_data->>'authorCity',
  normalized_data->>'initiatedSince',
  COALESCE((normalized_data->>'isAnonymous')::boolean, false),
  COALESCE(normalized_data->>'language', 'fr')::ritual_language,
  'PENDING'::ritual_status,
  CASE format
    WHEN 'csv_semicolon' THEN 'import_csv'
    WHEN 'csv_comma' THEN 'import_csv'
    WHEN 'json' THEN 'import_json'
    WHEN 'zip' THEN 'import_zip'
  END::ritual_source,
  NULL, false, false,
  ARRAY(SELECT jsonb_array_elements_text(validation_warnings)),
  $batchId, id,
  now()
FROM ritual_import_rows
WHERE batch_id = $batchId AND is_included = true AND validation_status IN ('VALID', 'WARNING')
RETURNING id, import_row_id;

-- Photos : copier de temp_media vers ritual_testimonial_photos
INSERT INTO ritual_testimonial_photos (
  testimonial_id, url, thumb_url, focal_x, focal_y, width, height, byte_size, mime,
  faces_status, faces_count, position, created_at
)
SELECT
  rt.id,
  m.blob_key,        -- URL définitive (rename de temp_url)
  m.blob_key,        -- thumbnail dérivée
  0.500, 0.500, m.width, m.height, m.byte_size, m.mime,
  m.faces_status, m.faces_count,
  0,  -- position calculée selon ordre dans photos_metadata
  now()
FROM ritual_import_rows r
JOIN ritual_testimonials rt ON rt.import_row_id = r.id
JOIN jsonb_array_elements(r.photos_metadata) p ON true
JOIN ritual_import_temp_media m ON m.blob_key = p->>'blob_key';

-- Audit log : un événement par témoignage créé
INSERT INTO ritual_audit_log (testimonial_id, actor_id, action, note, payload, created_at)
SELECT rt.id, $actorId, 'imported', NULL,
  jsonb_build_object('batch_id', $batchId, 'row_index', r.row_index),
  now()
FROM ritual_testimonials rt
JOIN ritual_import_rows r ON r.id = rt.import_row_id
WHERE rt.import_batch_id = $batchId;

-- Update batch final
UPDATE ritual_import_batches
SET status = 'COMMITTED',
    committed_at = now(),
    total_rows_committed = (
      SELECT count(*) FROM ritual_testimonials WHERE import_batch_id = $batchId
    )
WHERE id = $batchId;

COMMIT;
```

Si erreur à n'importe quel point → `ROLLBACK`. L'utilisateur est notifié, batch reste en `PARSED` ou `PREVIEW`.

### 7.7 Rollback

Disponible **24 h** après le commit. Implémentation :

```sql
BEGIN;

-- Soft delete via status HIDDEN sur tous les témoignages du batch
UPDATE ritual_testimonials
SET status = 'HIDDEN',
    moderation_note = CONCAT('Rolled back from import batch ', $batchId)
WHERE import_batch_id = $batchId AND status = 'PENDING';

-- Audit
INSERT INTO ritual_audit_log (testimonial_id, actor_id, action, note, created_at)
SELECT id, $actorId, 'rolled_back', 'Import batch rollback', now()
FROM ritual_testimonials
WHERE import_batch_id = $batchId;

-- Update batch
UPDATE ritual_import_batches
SET status = 'ROLLED_BACK', rolled_back_at = now()
WHERE id = $batchId;

COMMIT;
```

Note : on **ne supprime pas** les témoignages (audit conservé). On les passe en `HIDDEN`. Cohérent avec la politique RGPD globale.

## 8. Endpoints API détaillés

### 8.1 GET `/api/admin/rituals/import/template`

Renvoie un fichier modèle téléchargeable.

```
GET /api/admin/rituals/import/template?format=csv

200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="rituels-modele.csv"

body;wouldRecommend;ritualTags;authorFirstName;authorCity;initiatedSince;isAnonymous;language;photos
"Trois mois et l'ongle a retrouvé sa nervure...";oui;ongles-plus-lisses,plus-de-casse;Amal;Rabat;2026-02;false;fr;amal-001.jpg
"Cinq minutes le soir, devenu rituel...";oui;rituel-devenu-habitude;Yasmine;Rabat;2024-03;false;fr;
"";hesite;;;Casablanca;;true;fr;
```

Formats supportés : `csv` (semicolon par défaut), `csv-comma`, `json`, `jsonl`, `zip` (avec dossier photos vide).

Cf. `↗ 15-import-templates-formats.md` pour les modèles complets.

### 8.2 POST `/api/admin/rituals/import/upload`

Upload du fichier source.

```
POST /api/admin/rituals/import/upload
Content-Type: multipart/form-data

Form data:
  file: <fichier>
  format: csv_semicolon | csv_comma | tsv | json | jsonl | zip
  media_strategy: none | zip_bundle | external_urls

202 Accepted
{
  "data": {
    "batchId": "uuid",
    "status": "PARSING",
    "totalRowsParsed": null
  }
}
```

Validation immédiate : taille, mime. Création batch en status `UPLOADING` → `PARSING`. Job async lance le parsing.

### 8.3 GET `/api/admin/rituals/import/[batchId]`

Récupère le détail d'un batch avec rows paginées.

```
GET /api/admin/rituals/import/[batchId]?status=ERROR&include_warnings=1&page=1&limit=50

200 OK
{
  "data": {
    "batch": { id, status, totals, ... },
    "rows": [
      { id, rowIndex, normalizedData, validationStatus, validationErrors, validationWarnings, isIncluded, photosMetadata },
      ...
    ],
    "totalRows": 123,
    "page": 1,
    "limit": 50
  }
}
```

### 8.4 PATCH `/api/admin/rituals/import/[batchId]/mapping`

Définit le mapping colonnes → champs cibles. Re-déclenche la normalisation et la validation.

```
PATCH /api/admin/rituals/import/[batchId]/mapping
{
  "mapping": { "Témoignage": "body", "Recommandation": "wouldRecommend", ... },
  "defaults": { "productKey": "pack-femiglow", "language": "fr" }
}

200 OK
{ "data": { "rowsRevalidated": 123 } }
```

### 8.5 PATCH `/api/admin/rituals/import/[batchId]/rows/[rowId]`

Modifie une row individuelle.

```
PATCH /api/admin/rituals/import/[batchId]/rows/[rowId]
{
  "normalized_data": { ...nouvelles valeurs },
  "is_included": true
}

200 OK
{ "data": { "row": {...} } }
```

### 8.6 POST `/api/admin/rituals/import/[batchId]/bulk-edit`

Actions bulk. Cf. `↗ 16-bulk-management.md`.

```
POST /api/admin/rituals/import/[batchId]/bulk-edit
{
  "action": "exclude_errors" | "include_all_valid" | "apply_default" | "regenerate_face_check" | "delete_errors",
  "scope": { "rowIds": [...] } | { "filter": { validationStatus: 'ERROR' } },
  "payload": { "field": "productKey", "value": "pack-femiglow" }
}

200 OK
{ "data": { "rowsAffected": 42 } }
```

### 8.7 POST `/api/admin/rituals/import/[batchId]/commit`

Commit final. Transaction.

```
POST /api/admin/rituals/import/[batchId]/commit
{
  "note": "Import depuis WhatsApp mai 2026"
}

200 OK
{
  "data": {
    "batchId": "...",
    "status": "COMMITTED",
    "totalCommitted": 38,
    "totalSkippedErrors": 4,
    "totalSkippedDuplicates": 2,
    "redirectUrl": "/admin/rituals/queue?import_batch_id=..."
  }
}
```

### 8.8 POST `/api/admin/rituals/import/[batchId]/rollback`

Rollback un commit.

```
POST /api/admin/rituals/import/[batchId]/rollback
{
  "confirm": true,
  "reason": "Erreur de mapping détectée"
}

200 OK
{ "data": { "rolledBack": 38 } }
```

Disponible uniquement si :

- `status = COMMITTED`.
- `committed_at + 24h > now()`.
- Aucun témoignage du batch n'a été modifié manuellement après import.

### 8.9 DELETE `/api/admin/rituals/import/[batchId]`

Supprime un batch en cours (status `PARSING`, `PARSED`, `PREVIEW`). Pas accessible sur `COMMITTED`.

## 9. CRON cleanup

`/api/cron/rituals-import-cleanup` (horaire) :

```sql
-- Purge temp media expirés
DELETE FROM ritual_import_temp_media WHERE expires_at < now();

-- Marque les batches abandonnés (PARSED ou PREVIEW depuis > 7 jours sans commit)
UPDATE ritual_import_batches
SET status = 'FAILED', error_summary = 'Abandonné (aucune action depuis 7 jours)'
WHERE status IN ('PARSED', 'PREVIEW') AND created_at < now() - interval '7 days';

-- Purge les batches FAILED ou ROLLED_BACK depuis > 30 jours
-- (en gardant l'audit log dans ritual_audit_log via les témoignages liés)
DELETE FROM ritual_import_batches
WHERE status IN ('FAILED', 'ROLLED_BACK') AND created_at < now() - interval '30 days';
```

## 10. RBAC

Étend la matrice de rôles :

| Rôle | Voir imports | Lancer import | Commit | Rollback |
| --- | --- | --- | --- | --- |
| **admin** | Oui | Oui | Oui | Oui |
| **moderator** | Oui | Oui | Oui | Non |
| **viewer** | Oui (lecture) | Non | Non | Non |

Implémenté dans `apps/web/src/lib/auth/can-rituals.ts` étendu :

```ts
export type RitualImportAction = 'view' | 'upload' | 'commit' | 'rollback' | 'delete_batch';

export function canRitualImportAction(role: string, action: RitualImportAction): boolean {
  const matrix = {
    admin: ['view', 'upload', 'commit', 'rollback', 'delete_batch'],
    moderator: ['view', 'upload', 'commit', 'delete_batch'],
    viewer: ['view'],
  };
  return matrix[role]?.includes(action) ?? false;
}
```

## 11. Sécurité

| Vecteur | Mitigation |
| --- | --- |
| Upload ZIP avec contenu malicieux | Validation magic bytes, `unzipper` borné en profondeur et taille, sandbox |
| CSV injection (`=cmd()`) | Sanitize cell values, échapper `=`, `+`, `-`, `@` en début de cellule (CSV export n'est pas le cas, mais en preview admin oui) |
| Path traversal dans le ZIP (`../../etc/passwd`) | Whitelist `^[a-zA-Z0-9_-]+\.(jpg|png|webp|heic)$` pour filenames photos |
| DOS via grosse archive | Taille limite, nombre d'entrées limite, scan en streaming |
| Photos avec EXIF GPS | EXIF strip systématique avant insert (existant) |
| Doublons malicieux | Dedup row_hash + customer_hash si présent |
| Vision ML bypass via batch | Toujours exécutée sur chaque photo importée, pas d'override possible côté import |
| Spam via import (10 000 fake rituals) | Limite 500 rows par batch, max 5 batches en cours par admin |

## 12. Performance et limites

| Métrique | Cible | Note |
| --- | --- | --- |
| Parsing 500 rows CSV | < 2 sec | Streaming |
| Parsing 50 Mo ZIP avec photos | < 15 sec | I/O bound |
| Validation 500 rows (sans vision ML) | < 1 sec | Pure CPU |
| Vision ML 100 photos | ~ 90 sec | Async, ne bloque pas l'UI |
| Commit 500 rituels | < 3 sec | Transaction Postgres |
| Rollback 500 rituels | < 2 sec | Update simple |

Si l'utilisateur upload un fichier > 500 rows, l'UI propose de splitter ou contacte admin.

## 13. Récapitulatif charge import

| Phase | Charge |
| --- | --- |
| Migration BDD + types | 0,5 j |
| Parsers (CSV / JSON / JSONL / ZIP) | 1,5 j |
| Validation row + vision ML batch | 1 j |
| API admin import (9 endpoints) | 1,5 j |
| UI admin import wizard | 2 j (cf. `14-import-wizard-ui-specification.md`) |
| Bulk management generic | 1 j (cf. `16-bulk-management.md`) |
| Templates téléchargeables | 0,3 j |
| Tests (Jest + MSW + Playwright) | 1,5 j |
| **Total** | **~9 j** |

## 14. Synthèse — règles d'or import

1. **Aucun témoignage importé n'est `APPROVED` directement** ; tous passent par `PENDING`.
2. **Preview obligatoire** avant commit.
3. **Commit transactionnel** : tout ou rien sur la transaction Postgres.
4. **Rollback disponible 24 h** post-commit.
5. **Dedup row_hash** intra et inter batches.
6. **Vision ML sur toute photo importée**, pas d'exception.
7. **Limites strictes** : 500 rows, 50 Mo ZIP, 5 Mo CSV.
8. **EXIF strip systématique**.
9. **Whitelist filenames** dans ZIP (anti path traversal).
10. **Templates téléchargeables depuis l'UI** dans 5 formats.
