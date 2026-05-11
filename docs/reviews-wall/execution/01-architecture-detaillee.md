# 01 — Architecture détaillée du composant « Rituels partagés »

Vue technique complète : couches, flux, contrats, dépendances. Ce document est référencé par toutes les phases du runbook quand une question d'architecture se pose.

## 1. Diagramme des couches

```
┌────────────────────────────────────────────────────────────────────┐
│  PRESENTATION (Next.js App Router)                                  │
│                                                                     │
│  ┌──────────────────────────┐    ┌──────────────────────────┐      │
│  │  /kit (RSC)               │    │  /admin/rituals/*         │      │
│  │  ─ RitualsModuleBound RSC │    │  ─ admin layout           │      │
│  │  ─ RitualsWallDrawer CSR  │    │  ─ queue / detail pages   │      │
│  │  ─ RitualsWizard CSR      │    │  ─ insights / policy      │      │
│  │  ─ RitualPhotoLightbox    │    │                           │      │
│  └──────────────────────────┘    └──────────────────────────┘      │
│           │                                  │                       │
└───────────┼──────────────────────────────────┼──────────────────────┘
            │                                  │
            ▼                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│  HTTP API (Next.js Route Handlers)                                  │
│                                                                     │
│  Public                                Admin (require-admin)        │
│  ─ GET  /api/rituals/summary           ─ GET    /api/admin/rituals/queue    │
│  ─ GET  /api/rituals/list              ─ GET    /api/admin/rituals/[id]     │
│  ─ POST /api/rituals/submit            ─ PATCH  /api/admin/rituals/[id]     │
│  ─ POST /api/rituals/upload-photo      ─ POST   /api/admin/rituals/[id]/photos/[pid]/recheck │
│  ─ GET  /api/rituals/policy            ─ GET    /api/admin/rituals/audit    │
│                                        ─ PATCH  /api/admin/rituals/policy   │
│                                        ─ GET    /api/admin/rituals/insights │
│  CRON (bearer secret)                                                       │
│  ─ POST /api/cron/rituals-refresh-aggregate                                 │
│  ─ POST /api/cron/rituals-email-j45                                         │
│  ─ POST /api/cron/rituals-faces-recheck-stale                               │
└────────────────────────────────────────────────────────────────────┘
            │                                  │
            ▼                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│  DOMAIN / SERVICES                                                  │
│                                                                     │
│  lib/rituals/                                                        │
│  ─ sanitize-body.ts          ─ vision-ml-faces.ts                    │
│  ─ auto-flags.ts             ─ email-tokens.ts                       │
│  ─ aggregator.ts             ─ customer-hash.ts                      │
│  ─ moderation.ts             ─ photo-pipeline.ts                     │
│                                                                     │
│  Cross-cutting (existant)                                            │
│  ─ lib/auth/ (require-admin, session)                                │
│  ─ lib/rate-limit/                                                   │
│  ─ lib/crypto/ (hmac, encryption)                                    │
│  ─ lib/logging/                                                      │
│  ─ lib/tracking/                                                     │
└────────────────────────────────────────────────────────────────────┘
            │                                  │
            ▼                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│  DATA ACCESS (Drizzle ORM)                                          │
│                                                                     │
│  lib/db/queries/rituals.ts                                          │
│  ─ getRitualSummary(productKey)                                     │
│  ─ listRituals({...filters, cursor, limit})                         │
│  ─ getRitualByPublicSlug(slug)                                      │
│  ─ insertRitual(data)                                               │
│  ─ updateRitualStatus(id, action, actorId)                          │
│  ─ insertPhoto(testimonialId, blob)                                 │
│  ─ updatePhotoFacesStatus(photoId, status, count)                   │
│  ─ insertAuditEvent(testimonialId, actorId, action, payload)        │
│  ─ refreshRitualAggregate()                                         │
└────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────────┐
│  STORAGE                                                            │
│                                                                     │
│  Postgres (Neon)                Vercel Blob               Filesystem (dev) │
│  ─ ritual_testimonials           ─ uploads/rituals/        ─ /public/uploads/ │
│  ─ ritual_testimonial_photos     ─ thumbs/rituals/                            │
│  ─ ritual_audit_log                                                            │
│  ─ ritual_aggregate (mv)                                                       │
│  ─ insights_rituals_daily (J3)                                                 │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Flux de données — lecture publique

```
Visiteur ouvre /kit
   │
   ▼
RSC RitualsModuleBound
   │ fetch parallèle :
   ├─► GET /api/rituals/summary?product_key=pack-femiglow
   │   → cache HTTP 5 min, ~5 ms si cache hit
   │
   └─► GET /api/rituals/list?product_key=pack-femiglow&featured=1&limit=3
       → query Postgres avec index partial featured
       → < 20 ms
   │
   ▼
Render module compact (3 cards + lien)
   │
   ▼
[Visiteur clique « Lire les N rituels →»]
   │
   ▼
Dynamic import RitualsWallDrawer (lazy, ~30 ko)
   │
   ▼
Mount drawer
   │ fetch initial parallèle :
   ├─► GET /api/rituals/summary (cache hit)
   └─► GET /api/rituals/list?limit=12 (sans filtre)
   │
   ▼
Render drawer rempli
   │
   ▼
[Filtre change OU load more]
   │
   ▼
GET /api/rituals/list?...&cursor=...
   │
   ▼
React Query met à jour la liste
```

## 3. Flux de données — soumission

```
Initiée clique « Partager mon rituel »
   OR Initiée clique le lien dans l'e-mail J+45
   │
   ▼
RitualsWizard monte (lazy, ~25 ko)
   │ Si emailToken présent :
   ▼
   POST /api/rituals/decode-email-token
   → valide HMAC, retourne {productKey, customerFirstName, customerCity}
   → pré-remplit le wizard
   │
   ▼
[Étape 1] body + signal
[Étape 2] tags + photos (upload progressif)
   │
   │  Pour chaque photo droppée :
   ├─► POST /api/rituals/upload-photo (form-data)
   │    Server : valide mime, taille, dimensions, EXIF strip, Sharp variants,
   │              enqueue job vision-ml-faces, return blobKey + thumbUrl
   │    Async : run vision-ml-faces, update photo.faces_status
   │
[Étape 3] signature
   │
   ▼
[Click Partager mon rituel]
   │
   ▼
POST /api/rituals/submit
   │ Server :
   │ 1. Validate CSRF
   │ 2. Validate Zod
   │ 3. Rate-limit check
   │ 4. Sanitize body
   │ 5. Detect auto-flags
   │ 6. Insert ritual_testimonials (status PENDING)
   │ 7. Insert ritual_testimonial_photos (lien blobKeys)
   │ 8. Insert ritual_audit_log (action created)
   │ 9. Trigger webhook ritual_submitted (si configuré)
   │ 10. Return 202 + publicSlug
   │
   ▼
Wizard affiche confirmation
   │
   ▼
[24-48 h plus tard]
   │
Souheila /admin/rituals/queue
   │
   ▼
PATCH /api/admin/rituals/[id] { action: 'approve' }
   │ Server :
   │ 1. require-admin
   │ 2. Update status=APPROVED, published_at=now()
   │ 3. Insert ritual_audit_log (action approved)
   │ 4. Send approval email (async)
   │ 5. Trigger ritual_aggregate refresh (background)
   │
   ▼
Visible sur le wall
```

## 4. Modèle de données — diagramme entités

```
                    ┌─────────────────────────────────┐
                    │  ritual_testimonials             │
                    ├─────────────────────────────────┤
                    │  id PK                           │
                    │  public_slug UNIQUE              │
                    │  product_key                     │
                    │  body                            │
                    │  body_original                   │
                    │  would_recommend ENUM            │
                    │  ritual_tags TEXT[]              │
                    │  author_first_name?              │
                    │  author_city?                    │
                    │  initiated_since?                │
                    │  is_anonymous BOOL               │
                    │  language ENUM                   │
                    │  status ENUM                     │
                    │  source ENUM                     │
                    │  customer_hash?                  │
                    │  order_id? FK (soft)             │
                    │  verified_purchase BOOL          │
                    │  featured BOOL                   │
                    │  moderation_note?                │
                    │  auto_flags TEXT[]               │
                    │  created_at                      │
                    │  published_at?                   │
                    │  updated_at                      │
                    └────┬────────────────────┬───────┘
                         │                    │
                  1..N   │                    │  1..N
                         ▼                    ▼
       ┌──────────────────────────┐  ┌────────────────────────┐
       │  ritual_testimonial_photos │  │  ritual_audit_log     │
       ├──────────────────────────┤  ├────────────────────────┤
       │  id PK                    │  │  id PK                 │
       │  testimonial_id FK        │  │  testimonial_id FK     │
       │  url                      │  │  actor_id? FK admin    │
       │  thumb_url                │  │  action TEXT           │
       │  focal_x, focal_y         │  │  note?                 │
       │  width, height            │  │  payload JSONB         │
       │  byte_size, mime          │  │  created_at            │
       │  faces_status ENUM        │  └────────────────────────┘
       │  faces_count              │
       │  faces_check_at?          │
       │  position                 │
       │  created_at               │
       └──────────────────────────┘

                ┌──────────────────────────┐
                │  ritual_aggregate (MV)    │
                ├──────────────────────────┤
                │  product_key PK           │
                │  total_count              │
                │  oui_count, hesite, non   │
                │  with_photos_count        │
                │  top_tags JSONB           │
                │  last_published_at        │
                └──────────────────────────┘
                  REFRESH every 5 min
                  ou sur publication

                ┌──────────────────────────┐
                │  insights_rituals_daily   │
                ├──────────────────────────┤
                │  date, product_key PK     │
                │  module_views             │
                │  wall_opens               │
                │  cta_buy_clicks           │
                │  submit_starts            │
                │  submit_success           │
                └──────────────────────────┘
                  agrégé depuis
                  tracking_events_log
```

## 5. Contrats de couche par couche

### 5.1 Presentation ↔ HTTP API

| Côté | Lib | Méthode |
| --- | --- | --- |
| RSC | `fetch()` natif Next.js avec `next: { revalidate: 300 }` | GET seulement |
| CSR (hooks) | `@tanstack/react-query` v5 | GET/POST avec retry exponentiel |

Toutes les réponses JSON suivent le format global :

```ts
type ApiResponse<T> =
  | { data: T; meta?: Record<string, unknown> }
  | { error: { code: string; message: string; details?: Record<string, string> } };
```

### 5.2 HTTP API ↔ Domain

Les Route Handlers délèguent **immédiatement** à un service `lib/rituals/*.ts`. Aucune logique métier dans `route.ts`. Pattern :

```ts
// app/api/rituals/submit/route.ts
import { NextResponse } from 'next/server';
import { RitualTestimonialSubmit } from '@/lib/schemas/rituals';
import { submitRitual } from '@/lib/rituals/moderation';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    await rateLimit.check(request, 'ritual-submit');
    const body = await request.json();
    const parsed = RitualTestimonialSubmit.parse(body);
    const result = await submitRitual(parsed, { request });
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (e) {
    return handleApiError(e);
  }
}
```

### 5.3 Domain ↔ Data

Les services appellent les queries Drizzle via `lib/db/queries/rituals.ts`. Pas de query SQL direct dans les services (sauf cas vraiment ponctuel — passer par une query nommée).

```ts
// lib/rituals/moderation.ts
import { insertRitual, insertAuditEvent } from '@/lib/db/queries/rituals';
import { sanitizeBody } from './sanitize-body';
import { detectAutoFlags } from './auto-flags';
import { hashCustomer } from './customer-hash';

export async function submitRitual(input, ctx) {
  const { sanitized, flags: emojiFlags } = sanitizeBody(input.body);
  const otherFlags = detectAutoFlags(sanitized);
  const customerHash = input.emailToken
    ? extractCustomerHashFromToken(input.emailToken)
    : null;

  const ritual = await insertRitual({
    ...input,
    body: sanitized,
    bodyOriginal: input.body,
    autoFlags: [...emojiFlags, ...otherFlags],
    customerHash,
    status: 'PENDING',
  });

  await insertAuditEvent(ritual.id, null, 'created', {
    source: input.source,
    autoFlags: [...emojiFlags, ...otherFlags],
  });

  // Enqueue photo jobs etc.
  return { publicSlug: ritual.publicSlug, status: ritual.status };
}
```

## 6. Côté client — state management

### 6.1 Drawer

State local React (pas Zustand) :

```ts
type DrawerState = {
  isOpen: boolean;
  view: 'list' | 'wizard' | 'policy';
  selectedFilters: Set<'with_photos' | 'halal' | 'recent'>;
  scrollPosition: number;
};
```

Persistance URL `?wall=*` via `useSearchParams` + `router.replace`.

### 6.2 Liste paginée

`useInfiniteQuery` React Query :

```ts
useInfiniteQuery({
  queryKey: ['rituals', 'list', productKey, filters, sort],
  queryFn: ({ pageParam }) => fetchRitualList({ ...filters, sort, cursor: pageParam }),
  initialPageParam: null,
  getNextPageParam: (last) => last.meta.nextCursor,
  staleTime: 60_000,
});
```

### 6.3 Wizard

State local React (un seul composant orchestrateur, étapes en sous-composants) :

```ts
type WizardState = {
  step: 1 | 2 | 3 | 'confirmation';
  body: string;
  wouldRecommend: 'oui' | 'hesite' | 'non' | null;
  ritualTags: string[];
  uploadedPhotos: { blobKey: string; thumbUrl: string; status: PhotoStatus }[];
  authorFirstName: string;
  authorCity: string;
  initiatedSince: { month: number; year: number } | null;
  isAnonymous: boolean;
  emailToken: string | null;
  isSubmitting: boolean;
  submitError: string | null;
};
```

Brouillon localStorage clé `ritual-draft-v1`, autosave 15 s.

## 7. Cross-cutting concerns

### 7.1 Authentification

- **Public** : aucune auth. Anti-CSRF via Origin / Referer check sur POST.
- **Admin** : Iron-session existant. Helper `require-admin()` sur chaque route admin.
- **CRON** : header `Authorization: Bearer $CRON_SECRET`.

### 7.2 Rate-limiting

Token bucket par clé. Buckets utilisés :

| Bucket key | Limite | Fenêtre |
| --- | --- | --- |
| `ritual-submit:ip:{ip}` | 1 | 24 h |
| `ritual-submit:customer_hash:{hash}` | 1 | 30 j |
| `ritual-upload-photo:ip:{ip}` | 10 | 1 h |
| `ritual-policy:ip:{ip}` | 100 | 1 h (anti-scrape) |

### 7.3 Logging

`lib/logging/` Pino existant. Niveau `info` pour événements métier, `warn` pour auto-flags critiques, `error` pour 5xx.

Champs structurés ajoutés :

```ts
log.info('ritual_submitted', {
  testimonial_id,
  source,
  auto_flags,
  photo_count,
  body_length,
  has_email_token,
});
```

### 7.4 Tracking

`lib/tracking/` existant. Émettre via `track(eventName, payload)`. Le dispatch vers GA4 / Meta / GTM est géré par le provider system.

### 7.5 Erreurs

`lib/errors/` existant. Hiérarchie :

```ts
ApiError → BadRequestError, NotFoundError, RateLimitError, UnauthorizedError, InternalError
```

`handleApiError(e)` transforme en réponse JSON normalisée + log structuré.

## 8. Sécurité

| Vecteur | Mitigation |
| --- | --- |
| XSS dans body | Sanitization HTML stricte (whitelist tags vide — seulement texte brut), affichage via React `{body}` (échappement auto), pas de `dangerouslySetInnerHTML` |
| CSRF sur submit | Origin / Referer check + Iron-session pour admin |
| Spam | Rate-limit IP + customer_hash, captcha invisible Cloudflare Turnstile en option phase 2 |
| Upload malicieux | Validation mime stricte (magic bytes via Sharp), EXIF strip, taille max, dimensions min/max |
| Vision ML bypass | Pas de bypass possible — toute photo passe par le job côté serveur |
| RGPD | customer_hash (HMAC), pas d'e-mail en clair, droit à l'oubli implémenté |
| SSRF via URL externe dans body | `auto-flags` détecte les URLs, modération humaine obligatoire |
| Injection SQL | Drizzle ORM paramétré, jamais de SQL string concat |
| Replay attack token | HMAC + `expires_at` à 30 j, vérification serveur |

## 9. Performance — bilan attendu

| Opération | Latence cible | Stratégie |
| --- | --- | --- |
| Module compact RSC | < 100 ms TTFB | Streaming + cache 5 min summary |
| Drawer initial fetch | < 400 ms | Parallel summary + list |
| Filter change | < 300 ms | React Query cache + index partiel Postgres |
| Load more | < 250 ms | Cursor stable, index partiel |
| Submit | < 800 ms | Async vision ML, insert + audit + webhook synchrones |
| Vision ML face check | < 2 s | MediaPipe léger, exécution Vercel Function |
| CRON refresh aggregate | < 100 ms | REFRESH CONCURRENTLY |

## 10. Modularité

### 10.1 Découpage en composants Bound vs purs

Convention déjà existante dans le projet : `*Bound` = orchestré (data fetch + media binding), version pure prend tout en props.

```
RitualsModuleBound.tsx   ← server component, fetch
RitualsModule.tsx        ← pure, props injectées
RitualCard.tsx           ← pur, variant compact|default
```

### 10.2 Hooks réutilisables

```
lib/rituals/use-rituals-list.ts
lib/rituals/use-rituals-summary.ts
lib/rituals/use-ritual-wizard.ts
lib/rituals/use-photo-upload.ts
lib/rituals/use-track-ritual.ts
```

### 10.3 Tests par couche

Chaque couche a ses tests dédiés (cf. `07-strategie-tests.md`) :

- Queries Drizzle → Vitest avec pg-mem ou test DB.
- Services → Vitest pur (sans DB, mock queries).
- Routes API → Vitest + MSW pour appels externes.
- Composants → Vitest + Testing Library + MSW.
- E2E → Playwright.

## 11. Évolutivité — points d'extension prévus

| Point | Mécanisme |
| --- | --- |
| Nouveau tag rituel | Ajouter au `app_config.rituals_tag_catalog`, traduire dans le microcopy |
| Nouveau filtre chip | Composant `RitualsWallFilters` accepte un tableau de chips configurables |
| Multi-produit (Phase 2) | `product_key` déjà partout, juste ajouter un produit en BDD et un filtre |
| Multilangue AR | Champ `language` déjà présent, ajouter `lang === 'ar'` route + i18n |
| Page dédiée `/rituels-partages` | Réutilise les mêmes API + queries, juste un nouveau layout |
| Réponse maison à un témoignage | Ajouter table `ritual_replies`, FK testimonial_id |
| Vidéos | Ajouter `kind = 'video'` dans `ritual_testimonial_photos` (renommer en `media`) |
| Programme d'ambassadrices | Ajouter `is_ambassador` sur les commandes + flag dans `ritual_testimonials` |
| Provider vision ML alternatif | Interface `VisionMLProvider` à respecter pour switch MediaPipe → Cloud Vision |

## 12. Dépendances ajoutées

| Lib | Usage | Poids gzip | Justification |
| --- | --- | --- | --- |
| `@mediapipe/tasks-vision` | Face detection serveur | ~ 4 Mo (serveur) | Open source, performant, pas de cloud externe |
| `papaparse` | CSV parser streaming (import) | ~ 15 ko (admin only) | Mature, performant, gère bien les edge cases |
| `unzipper` | ZIP extraction (import) | ~ 30 ko (serveur only) | Streaming, anti-zip-bomb, supporte UTF-8 |
| `stream-json` | JSON streaming pour gros fichiers (import) | ~ 20 ko (serveur only) | Évite chargement complet en mémoire |
| (déjà présent) `@tanstack/react-query` | State serveur côté drawer | 0 (déjà chargé) | Caching + pagination |
| (déjà présent) `framer-motion` | Animations drawer/wizard | 0 (déjà chargé) | Bibliothèque motion |
| (déjà présent) `@radix-ui/react-dialog` | Drawer + lightbox + modales bulk | 0 (déjà chargé) | A11y intégrée |
| (déjà présent) `sharp` | Pipeline image serveur | 0 | Variants thumbnail + import |

Total ajout client : < 5 ko si Radix et Framer Motion déjà bundlés. Le wizard d'import est admin-only — son JS supplémentaire est chargé en dynamic import depuis `/admin/rituals/import`.

## 13. Module d'import (vue d'ensemble)

Le système d'import est documenté en détail dans `↗ 13-import-system-architecture.md`. Il s'ajoute à l'architecture existante de la façon suivante :

```
┌────────────────────────────────────────────────────────────────────┐
│  PRESENTATION (admin only)                                          │
│  /admin/rituals/import                                               │
│  ─ ImportWizard (6 étapes : Source / Upload / Mapping / Preview /   │
│                            Commit / Rapport)                         │
│  /admin/rituals/import/history                                       │
│  ─ Liste des batches passés                                          │
│  /admin/rituals/import/help                                          │
│  ─ Documentation des formats, valeurs, structure ZIP                 │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  HTTP API (admin only, require-admin)                                │
│  ─ GET    /api/admin/rituals/import/template                         │
│  ─ POST   /api/admin/rituals/import/upload                           │
│  ─ GET    /api/admin/rituals/import/[batchId]                        │
│  ─ PATCH  /api/admin/rituals/import/[batchId]/{mapping,rows/[id]}    │
│  ─ POST   /api/admin/rituals/import/[batchId]/bulk-rows              │
│  ─ POST   /api/admin/rituals/import/[batchId]/commit                 │
│  ─ POST   /api/admin/rituals/import/[batchId]/rollback               │
│  ─ DELETE /api/admin/rituals/import/[batchId]                        │
│  ─ POST   /api/cron/rituals-import-cleanup                           │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  Services (lib/rituals/import/)                                     │
│  ─ parser/ (csv, json, jsonl, zip)                                   │
│  ─ mapper.ts (mapping colonnes + défauts + auto-detect)              │
│  ─ row-validator.ts (Zod + business + sanitization)                  │
│  ─ duplicate-detector.ts (row_hash intra/inter)                      │
│  ─ media-extractor.ts (ZIP → temp_media + enqueue vision ML)         │
│  ─ batch-committer.ts (transaction Postgres)                         │
│  ─ batch-rollback.ts                                                 │
│  ─ template-generator.ts (CSV/JSON/ZIP sample)                       │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  DATA — nouvelles tables                                            │
│  ─ ritual_import_batches (un batch = un upload)                     │
│  ─ ritual_import_rows (une row par ligne du fichier)                 │
│  ─ ritual_import_temp_media (médias temporaires, purgés après commit)│
│                                                                      │
│  ─ ritual_testimonials.import_batch_id / .import_row_id (nouveaux)  │
│  ─ ritual_source enum étendu : import_csv, import_json, import_zip │
└────────────────────────────────────────────────────────────────────┘
```

Total : ~9 j de charge supplémentaire (cf. `13-import-system-architecture.md § 13`).

## 14. Module bulk (vue d'ensemble)

Le système bulk est documenté en détail dans `↗ 16-bulk-management.md`. Il s'applique à 4 surfaces admin :

- `/admin/rituals/queue` (PENDING) → approuver / rejeter / masquer.
- `/admin/rituals/published` (APPROVED) → featured / unfeatured / masquer.
- `/admin/rituals/archived` (HIDDEN / REJECTED) → restaurer / supprimer (RGPD).
- `/admin/rituals/import/[batchId]` (preview) → inclure / exclure / appliquer défaut / régénérer ML / supprimer rows.

Composants réutilisables :

```
components/admin/bulk/
├── BulkActionBar.tsx           (barre sticky)
├── BulkActionModal.tsx          (modale confirmation)
├── BulkActionDestructiveModal.tsx (tapage explicite)
├── BulkSelectionCheckbox.tsx    (row + header)
└── BulkSelectionContext.tsx     (Provider + hook)
```

Endpoint backend unique : `POST /api/admin/rituals/bulk-action` qui orchestre via `lib/rituals/bulk.ts` avec transaction par chunks de 50, audit log par ritual + audit global, RBAC matrix étendu.

Total : ~1 j de charge supplémentaire (cf. `16-bulk-management.md`).

## 13. Synthèse — règles d'architecture

1. **Une seule source de vérité par donnée** : la BDD pour les témoignages, le state local + URL pour l'UI.
2. **Les routes API ne contiennent pas de logique métier** : elles parsent, valident, délèguent.
3. **Les services métier ne touchent pas directement la BDD** : ils passent par `lib/db/queries/`.
4. **Les composants `Bound` sont les seuls à fetch** : les composants purs reçoivent leurs props.
5. **Tout est testable indépendamment** : chaque couche a ses tests propres.
6. **Le cache HTTP existe pour réduire la charge BDD** ; le cache React Query existe pour réduire la latence perçue.
7. **Aucune feature n'est en dépendance dure d'un fournisseur cloud spécifique** : Vision ML, Blob storage, Email sont des interfaces.
8. **L'évolutivité est prévue par schéma**, pas par mécanisme « options » fragile.
