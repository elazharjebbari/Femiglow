# Images hero par audience — architecture technique (site + admin)

Date : 30/10/2026 · Branche de référence : `feat/kit-cro-v2` (prod) · App : `apps/web` (Next 14.2.15, Drizzle, Postgres).
Chemins relatifs à `apps/web/src` sauf mention contraire. Rien n'est encore implémenté : ce document est le plan.

## 1. Objectif

Afficher, pour un composant donné (d'abord `kit-hero-produit`), des images **primaires et secondaires** qui varient selon :

- une **dimension d'audience** (d'abord l'angle publicitaire issu de `utm_content` : `a`…`e`, `temoin`) ;
- la **langue** (`fr`, `ar`, `en`).

L'ensemble doit être :
- éditable depuis l'admin, avec brouillon, publication, programmation, historique et restauration ;
- performant pour le LCP ;
- mesurable, avec un paramètre de tracking ;
- **générique**, pour que n'importe quel autre composant (pack, vidéo, bandeau…) ou une autre dimension (bras A/B, ville…) puisse l'utiliser ensuite.

## 2. Ce qui existe aujourd'hui (constat)

| Sujet | Où | Limite |
|---|---|---|
| Angle | `lib/kit/angle.ts`, `resolveKitAngle` (`?angle=` > `utm_content` > cookie `fg_angle`) ; propagé dans `KitPageLayoutProps.kitAngle` → `HeroProduitBound` → `HeroProduit` | OK, à réutiliser tel quel |
| Textes par angle | Composant CMS `kit-hero-angles`, lus en **un seul appel caché**, angle choisi en mémoire (`lib/kit/hero-angle-copy.ts`) | Bon modèle à reproduire pour les médias |
| Galerie | `lib/products/kit-hero-gallery.ts`, `getKitHeroGalleryImages()` : slot `primary`, puis `context_1` et `context_2`, puis avis clients, 7 au maximum | Pas de langue, pas de variante ; `blurDataURL` en TODO |
| Liaisons média | Table `component_media_bindings`, **unique par (composant, slot)**, `isActive` à effet immédiat | Ni variante, ni langue, ni brouillon, ni historique ; alt en une seule langue |
| Résolveur | `lib/components/resolver.ts`, `unstable_cache` par (composant, slot), environ 3 requêtes par slot | — |
| Affichage | `HeroGallery.tsx` (arbres mobile et desktop), `next/image` en `fill`, ratio 4/5, `priority` sur l'index 0 | Pas d'art direction 3:4 mobile ; double encodage `/_media` → `/_next/image` |
| Admin | `/admin/components/[key]` (`SlotCard`, `MediaPickerDrawer`, `LocaleEditorShell`), médiathèque `/admin/media` | Pas d'édition de médias par variante |
| Import | `seedFromDocs()` dans `lib/components/seed-pipeline.ts` avec une correspondance codée en dur (`seed-mapping.ts`) | Pas de convention de dossiers par variante |
| Tracking | `kit_angle` sur `view_item`, `add_to_cart`, `kit_checkout_exposure` | On ne sait pas **quelle image** a été vue |

## 3. Options comparées

| Option | Principe | Robustesse | UX admin | Perf | Risque migration | Généricité |
|---|---|---|---|---|---|---|
| A | Nouveau type de champ `media` / `mediaList` dans `component_field_bindings` (`<angle>_heroPrimary`…) | Moyenne : JSON opaque, pas de FK vers `media`, encodage des listes déjà fragile | Correcte | Correcte | Faible | Faible : convention de noms de clés |
| **B** | **Tables dédiées `component_media_sets`, `component_media_set_items` et `component_media_set_history`, statuts calqués sur les champs** | **Élevée** : FK, index uniques partiels, publication d'un ensemble entier | **Élevée** | **Élevée** : 1 requête cachée par composant | **Faible** : tables additives | **Élevée** |
| C | Ajouter `locale`, `variant_dim` et `variant_key` à `component_media_bindings` | Moyenne | Moyenne | Moyenne | **Élevée** : casse un index unique d'une table très utilisée | Moyenne |
| D | Un champ JSON de configuration dans le CMS | Faible | Faible | Correcte | Faible | Moyenne |
| E | Convention de dossiers seule, images dans `public/` | Faible | Nulle : un déploiement par image | Correcte | Nul | Faible |

**Choix : option B.** La convention de dossiers de l'option E est conservée **uniquement comme format d'import** des images générées. `component_media_bindings` n'est pas modifiée et devient un niveau de repli : aucune régression possible.

## 4. Conception cible

### 4.1 Données (Drizzle, migration additive)

```ts
// lib/db/schema.ts — section « COMPONENT MEDIA VARIANTS »
export const componentMediaSets = pgTable('component_media_sets', {
  id: text('id').primaryKey(),
  componentId: text('component_id').notNull().references(() => siteComponents.id, { onDelete: 'cascade' }),
  slot: text('slot').notNull(),                                   // 'primary' | 'secondary' | …
  variantDim: text('variant_dim').notNull().default('default'),   // 'default' | 'angle' | 'ab:<expKey>'
  variantKey: text('variant_key').notNull().default('*'),         // 'e' | 'temoin' | '*'
  locale: text('locale').notNull().default('*'),                  // 'fr' | 'ar' | 'en' | '*'
  crossLocale: boolean('cross_locale').notNull().default(false),  // images sans texte → réutilisables hors langue
  status: fieldBindingStatusEnum('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  source: text('source').notNull().default('admin'),              // 'admin' | 'import'
  notes: text('notes'),
  authorId: text('author_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  publishedUnique: uniqueIndex('cms_set_publish_uniq').on(t.componentId, t.slot, t.variantDim, t.variantKey, t.locale).where(sql`${t.status} = 'published'`),
  draftUnique: uniqueIndex('cms_set_draft_uniq').on(t.componentId, t.slot, t.variantDim, t.variantKey, t.locale).where(sql`${t.status} = 'draft'`),
  lookupIdx: index('cms_set_lookup').on(t.componentId, t.status),
  scheduledIdx: index('cms_set_scheduled').on(t.status, t.scheduledAt).where(sql`${t.status} = 'scheduled'`),
}));

export const componentMediaSetItems = pgTable('component_media_set_items', {
  id: text('id').primaryKey(),
  setId: text('set_id').notNull().references(() => componentMediaSets.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  mediaId: text('media_id').notNull().references(() => media.id, { onDelete: 'restrict' }),
  mobileMediaId: text('mobile_media_id').references(() => media.id, { onDelete: 'restrict' }), // art direction 3:4
  alt: jsonb('alt').notNull().default({}),                        // { fr?, ar?, en? }
  objectPosition: mediaObjectPositionEnum('object_position'),
  focalX: integer('focal_x'),
  focalY: integer('focal_y'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  setPosUnique: uniqueIndex('cms_item_set_pos_uniq').on(t.setId, t.position),
  mediaIdx: index('cms_item_media_idx').on(t.mediaId),
}));

export const componentMediaSetHistory = pgTable('component_media_set_history', {
  id: text('id').primaryKey(),
  setId: text('set_id').notNull().references(() => componentMediaSets.id, { onDelete: 'cascade' }),
  componentId: text('component_id').notNull(),
  slot: text('slot').notNull(),
  variantDim: text('variant_dim').notNull(),
  variantKey: text('variant_key').notNull(),
  locale: text('locale').notNull(),
  version: integer('version').notNull(),
  items: jsonb('items').notNull(),                                // instantané de la liste
  crossLocale: boolean('cross_locale').notNull(),
  status: fieldBindingStatusEnum('status').notNull(),
  action: fieldHistoryActionEnum('action').notNull(),
  actorId: text('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
// + media.blurDataUrl: text('blur_data_url'), qui ferme le TODO blur pour tout le site
```

**Choix de conception :**
- La sentinelle `'*'` remplace `NULL`, ce qui garde les index uniques simples.
- `ON DELETE RESTRICT` sur `media` empêche de supprimer définitivement une image publiée.
- On publie **un ensemble entier** : on ne mélange jamais deux listes.

Migration `drizzle/migrations/00xx_component_media_sets.sql`, via `_migrate-safe` : 3 `CREATE TABLE`, les index, et `ALTER TABLE media ADD COLUMN blur_data_url text`. Aucune table existante n'est modifiée destructivement.

### 4.2 Déclaration générique dans le registre

```ts
// lib/components/registry.ts
export interface MediaVariantSlotPolicy {
  key: string;                       // 'primary' | 'secondary'
  kind: 'single' | 'list';
  maxItems?: number;                 // secondary : 6
  aspect: { mobile: '3/4'; desktop: '4/5' } | { all: string };
  legacySlots?: string[];            // repli : ['primary'] / ['context_1','context_2']
}
export interface MediaVariantPolicy {
  slots: MediaVariantSlotPolicy[];
  dimensions: string[];              // ordre de priorité, ex. ['ab:hero-media-2026-11', 'angle']
}
// SiteComponentSeed.mediaVariants?: MediaVariantPolicy  → synchronisé dans site_components.metadata.mediaVariants
```

Pour `kit-hero-produit` : slots `primary` (single) et `secondary` (list, 6 au maximum), dimensions `['angle']`, et un nouveau champ booléen `mediaVariantsEnabled` qui sert de coupe-circuit sans déploiement.
Les dimensions sont déclarées dans `lib/components/media-variants/dimensions.ts` (`angle` → `KIT_ANGLES` ; `ab:<key>` → `experiment_variants`).

**Pour un autre composant demain**, il suffit d'ajouter `mediaVariants` dans son entrée du registre. Le résolveur, l'admin, l'import et le tracking sont partagés.

### 4.3 Chaîne de repli (slot par slot, ensemble entier)

1. variante + langue exacte
2. variante, toutes langues (`*`)
3. variante en `fr`, seulement si l'ensemble est `crossLocale` (images sans texte)
4. défaut + langue
5. défaut `*`
6. défaut `fr` (`crossLocale`)
7. liaisons existantes (`component_media_bindings` : `primary`, `context_1/2`)
8. `productFallback` (`product.images[0]`)

### 4.4 Résolveur serveur

`lib/components/media-variants/`

| Fichier | Rôle |
|---|---|
| `types.ts` | `AudienceContext { locale; variants: Record<dim, key|null> }`, `ResolvedMediaImage { src, width, height, blurDataURL, alt, mobile? }`, `MediaSlotTrace`, `FallbackLevel` |
| `sets.server.ts` | `getPublishedMediaSets(componentKey)` : **une seule requête**, mise en cache avec `unstable_cache` (tags `components` et `components:media-sets:<key>`, revalidate 1800). `getDraftMediaSets()` sans cache, pour l'aperçu |
| `select.ts` | `selectMediaSet(sets, slot, ctx, policy)` : fonction **pure**, qui implémente la chaîne §4.3 |
| `resolve.server.ts` | `resolveComponentMediaSlots(componentKey, ctx, { draft? })` et `mediaVariantTrackingValue(traces)` (ex. `angle-e.ar.v3`, `default.fr.v1`, `legacy`, `product`) |
| `lib/media/pick-variant.ts` | Extraction de `pickHeroVariantUrl`, partagée |

Pour le kit, `getKitHeroGallery({ locale, angle })` renvoie `{ images, trace }`. L'actuelle `getKitHeroGalleryImages()` reste en place comme enveloppe de compatibilité.

**Pas de fragmentation du cache :** une seule entrée par composant (environ 60 ensembles au maximum pour le kit). La variante est choisie en mémoire, sur le modèle de `resolveKitHeroAngleCopy`.

### 4.5 Affichage et LCP

- **Nouveau composant `components/sections/hero/HeroPicture.tsx`** : `getImageProps` de `next/image` produit `<picture><source media="(max-width:1023px)" …mobile 3:4/><img …desktop 4:5/></picture>`.
- **Ratio** : en CSS, `aspect-[3/4] lg:aspect-[4/5]`. CLS = 0.
- **Priorité** : seule l'image d'index 0 reçoit `fetchPriority="high"`, plus un `ReactDOM.preload` explicite émis par `HeroProduitBound` pour la source mobile. Les autres images sont en `loading="lazy"`.
- **Flou de chargement** : `blur_data_url` est calculé dans `lib/media/pipeline/optimize-image.ts`. Le script `scripts/backfill-media-blur.ts` traite les médias existants.
- **Sélection côté serveur** : l'image est choisie **côté serveur, dans le HTML initial**, jamais échangée en JS (pas de flash, pas de LCP retardé).
- **Phase 2, facultative** : un loader `/_media` sans ré-encodage par `/_next/image`.

### 4.6 Pages et tracking

- **Pages** : `app/[locale]/kit/page.tsx` et `app/(marketing)/kit/page.tsx` résolvent la galerie **une seule fois**, via un utilitaire commun `lib/kit/page-context.server.ts` (angle, galerie, paramètres de tracking). Elles passent `heroGallery` aux layouts, puis à `HeroProduitBound`.
- **Nouveaux paramètres** :
  - `hero_media_variant` et `hero_media_level` sont envoyés avec `view_item` (côté serveur et client), `add_to_cart`, `pack_cta_click` et `kit_checkout_exposure`.
  - La section porte `data-hero-media-variant`.
  - Le schéma strict de `kit_checkout_exposure` doit être étendu en conséquence.
- **Analyse** : croiser `kit_angle × hero_media_variant`. Le texte et l'image sont deux variables distinctes.
- **A/B plus tard** : dimension `ab:<expKey>` avant `angle`, bras via `assignVariant` (`fg_aid`). Ajouter un événement first-party `component_media_exposure` pour avoir un dénominateur.

### 4.7 Admin

**Onglet « Médias par audience »** dans `/admin/components/[key]` (affiché si `metadata.mediaVariants` existe). Il présente une **matrice** :
- lignes : `défaut`, `a`…`e`, `témoin` ;
- colonnes : `*`, `fr`, `ar`, `en` ;
- sous-lignes : `primary` et `secondary`.

Chaque cellule montre :
- la vignette ;
- le nombre d'images secondaires (« +n secondaires ») ;
- son statut (publié vN, brouillon, programmé) ;
- « hérite de… », calculé par le même `selectMediaSet`.

Un compteur signale les combinaisons qui tombent sur un repli.

**Tiroir d'édition d'une cellule :**
- choix dans la médiathèque ou upload (`MediaPickerDrawer` réutilisé) ;
- liste triable, plafonnée à `maxItems` ;
- par image : média mobile 3:4, alt FR/AR/EN et point focal ;
- case « sans texte, réutilisable dans les autres langues » ;
- boutons Brouillon / Publier / Programmer / Historique / Restaurer / « Copier vers… » ;
- gestion des conflits (`If-Match`).

**Aperçu** dans une iframe `/{locale}/kit?angle=<k>&hmv_preview=draft`, honoré uniquement avec une session admin, et sans `serverFire`.

**Raccourci** depuis `/admin/kit` ; les usages des images apparaissent dans la médiathèque.

**Routes** (`app/api/admin/components/[key]/media-sets/…`, avec `requireAdminApi`, audit et `revalidateTag`) :

| Route | Rôle |
|---|---|
| `GET /` | Liste |
| `PUT /draft` | Enregistrer le brouillon (zod : slot, dimension, langue, `maxItems`, médias valides) |
| `POST /[setId]/publish` · `schedule` · `cancel-schedule` · `unpublish` | Cycle de vie |
| `GET /history` · `POST /restore` | Historique et restauration |
| `POST /bulk-publish` | Publication en masse, avec `dryRun` |
| `GET /resolve?angle=&locale=&draft=1` | Diagnostic du niveau de repli atteint |

**Cron** : le cron existant `promote-scheduled-fields` appelle aussi `promoteDueMediaSets`.

### 4.8 Import des images générées (lien avec le dossier de prompts)

Script `scripts/import-component-media.ts` :

```
pnpm import:component-media -- --root <dir> [--component kit-hero-produit] [--dry-run] [--publish] [--force] [--report out.json]
```

**Convention de dossiers**, la même que celle de `generated/` dans le README de génération :

```
<root>/<componentKey>/<slot>/<variant>/<locale>/<nn>-<slug>[.mobile].(png|jpg|webp)
<root>/<componentKey>/<slot>/<variant>/<locale>/<nn>-<slug>.alt.json   → {"fr": "…", "ar": "…", "en": "…"}
```

**Valeurs possibles :**
- `variant` : `default`, `angle-a`…`angle-e`, `angle-temoin`, `ab-<expKey>-<arm>`.
- `locale` : `fr`, `ar`, `en`, ou `_all`, qui donne `*` avec `crossLocale = true`.
- `nn` : la position (`01` = première image ; un seul fichier pour `primary`).
- `.mobile` : la version 3:4 associée au fichier de même `nn` et même slug.

**Étapes :**
1. Valider chaque chemin contre le registre ; un chemin inconnu est signalé.
2. Calculer un sha256 et un slug déterministe, pour un import idempotent.
3. Ingérer via `lib/media/ingest.ts`, extrait de `seedFromDocs` : variantes avif/webp/jpeg, blur, statut `ready`.
4. Créer les ensembles **en brouillon** (`source = 'import'`), jamais publiés sauf avec `--publish`.

Les images générées ne sont pas commitées : elles sont copiées sur le serveur, puis importées.

### 4.9 Drapeaux et retour arrière

| Niveau | Mécanisme | Effet |
|---|---|---|
| Environnement | `HERO_MEDIA_VARIANTS=off\|on`, `off` au premier déploiement | Coupe tout, nécessite un redémarrage |
| CMS | Champ booléen `kit-hero-produit.mediaVariantsEnabled` | Coupe-circuit immédiat, sans déploiement |
| Recette | `?hmv=off` | Désactive pour une URL |
| Cellule | Dépublier un ensemble | Retombe au niveau de repli suivant |

## 5. Tests

| Niveau | Contenu |
|---|---|
| Unitaires | `select.test.ts` : table complète des 8 niveaux, `crossLocale`, priorité A/B, média supprimé → niveau suivant, jamais de mélange de listes. Aussi : `toResolvedImages` (alt par langue, art direction), `mediaVariantTrackingValue`, parseur de chemins de l'import, schémas zod |
| Requêtes | Publication atomique, index uniques partiels, conflit `If-Match`, programmation puis promotion, restauration, `RESTRICT` sur la suppression d'un média (mémoire et Postgres en CI) |
| Routes | Authentification, validation, audit, `revalidateTag` (modèle : `app/api/admin/kit/video/publish/route.test.ts`) |
| Composants | `HeroPicture` (`<picture>`, une seule priorité), `HeroGallery`, `ViewItemTracker`, `CommanderAnchorButton` (paramètre envoyé), `HeroProduitBound` drapeau coupé = sortie identique à l'actuelle |
| E2E | `?angle=e` en fr et ar (`src` et `data-hero-media-variant` attendus), cookie `fg_angle`, angle sans ensemble → défaut, `?hmv=off`, aperçu brouillon refusé sans session, import → publication → page modifiée |
| Visuel et perf | Captures 375 et 1280 px par angle et langue ; Lighthouse CI avec un LCP au plus égal à l'actuel et CLS = 0 ; RUM `web_vitals` par `hero_media_variant` |

## 6. Plan de livraison (PR successives)

| PR | Contenu | Fichiers principaux |
|---|---|---|
| 1 | Données et requêtes | `lib/db/schema.ts`, migration, `lib/db/types.ts`, `lib/db/client.ts` (memoryStore), `lib/db/queries/component-media-sets.ts` (+ tests) |
| 2 | Résolveur et registre | `lib/components/media-variants/*`, `lib/media/pick-variant.ts`, `registry.ts` (politique + `mediaVariantsEnabled`), `seed-pipeline.ts` (sync des métadonnées), `lib/feature-flags/hero-media-variants.ts` |
| 3 | Pipeline média et import | `lib/media/ingest.ts`, `optimize-image.ts` (blur), `scripts/backfill-media-blur.ts`, `scripts/import-component-media.ts`, `package.json` |
| 4 | Affichage et tracking | `kit-hero-gallery.ts`, `hero-gallery-types.ts`, `HeroPicture.tsx`, `HeroGallery*.tsx`, `HeroProduitBound.tsx`, `HeroProduit.tsx`, layouts kit, `lib/kit/page-context.server.ts`, pages kit, `lib/kit/hero-media.ts`, `ViewItemTracker`, `CommanderAnchorButton`, `KitCommanderSection`, `kit-checkout-exposure.ts`, `tracking/schemas.ts` |
| 5 | API admin et cron | `app/api/admin/components/[key]/media-sets/**`, `lib/schemas/admin/media-sets.ts`, crons, `revalidateTag` sur les routes média |
| 6 | Interface admin | `components/admin/components/media-variants/{MediaVariantsMatrix,MediaSetEditorDrawer,SortableMediaList,CoverageBadge}.tsx`, page `/admin/components/[key]`, lien `/admin/kit`, `lib/media/usage.ts` |
| 7 | E2E, perf, docs | `e2e/kit-hero-angle.spec.ts`, captures, budget Lighthouse, `docs/component-media-system/02-data-model.md` |
| 8 (facultative) | A/B images, loader `/_media`, import ZIP depuis l'admin | — |

## 7. Runbook de mise en production

1. Déployer les PR 1 à 5 avec `HERO_MEDIA_VARIANTS=off`, puis `_migrate-safe --plan` et `_migrate-safe` (tables additives).
2. Synchroniser le registre (`syncComponentRegistry`), puis lancer `scripts/backfill-media-blur.ts`.
3. Copier `generated/` sur le serveur et lancer `import:component-media --dry-run`. Relire le rapport, puis relancer sans `--dry-run` : les ensembles sont créés **en brouillon**.
4. Dans l'admin : relire la matrice et les alt FR/AR/EN, vérifier l'aperçu par angle et langue, puis publier.
5. Passer `HERO_MEDIA_VARIANTS=on` et redémarrer (ou mettre le champ CMS à `true`).
6. Vérifier :
   - `curl /fr/kit?angle=e` et `/ar/kit?utm_content=A-darija` renvoient le `data-hero-media-variant` attendu ;
   - `GET …/media-sets/resolve` indique le bon niveau ;
   - `tracking_events_log` contient `view_item` avec `hero_media_variant` ;
   - Lighthouse mobile reste dans le budget.
7. Retour arrière : champ CMS `mediaVariantsEnabled=false` (immédiat), puis la variable d'environnement, puis la dépublication d'une cellule.

## 8. Risques et parades

| Risque | Parade |
|---|---|
| Image avec texte FR affichée en AR | `crossLocale` vaut `false` par défaut ; seul `_all` le passe à `true` ; un alt manquant est signalé |
| Régression du LCP | Preload explicite, budget Lighthouse, drapeau |
| Écart entre le tracking serveur et client | Galerie résolue une seule fois dans la page |
| Média supprimé alors qu'il est publié | `RESTRICT`, filtre `deletedAt`, repli au niveau suivant |
| Volume de stockage | Utiliser `_all` dès que l'image est sans texte |
| Deux pages kit à maintenir | Utilitaire commun `page-context.server.ts` |
| Cache périmé après modification d'un média | `revalidateTag('components')` sur les routes média |
