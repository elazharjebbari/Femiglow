# Rapport — images manquantes sur `/journal`, `/maison` et le menu

> Inventaire après audit visuel des trois zones où des fallbacks SVG sont
> visibles à la place des photos éditoriales. Pour chaque image manquante :
> origine du fallback, statut de la source, et catégorie de traitement.
>
> **Deux catégories** :
> - **(A) Déjà gérable avec le contenu existant** — l'asset PNG est déjà dans
>   `docs/images/values/`, il suffit d'un wiring/binding pour qu'il s'affiche.
> - **(B) À générer par prompt IA** — aucun PNG n'existe pour ce slot ; il faut
>   produire l'image (prompts ci-dessous, dans ce même dossier).

---

## 1. Page `/journal`

### 1.1 — `journal-hero` (titre + chapeau)
- **Statut** : composant `JournalHero` est purement typographique, pas d'image.
- **Verdict** : **rien à corriger** côté image — comportement normal.

### 1.2 — `FeaturedArticleBound` (« à la une »)
- **Fallback observé** : SVG du featured (ex. `/journal/cinq-minutes-le-soir.svg`).
- **Pourquoi** : aucun binding `componentKey: 'journal-featured'` n'existe dans
  `seed-mapping.ts`. Le Bound se rabat sur `article.featuredImage.src` qui
  pointe sur `.svg`.
- **Statut source** : le PNG existe déjà
  (`docs/images/values/journal/cinq-minutes-le-soir.png` et 14 autres).
- **Catégorie : (A) — gérable avec contenu existant.**
- **Action** : ajouter une entrée seed-mapping qui réutilise l'image du
  featured courant pour le slot `journal-featured/primary`, **ou** modifier
  `FeaturedArticleBound` pour résoudre via `journal-article-{slug}/cover`
  (binding qui existe déjà pour les 15 articles).

### 1.3 — Cards article dans `ArticleGrid`
- **Fallback observé** : SVG `featuredImage.src` sur les 12 cards.
- **Pourquoi** : `ArticleGrid` est `'use client'`, ne peut donc pas appeler
  `ArticleCardBound` (RSC). Toutes les cards rendent le SVG par défaut.
- **Statut source** : les 15 PNG existent dans
  `docs/images/values/journal/`. Tous les bindings
  `journal-article-<slug>/cover` sont seedés et actifs.
- **Catégorie : (A) — gérable avec contenu existant.**
- **Action** : remonter d'un cran le rendu des cards initiales en RSC
  (rendre `grid` côté serveur via `ArticleCardBound`, ne laisser au client
  que les pages de pagination), ou résoudre les images au niveau
  `JournalPage` puis les passer à `ArticleGrid` via une prop sérialisable.

### 1.4 — `CrossLinkBanner` (bas de `/journal`)
- **Fallback observé** : `/journal/crosslink-maison.svg`.
- **Pourquoi** : aucun PNG dans `docs/images/values/`, aucun mapping seed.
- **Catégorie : (B) — à générer.**
- **Prompt** : voir `crosslink-maison.txt` dans ce dossier.

---

## 2. Page `/maison`

### 2.1 — `HeroMaisonBound`
- **Statut** : binding `maison-hero/primary` existe et est actif.
- **Verdict** : **OK** (sous réserve que la base soit seedée + cache
  invalidé — voir tâche d'opération).

### 2.2 — `SectionNarrative` (origine, image-droite)
- **Fallback observé** : `/maison/origine.svg`.
- **Pourquoi** : aucun PNG dans `docs/images/values/maison/`, aucun mapping
  seed. Cette section n'utilise pas le pattern `*Bound` (elle reçoit
  directement `content.origine.image` du CMS, qui pointe sur `.svg`).
- **Catégorie : (B) — à générer.**
- **Prompt** : voir `maison-origine.txt`.

### 2.3 — `SectionNarrativeBound` (fondatrice)
- **Statut** : binding `maison-fondatrice-mains/avatar` existe et est actif.
- **Verdict** : **OK**.

### 2.4 — `AtelierGalleryBound` (3 photos)
- **Statut** : `maison-atelier-gallery/atelier-{1,2,3}` existent et sont
  actifs.
- **Verdict** : **OK**.

### 2.5 — `MatieresGrid`
- **Statut** : utilise `MatiereIcon` (composant SVG inline), aucune photo
  attendue.
- **Verdict** : **rien à corriger** — comportement normal.

### 2.6 — `EngagementsGrid`
- **Statut** : `EngagementCard` est texte uniquement (titre + description).
- **Verdict** : **rien à corriger** — comportement normal.

### 2.7 — `CrossLinkTriptyque` (bas de `/maison`)
- **Fallback observé** : `/maison/cross-rituel.svg`,
  `/maison/cross-journal.svg`, `/maison/cross-kit.svg`.
- **Pourquoi** : aucun PNG dans `docs/images/values/maison/`, aucun mapping
  seed.
- **Catégorie : (B) — à générer.** *(3 images)*
- **Prompts** : voir `cross-rituel.txt`, `cross-journal.txt`, `cross-kit.txt`.

---

## 3. Menu / `SommaireOverlay`

Le menu déroulant affiche **5 vignettes 88×88** (une par lien).
Source : `apps/web/src/lib/menu-descriptions.ts`.

### 3.1 — Vignette « Le rituel » → `/maison/cross-rituel.svg`
### 3.2 — Vignette « Le kit » → `/maison/cross-kit.svg`
### 3.3 — Vignette « Le journal » → `/maison/cross-journal.svg`
- **Catégorie : (B) — à générer** (mêmes images que le triptyque maison §2.7).
- **Mutualisation** : on génère **une seule** image par cross-link et on la
  réutilise à la fois dans `CrossLinkTriptyque` ET dans le menu (le crop
  88×88 du menu est tiré du même fichier).

### 3.4 — Vignette « La maison » → `/maison/atelier-1.svg`
### 3.5 — Vignette « Contact » → `/maison/atelier-3.svg`
- **Catégorie : (A) — gérable avec contenu existant.**
- **Pourquoi** : les PNG `atelier-1.png` et `atelier-3.png` existent déjà
  dans `docs/images/values/maison/` et sont seedés.
- **Action** : remplacer dans `menu-descriptions.ts` les chemins SVG par
  les PNG (`/maison/atelier-1.png` et `/maison/atelier-3.png`) **ou** —
  plus propre — passer par `ComponentMedia` avec
  `maison-atelier-gallery/atelier-1` et `…/atelier-3`. Aucune génération.

---

## 4. Synthèse

| # | Image manquante | Page(s) | Catégorie | Action |
|---|---|---|---|---|
| 1 | `journal-featured` cover | `/journal` | **(A)** | Wiring : binding ou ré-utilisation `journal-article-<slug>/cover`. |
| 2 | Cards article (×12) | `/journal` | **(A)** | Wiring : SSR des cards initiales (`ArticleCardBound`). |
| 3 | `crosslink-maison` | `/journal` | **(B)** | Générer (1 image, 3:2). |
| 4 | `maison/origine` | `/maison` | **(B)** | Générer (1 image, 4:5). |
| 5 | `maison/cross-rituel` | `/maison` + menu | **(B)** | Générer (1 image, 4:5, partagée). |
| 6 | `maison/cross-kit` | `/maison` + menu | **(B)** | Générer (1 image, 4:5, partagée). |
| 7 | `maison/cross-journal` | `/maison` + menu | **(B)** | Générer (1 image, 4:5, partagée). |
| 8 | Menu vignettes maison/contact | menu | **(A)** | Wiring : pointer sur PNG `atelier-1`/`atelier-3` existants. |

**Récapitulatif** :
- **3 actions de wiring** (catégorie A, aucune génération nécessaire).
- **5 prompts à exécuter** (catégorie B). Tous ont leur fichier `.txt` dans
  ce dossier.

## 5. Ordre d'exécution recommandé

1. **Wiring A** (rapide, sans génération) :
   - menu vignettes → PNG existants ;
   - `journal-featured` → réutiliser cover de l'article featured ;
   - `ArticleGrid` → SSR des cards initiales.
2. **Génération B** dans **une seule session ChatGPT** pour la cohérence du
   shooting (cf. `02-guide-prompting.md` §5) :
   - 1ʳᵉ image-pilote : `cross-rituel.txt` (la plus identitaire).
   - Puis les autres avec consigne *« style, palette, grain and lighting
     consistent with the previous image »*.
3. **Intégration** : copier les PNG dans `docs/images/values/maison/` et
   `docs/images/values/journal/` ; ajouter à `seed-mapping.ts` ; relancer
   `POST /api/admin/components/seed-from-docs` puis
   `POST /api/admin/components/sync-registry` pour invalider le cache.

---

*Liste des fichiers de prompt dans ce dossier :*
- `crosslink-maison.txt` — image pour `/journal` cross-link banner.
- `maison-origine.txt` — image pour la section narrative *L'origine*.
- `cross-rituel.txt` — image partagée triptyque maison + menu (rituel).
- `cross-kit.txt` — image partagée triptyque maison + menu (kit).
- `cross-journal.txt` — image partagée triptyque maison + menu (journal).
