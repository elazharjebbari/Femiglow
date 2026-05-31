# 08 — Architecture des données et contrats API

Schémas Drizzle, types Zod et endpoints REST pour le composant « Rituels partagés ». Aucune modification de l'architecture existante : on ajoute 4 tables et 8 routes, sans toucher aux migrations existantes.

## 1. Diagramme des tables

```
ritual_testimonials ─┬─< ritual_testimonial_photos
                     │
                     ├─< ritual_audit_log
                     │
                     └─ (vue/matérialisée) ritual_aggregate
                         (clé : product_key)
```

## 2. Table `ritual_testimonials`

### 2.1 Colonnes

| Colonne | Type Drizzle | Contrainte | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | Identifiant interne |
| `public_slug` | `text` | unique, not null | Slug court (8 chars, base32) pour URL `?card=xxxxxxxx` |
| `product_key` | `text` | not null, FK soft → `products.slug` | Produit lié (`pack-femiglow` actuellement) |
| `body` | `text` | not null, length 50–600 chars validé | Texte du témoignage |
| `would_recommend` | `enum('oui', 'hesite', 'non')` | not null | Signal de retour |
| `ritual_tags` | `text[]` | default `{}`, max 3 items | Tags choisis par l'initiée |
| `author_first_name` | `text` | nullable, length 1–30 | Prénom |
| `author_city` | `text` | nullable | Ville (parmi liste fixée) |
| `initiated_since` | `text` | nullable, format `YYYY-MM` | Mois d'initiation |
| `is_anonymous` | `boolean` | default `false` | Si `true`, signature = `Une initiée, [Ville]` |
| `language` | `enum('fr', 'ar')` | default `'fr'` | Langue du texte |
| `status` | `enum('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN')` | default `'PENDING'` | État de modération |
| `source` | `enum('web', 'email_j45', 'manual')` | not null | Origine |
| `customer_hash` | `text` | nullable | HMAC SHA-256 de `customer.email` — permet de vérifier qu'un même client ne soumet pas deux fois |
| `order_id` | `uuid` | nullable, FK soft → `orders.id` | Si vérifié comme achat |
| `verified_purchase` | `boolean` | default `false` | Calculé : `true` si `order_id` non null et `orders.status = paid` |
| `featured` | `boolean` | default `false` | Mis en avant dans le module compact `/kit` |
| `moderation_note` | `text` | nullable | Note interne (raison de rejet, etc.) |
| `auto_flags` | `text[]` | default `{}` | Auto-flags détectés : `emoji`, `short`, `long`, `link_external`, `forbidden_word`, `face_detected` |
| `body_original` | `text` | nullable | Texte original avant sanitization (audit) |
| `created_at` | `timestamptz` | default now | Horodatage soumission |
| `published_at` | `timestamptz` | nullable | Horodatage approbation |
| `updated_at` | `timestamptz` | default now, on update | Dernière modification |

### 2.2 Index

| Index | Colonnes | Type |
| --- | --- | --- |
| `idx_ritual_status_product` | `(status, product_key)` | btree |
| `idx_ritual_featured` | `(featured)` where `featured = true` | partial btree |
| `idx_ritual_published_at` | `(published_at desc)` where `status = 'APPROVED'` | partial btree |
| `idx_ritual_customer_hash` | `(customer_hash)` | btree |
| `idx_ritual_tags` | `(ritual_tags)` | gin |
| `unique_public_slug` | `(public_slug)` | unique |

### 2.3 Migration Drizzle (extrait)

```sql
CREATE TYPE ritual_signal AS ENUM ('oui', 'hesite', 'non');
CREATE TYPE ritual_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
CREATE TYPE ritual_source AS ENUM ('web', 'email_j45', 'manual');
CREATE TYPE ritual_language AS ENUM ('fr', 'ar');

CREATE TABLE ritual_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_slug text NOT NULL,
  product_key text NOT NULL,
  body text NOT NULL,
  would_recommend ritual_signal NOT NULL,
  ritual_tags text[] NOT NULL DEFAULT '{}',
  author_first_name text,
  author_city text,
  initiated_since text,
  is_anonymous boolean NOT NULL DEFAULT false,
  language ritual_language NOT NULL DEFAULT 'fr',
  status ritual_status NOT NULL DEFAULT 'PENDING',
  source ritual_source NOT NULL,
  customer_hash text,
  order_id uuid,
  verified_purchase boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  moderation_note text,
  auto_flags text[] NOT NULL DEFAULT '{}',
  body_original text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_public_slug UNIQUE (public_slug),
  CONSTRAINT body_length CHECK (char_length(body) BETWEEN 50 AND 600),
  CONSTRAINT ritual_tags_max CHECK (cardinality(ritual_tags) <= 3)
);

CREATE INDEX idx_ritual_status_product ON ritual_testimonials (status, product_key);
CREATE INDEX idx_ritual_featured ON ritual_testimonials (featured) WHERE featured = true;
CREATE INDEX idx_ritual_published_at ON ritual_testimonials (published_at DESC) WHERE status = 'APPROVED';
CREATE INDEX idx_ritual_customer_hash ON ritual_testimonials (customer_hash);
CREATE INDEX idx_ritual_tags ON ritual_testimonials USING gin (ritual_tags);
```

## 3. Table `ritual_testimonial_photos`

### 3.1 Colonnes

| Colonne | Type | Contrainte | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `testimonial_id` | `uuid` | not null, FK → `ritual_testimonials.id` ON DELETE CASCADE | |
| `url` | `text` | not null | URL full-res (Vercel Blob ou local `/media/`) |
| `thumb_url` | `text` | not null | URL thumbnail 240×240 |
| `focal_x` | `numeric(4,3)` | default `0.500` | Focal point X (0.000–1.000) |
| `focal_y` | `numeric(4,3)` | default `0.500` | Focal point Y |
| `width` | `int` | not null | |
| `height` | `int` | not null | |
| `byte_size` | `int` | not null | |
| `mime` | `text` | not null | `image/jpeg`, `image/webp`, etc. |
| `faces_status` | `enum('PENDING_CHECK', 'OK', 'MANUAL_REVIEW', 'REJECTED_FACE')` | default `'PENDING_CHECK'` | Statut vision ML |
| `faces_count` | `int` | default `0` | Nombre de visages détectés |
| `faces_check_at` | `timestamptz` | nullable | Horodatage du check ML |
| `position` | `int` | default `0` | Ordre dans la carte (0–2) |
| `created_at` | `timestamptz` | default now | |

### 3.2 Migration

```sql
CREATE TYPE photo_faces_status AS ENUM ('PENDING_CHECK', 'OK', 'MANUAL_REVIEW', 'REJECTED_FACE');

CREATE TABLE ritual_testimonial_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  testimonial_id uuid NOT NULL REFERENCES ritual_testimonials(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumb_url text NOT NULL,
  focal_x numeric(4,3) NOT NULL DEFAULT 0.500,
  focal_y numeric(4,3) NOT NULL DEFAULT 0.500,
  width int NOT NULL,
  height int NOT NULL,
  byte_size int NOT NULL,
  mime text NOT NULL,
  faces_status photo_faces_status NOT NULL DEFAULT 'PENDING_CHECK',
  faces_count int NOT NULL DEFAULT 0,
  faces_check_at timestamptz,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT max_3_photos_per_testimonial CHECK (position BETWEEN 0 AND 2)
);

CREATE INDEX idx_photo_testimonial ON ritual_testimonial_photos (testimonial_id);
CREATE INDEX idx_photo_faces_pending ON ritual_testimonial_photos (faces_status) WHERE faces_status IN ('PENDING_CHECK', 'MANUAL_REVIEW');
```

## 4. Table `ritual_audit_log`

### 4.1 Colonnes

| Colonne | Type | Description |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `testimonial_id` | `uuid` FK | |
| `actor_id` | `uuid` nullable FK → `admin_users.id` | Null si système |
| `action` | `text` | `created` / `approved` / `rejected` / `hidden` / `featured_on` / `featured_off` / `corrected` / `restored` |
| `note` | `text` nullable | Justification |
| `payload` | `jsonb` | Snapshot avant/après si pertinent |
| `created_at` | `timestamptz` default now | |

Table append-only. Aucune mise à jour.

## 5. Vue matérialisée `ritual_aggregate`

Refresh toutes les 5 minutes ou à chaque publication.

```sql
CREATE MATERIALIZED VIEW ritual_aggregate AS
SELECT
  product_key,
  count(*) AS total_count,
  count(*) FILTER (WHERE would_recommend = 'oui') AS oui_count,
  count(*) FILTER (WHERE would_recommend = 'hesite') AS hesite_count,
  count(*) FILTER (WHERE would_recommend = 'non') AS non_count,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM ritual_testimonial_photos p
    WHERE p.testimonial_id = ritual_testimonials.id
    AND p.faces_status = 'OK'
  )) AS with_photos_count,
  (
    SELECT jsonb_object_agg(tag, cnt)
    FROM (
      SELECT unnest(ritual_tags) AS tag, count(*) AS cnt
      FROM ritual_testimonials
      WHERE status = 'APPROVED' AND product_key = rt.product_key
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 6
    ) t
  ) AS top_tags,
  max(published_at) AS last_published_at
FROM ritual_testimonials rt
WHERE status = 'APPROVED'
GROUP BY product_key;

CREATE UNIQUE INDEX idx_ritual_aggregate_product ON ritual_aggregate (product_key);
```

CRON `/api/cron/rituals-refresh-aggregate` exécute `REFRESH MATERIALIZED VIEW CONCURRENTLY ritual_aggregate;` toutes les 5 minutes.

## 6. Schémas Zod

### 6.1 `RitualTestimonialPublic` (sortie API publique)

```ts
import { z } from 'zod';

export const RitualSignalSchema = z.enum(['oui', 'hesite', 'non']);

export const RitualTagSchema = z.enum([
  'ongles-plus-lisses',
  'plaque-souple',
  'cuticules-apaisees',
  'plus-de-casse',
  'eclat-naturel',
  'rituel-devenu-habitude',
  'mains-detendues',
  'fini-brillant',
  'halal',
]);

export const RitualTestimonialPhotoPublic = z.object({
  url: z.string().url(),
  thumbUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
  position: z.number().int().min(0).max(2),
});

export const RitualTestimonialPublic = z.object({
  publicSlug: z.string().length(8),
  body: z.string().min(50).max(600),
  wouldRecommend: RitualSignalSchema,
  ritualTags: z.array(RitualTagSchema).max(3),
  signature: z.object({
    firstName: z.string().min(1).max(30).nullable(),
    city: z.string().nullable(),
    initiatedSince: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
    isAnonymous: z.boolean(),
    verifiedPurchase: z.boolean(),
  }),
  language: z.enum(['fr', 'ar']),
  photos: z.array(RitualTestimonialPhotoPublic).max(3),
  publishedAt: z.string().datetime(),
});

export type RitualTestimonialPublic = z.infer<typeof RitualTestimonialPublic>;
```

### 6.2 `RitualTestimonialSubmit` (entrée API)

```ts
export const RitualTestimonialSubmit = z.object({
  productKey: z.string(),
  body: z.string().min(50).max(600),
  wouldRecommend: RitualSignalSchema,
  ritualTags: z.array(RitualTagSchema).max(3).default([]),
  authorFirstName: z.string().min(1).max(30).nullable().default(null),
  authorCity: z.string().nullable().default(null),
  initiatedSince: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().default(null),
  isAnonymous: z.boolean().default(false),
  language: z.enum(['fr', 'ar']).default('fr'),
  photos: z.array(z.object({
    blobKey: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    byteSize: z.number().int().max(5 * 1024 * 1024),
    mime: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  })).max(3).default([]),
  emailToken: z.string().nullable().default(null), // HMAC du J+45
  consentMarketing: z.boolean().default(false),
});

export type RitualTestimonialSubmitInput = z.infer<typeof RitualTestimonialSubmit>;
```

### 6.3 `RitualSummary`

```ts
export const RitualSummary = z.object({
  productKey: z.string(),
  totalCount: z.number().int().min(0),
  ouiCount: z.number().int().min(0),
  hesiteCount: z.number().int().min(0),
  nonCount: z.number().int().min(0),
  withPhotosCount: z.number().int().min(0),
  topTags: z.array(z.object({
    tag: RitualTagSchema,
    count: z.number().int().min(0),
  })).max(6),
  lastPublishedAt: z.string().datetime().nullable(),
});
```

## 7. Endpoints API

### 7.1 GET `/api/rituals/summary`

```
GET /api/rituals/summary?product_key=pack-femiglow

200 OK
{
  "data": {
    "productKey": "pack-femiglow",
    "totalCount": 26,
    "ouiCount": 24,
    "hesiteCount": 1,
    "nonCount": 1,
    "withPhotosCount": 18,
    "topTags": [
      { "tag": "ongles-plus-lisses", "count": 17 },
      { "tag": "plaque-souple", "count": 14 },
      { "tag": "cuticules-apaisees", "count": 11 }
    ],
    "lastPublishedAt": "2026-05-08T14:32:00Z"
  }
}
```

Cache: `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600`.

### 7.2 GET `/api/rituals/list`

```
GET /api/rituals/list?product_key=pack-femiglow&with_photos=1&tags=halal&sort=recommended&cursor=&limit=12

200 OK
{
  "data": [
    {
      "publicSlug": "k7m3qp2x",
      "body": "Trois mois et l'ongle a retrouvé sa nervure...",
      "wouldRecommend": "oui",
      "ritualTags": ["ongles-plus-lisses", "plus-de-casse"],
      "signature": {
        "firstName": "Amal",
        "city": "Rabat",
        "initiatedSince": "2026-02",
        "isAnonymous": false,
        "verifiedPurchase": true
      },
      "language": "fr",
      "photos": [...],
      "publishedAt": "2026-05-01T10:00:00Z"
    },
    ...
  ],
  "meta": {
    "nextCursor": "eyJpZCI6Ii4uLiJ9",
    "hasMore": true,
    "total": 18
  }
}
```

Params :

| Param | Type | Défaut | Description |
| --- | --- | --- | --- |
| `product_key` | string | (requis) | Produit |
| `with_photos` | `0` / `1` | `0` | Filtre |
| `tags` | comma-list | `` | Tags requis (intersection) |
| `signal` | `oui` / `hesite` / `non` | (tous) | Filtre signal |
| `sort` | `recommended` / `recent` / `helpful` | `recommended` | Tri |
| `cursor` | base64 | `null` | Pagination |
| `limit` | int 1–24 | `12` | |

### 7.3 POST `/api/rituals/submit`

```
POST /api/rituals/submit
Content-Type: application/json
X-CSRF-Token: ...

{ ... RitualTestimonialSubmit ... }

202 Accepted
{
  "data": {
    "publicSlug": "k7m3qp2x",
    "status": "PENDING",
    "estimatedPublishHours": 48
  }
}
```

Validation côté serveur :

1. Schema Zod.
2. Sanitization du `body` (strip emojis, trim, normaliser apostrophes droites en courbes).
3. Rate-limit : 1 soumission par adresse IP par 24 h, 1 par `customer_hash` par 30 j.
4. Si `emailToken` fourni : validation HMAC, extraction `customer_hash` et `order_id` du token.
5. Insert en `PENDING`.
6. Enqueue job `vision-ml-faces` pour chaque photo.
7. Enqueue job `auto-flags-detect`.

### 7.4 GET `/api/rituals/policy`

Renvoie le texte « Comment ces rituels partagés sont vérifiés » (markdown rendu en HTML safe).

### 7.5 Routes admin

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/admin/rituals/queue` | GET | Liste filtrable de `PENDING` + `MANUAL_REVIEW` photos |
| `/api/admin/rituals` | GET | Liste filtrable globale |
| `/api/admin/rituals/[id]` | GET | Détail complet |
| `/api/admin/rituals/[id]` | PATCH | Actions : approve / reject / hide / restore / feature / unfeature / correct |
| `/api/admin/rituals/[id]/photos/[photoId]/recheck` | POST | Re-run vision ML |
| `/api/admin/rituals/[id]/audit` | GET | Log d'audit |
| `/api/admin/rituals/policy` | PATCH | Éditer le texte politique |
| `/api/admin/rituals/insights` | GET | Agrégation détaillée (tags fréquence, signal global) |

Toutes les routes admin sont protégées par `require-admin()` et tracent dans `audit_events`.

### 7.6 Routes CRON

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/cron/rituals-refresh-aggregate` | POST | Refresh matérialisée (5 min) |
| `/api/cron/rituals-email-j45` | POST | Envoyer e-mail J+45 (1 fois / jour) |
| `/api/cron/rituals-faces-recheck-stale` | POST | Re-run vision ML sur photos `PENDING_CHECK` > 1 h (1 fois / heure) |

Toutes protégées par header `Authorization: Bearer <CRON_SECRET>`.

## 8. Sanitization du `body`

Pipeline appliqué à `body` à la soumission, avant insert :

1. **Normalize Unicode** : NFC.
2. **Strip emojis** : suppression de la plage `U+1F300–U+1FAFF` + variantes selector.
3. **Normaliser apostrophes** : `'` → `'`, `"` → `« »` selon contexte.
4. **Espaces fines insécables** : avant `:` `;` `?` `!` (U+202F).
5. **Trim leading/trailing whitespace**.
6. **Collapse spaces consécutifs**.
7. **Détection auto-flags** (lien externe, longueur, mots interdits).

Le texte original est stocké dans `body_original` pour audit. Le texte affiché est `body` (post-sanitization).

## 9. HMAC token pour e-mail J+45

```
emailToken = base64url(
  hmac_sha256(
    secret = ENV.RITUAL_EMAIL_SECRET,
    payload = {
      order_id: "...",
      customer_hash: "...",
      issued_at: 1715000000,
      expires_at: 1717592000  // +30 jours
    }
  )
)
```

Validation serveur : déchiffrer, vérifier signature, vérifier `expires_at` > now, vérifier `order_id` correspond à une commande `paid`.

## 10. Mécanisme `customer_hash`

```
customer_hash = sha256(customer.email + ENV.RITUAL_PEPPER)
```

Sert à :

- Détecter doublons (rate-limit par customer 30 j).
- Lier le témoignage à une commande sans stocker l'e-mail en clair (RGPD-friendly).
- Permettre à la maison de retrouver l'auteur pour communication (par recherche inverse, indexée).

## 11. Récapitulatif charge BDD

| Opération | Fréquence prévue | Coût attendu |
| --- | --- | --- |
| `GET /summary` | 10 000 / jour | trivial (cache 5 min) |
| `GET /list` (1ère page) | 8 000 / jour | < 20 ms (index) |
| `GET /list` (load more) | 2 000 / jour | < 20 ms |
| `POST /submit` | 10 / jour (puis croissance) | ~ 200 ms (avec photos en async) |
| `REFRESH MATERIALIZED VIEW` | 288 / jour (5 min) | < 100 ms |
| Vision ML check (par photo) | ~ 20 / jour | ~ 800 ms (async) |
| Cron J+45 | 1 / jour | proportionnel au volume de commandes 45 j passées |

Tout reste largement sous les capacités d'un Neon Postgres standard.

## 12. Bibliothèques

- **Drizzle ORM** existant.
- **Zod** existant.
- **MediaPipe Face Detection** (modèle léger 4 Mo, runtime côté serveur Node) — pour `vision-ml-faces`.
- **Sharp** existant — pour thumbnails et compression côté serveur.
- **iron-session** existant — pour CSRF token soumission.

Aucune dépendance lourde à ajouter.
