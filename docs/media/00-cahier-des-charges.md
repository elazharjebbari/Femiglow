# 00 — Cahier des charges

## Objectif

Doter FemiGlow d'un système de gestion des médias **robuste, complet,
fiable**, capable de gérer images, vidéos et audio, avec optimisation
automatique multi-format, multi-breakpoint, multi-qualité, et un
lazy-loading intelligent piloté par contexte.

Le système doit servir trois cas d'usage principaux :

1. **Marketing & éditorial** : la fondatrice ajoute une photo produit,
   une vidéo manifeste, une voix off pour le journal — le système
   produit automatiquement toutes les variantes nécessaires.
2. **Performance** : chaque page sert le **bon format**, à la **bonne
   taille**, en **bonne qualité** pour le device de la cliente, avec
   un Largest Contentful Paint (LCP) ≤ 2.0 s sur 4G mobile.
3. **Résilience** : si un média n'est pas chargé (latence, bug,
   adblock agressif), la **structure de la page reste intacte** grâce
   aux SVG placeholders.

## Exigences fonctionnelles

### F1 — Types de médias supportés

| Type | Formats sources acceptés | Formats produits |
|---|---|---|
| Image | JPEG, PNG, WebP, AVIF, HEIC, TIFF | AVIF (priorité), WebP, JPEG, PNG (fallback transparence) |
| Vidéo | MP4, MOV, MKV, WebM | MP4 (H.264 + AAC), WebM (VP9 + Opus), poster JPEG/AVIF |
| Audio | MP3, WAV, FLAC, AAC, OGG | MP3 (128/192 kbps), Opus (96 kbps), poster forme d'onde SVG |

Sources permises :

- **Upload local** : fichier déposé dans la console admin → stocké
  dans Vercel Blob (prod) ou filesystem `/public/_media/` (dev).
- **URL distante** : ressource externe référencée par URL (ex. CDN
  partenaire). Deux modes :
  - **proxied** : on télécharge, on optimise, on re-héberge,
  - **passthrough** : on garde l'URL brute mais on note les métadonnées
    (utile pour vidéos YouTube/Vimeo embarquées).

### F2 — Versions responsive (breakpoints)

Breakpoints standards FemiGlow (alignés avec Tailwind config existante) :

| Nom | Largeur min | Cas d'usage |
|---|---|---|
| `xs` | 0 | Téléphone portrait étroit (≤ 360 px) |
| `sm` | 480 | Téléphone moderne |
| `md` | 768 | Tablette portrait |
| `lg` | 1024 | Tablette paysage / petit laptop |
| `xl` | 1280 | Desktop standard |
| `2xl` | 1600 | Desktop large / écran retina |

Pour chaque image, le pipeline produit **6 variantes par format**, soit
typiquement **18 variantes par image** (AVIF × 6, WebP × 6, JPEG × 6).
Le frontend sélectionne la meilleure via `<picture>` + `srcset` +
`sizes`.

### F3 — Qualité adaptative

Trois profils par défaut (overridables par média) :

| Profil | Q AVIF | Q WebP | Q JPEG | Cas d'usage |
|---|---|---|---|---|
| `hero` | 70 | 75 | 82 | Image au-dessus de la ligne de flottaison, LCP critique |
| `inline` | 60 | 70 | 75 | Image dans un article, journal, témoignage |
| `thumb` | 50 | 60 | 65 | Vignette de liste, avatar, OG preview |

Pour la vidéo :

| Profil | Bitrate vidéo | Bitrate audio | Hauteur max |
|---|---|---|---|
| `hero` | 4 Mbps | 128 kbps | 1080 |
| `inline` | 2.5 Mbps | 96 kbps | 720 |
| `thumb` | 1 Mbps | 64 kbps | 360 |

### F4 — Connexion frontend ↔ système média

Le frontend consomme les médias via :

1. **Server Component** : `await getMedia(id)` ou
   `await getMedia(slug)` depuis `@/lib/media/queries` →
   intégration directe dans une page Next.js, sans aller-retour client.
2. **Composants React** : `<MediaImage>`, `<MediaVideo>`,
   `<MediaAudio>` qui acceptent un `id`, un `slug`, ou un
   objet `Media` déjà résolu.
3. **API publique cacheable** : `GET /api/media/{id}` (lecture
   seule) — utilisée pour l'hydratation tardive ou les composants
   client. Réponse cachable via `Cache-Control: public, max-age=300,
   s-maxage=86400, stale-while-revalidate=86400`.

### F5 — Optimisations innovantes

Au-delà du `<picture>` standard, on intègre :

- **BlurHash** (~30 octets) pour LQIP instantané,
- **Art direction** : versions différentes selon le breakpoint
  (cadrage portrait sur mobile, paysage sur desktop) — pas seulement
  un redimensionnement,
- **Color palette extraction** : 3 couleurs dominantes stockées en DB
  pour pré-colorer le placeholder en attendant l'image,
- **Priority hints** : `fetchpriority="high"` automatique sur le
  premier média marqué `hero` d'une page,
- **Connection-aware** : si `navigator.connection.saveData === true`
  ou `effectiveType === 'slow-2g' | '2g'`, on bascule sur la version
  `low` (qualité réduite, pas de variant `xl`/`2xl`).

### F6 — Lazy-loading intelligent

Quatre stratégies sélectionnables par média ou par usage :

| Stratégie | Comportement | Cas d'usage |
|---|---|---|
| `eager` | Charge dès le mount, `loading="eager"`, `fetchpriority="high"` | Hero, LCP critique |
| `viewport` | IntersectionObserver, marge `200px` | Default pour tout le reste |
| `idle` | `requestIdleCallback`, charge quand le navigateur est libre | Galerie en bas de page, footer |
| `interaction` | Charge au hover/focus/click | Vidéo lourde, modale, accordéon |

**Règle absolue** : un média marqué `hero: true` ignore toujours le
lazy-loading et passe en `eager` même si la config globale dit le
contraire.

### F7 — Override per-média

Chaque entité `Media` peut porter un objet `overrides` (JSONB) qui
écrase la config par défaut sur n'importe lequel des champs :

```jsonc
{
  "loadingStrategy": "eager",     // override stratégie par défaut
  "qualityProfile": "hero",       // override profil qualité
  "breakpoints": ["sm", "lg", "2xl"],  // limiter à 3 variantes
  "formats": ["avif", "webp"],    // ne pas générer JPEG (image moderne)
  "lazy": false,                  // alias rapide pour loadingStrategy: "eager"
  "fetchPriority": "high",
  "blurhash": false               // désactiver le LQIP
}
```

Hiérarchie de résolution :
1. `overrides` du média (le plus spécifique),
2. profil de **contexte** (`hero` / `inline` / `thumb`) passé par le
   composant consommateur,
3. **config globale** définie dans `media.config.ts`.

### F8 — Interface admin

Bibliothèque média complète, accessible via `/admin/media`, avec :

- **Grille responsive** des médias (250 px par tuile sur desktop,
  150 px sur mobile),
- **Filtres** : type (image/vidéo/audio), tag, statut d'optimisation
  (`pending`, `processing`, `ready`, `failed`, `passthrough`),
  utilisation (utilisé / inutilisé), date.
- **Recherche** : par nom, alt, tag, hash perceptuel (détection de
  doublons),
- **Drawer détail** : aperçu grand format, métadonnées (dimensions,
  taille fichier, formats produits, blurhash, palette), historique
  d'optimisation, liste des **usages** (pages qui consomment ce
  média), boutons (réoptimiser, modifier, supprimer),
- **Upload zone** : drag & drop, multiple files, progress par fichier,
  pré-visualisation avant validation,
- **Détection de doublons** : phash (perceptual hash) calculé à
  l'upload → si collision ≥ 95 %, alerte avant import,
- **Indicateur d'optimisation** : badge visuel par média
  (vert = optimisé, jaune = passthrough, gris = en attente, rouge =
  échec).

## Exigences non-fonctionnelles

### NF1 — Performance

| Métrique | Cible | Mesuré sur |
|---|---|---|
| LCP page d'accueil | ≤ 2.0 s | 4G, mobile, Lighthouse CI |
| CLS sur médias | < 0.05 | dimensions intrinsèques posées avant chargement |
| Pipeline image (1 src → 18 variants) | ≤ 8 s | Vercel Function 1024 MB |
| Pipeline vidéo (1 min source) | ≤ 60 s | Vercel Function fluent-ffmpeg |
| Taille moyenne hero AVIF | ≤ 80 kB | 1280 px, q=70 |

### NF2 — Sécurité

- Magic-bytes validation à l'upload (rejet si MIME ≠ contenu réel).
- Taille max : 25 MB image, 200 MB vidéo, 50 MB audio.
- Anti-SSRF sur URLs externes (réutilise `lib/webhooks/anti-ssrf.ts`).
- CSP `img-src 'self' data: blob: https:` (déjà en place).
- Signature HMAC sur les URLs Vercel Blob privées (TTL 7 j).
- Audit `media.uploaded`, `media.deleted`, `media.optimized`,
  `media.regenerated` dans `audit_events`.

### NF3 — Robustesse

- Pipeline **idempotent** : ré-exécuter une optimisation produit le
  même résultat (sauf changement de config explicite).
- **Retry exponentiel** sur les échecs sharp/ffmpeg (3 tentatives, 1s,
  5s, 30s).
- **Fallback SVG** systématique : tout composant `<MediaImage>` rend
  le placeholder SVG (depuis `apps/web/public/products/...`) tant que
  la variante optimisée n'est pas prête ou n'a pas chargé.
- **Stockage redondé** : Vercel Blob (prod) avec snapshot
  hebdomadaire vers S3 (Phase 2).

### NF4 — Accessibilité

- `alt` **obligatoire** côté admin (validation Zod côté API).
- Vidéos : track `captions` requis ou opt-out explicite par média
  (champ `noCaptionsReason`).
- Audio : transcription requise ou opt-out explicite.
- Préférence `prefers-reduced-motion: reduce` → désactive auto-play
  des vidéos en autoplay sur la page (basculé sur `play on click`).
- jest-axe : 100 % violations = 0 sur la bibliothèque admin et le
  composant `<MediaImage>` (toutes variantes : `eager`, `viewport`,
  avec/sans légende, etc.).

### NF5 — Coût

- **Vercel Bandwidth** : viser < 80 % du quota mensuel grâce au cache
  edge agressif (s-maxage 30 j sur les variantes immutables).
- **Compute** : pipeline en arrière-plan (cron) plutôt qu'en
  bloquant l'upload, pour ne pas faire payer la fondatrice qui upload
  une image lourde.

## KPIs

| KPI | Mesure | Cible Phase 1 | Cible Phase 2 |
|---|---|---|---|
| % médias optimisés | `(optimized / total) × 100` | ≥ 90 % | ≥ 99 % |
| Doublons détectés / mois | `count(phash collision >= 95%)` | rapporter | < 2 % du total |
| LCP p75 mobile | RUM (Vercel Analytics) | ≤ 2.5 s | ≤ 2.0 s |
| Économie taille image vs source | `(src - avif) / src × 100` | ≥ 60 % | ≥ 70 % |
| Taux d'erreur pipeline | `failed / total × 100` | < 5 % | < 1 % |

## Contraintes & dépendances

- **Doit utiliser Drizzle + Neon** (pas de nouveau driver).
- **Doit s'inscrire dans le middleware existant** (CSP nonce, auth
  admin, headers no-store).
- **Doit utiliser le composant `<Image>` Next.js 14** comme primitive
  (avec custom loader si nécessaire), pas de balise `<img>` brute.
- **Doit tomber sur le SVG placeholder existant** quand la variante
  n'est pas dispo, sans changement de layout (CLS = 0).
- **Pas de dépendance lourde côté client** : `blurhash` décodé via
  Canvas API native (~3 kB), `<picture>` natif (pas de polyfill).

## Vocabulaire

| Terme | Définition |
|---|---|
| **Média** | Entité logique (image / vidéo / audio) avec métadonnées |
| **Variante** | Fichier physique produit par le pipeline (un format × un breakpoint) |
| **Source** | Fichier original uploadé (jamais servi en prod, conservé pour ré-encodage) |
| **LQIP** | Low Quality Image Placeholder (BlurHash décodé en data-URI) |
| **Phash** | Perceptual hash, signature 64 bits invariante au format/redimensionnement |
| **Usage** | Référence d'un média par une page / un composant (pour analytics et nettoyage) |
| **Passthrough** | Média gardé tel quel (URL distante, pas de re-hébergement) |
| **Override** | Bloc JSON par média qui écrase la config par défaut |
