# 03 — Architecture technique & intégration

## 1. Vue d'ensemble des composants

Convention « Bound » du repo (pur client + wrapper RSC) :

```
src/components/sections/
  StoriesVideo.tsx          'use client' — orchestrateur : <StoriesRail/> + ouverture lazy du viewer
  StoriesRail.tsx           'use client' — rail de bulles (scroll-snap, posters only)
  StoryViewer.tsx           'use client' — overlay plein écran (portal) — importé en dynamic()
  StoriesVideo.test.tsx     tests colocalisés
  StoriesVideoBound.tsx     'server-only' — résout le feed + i18n, rend <StoriesVideo/>
src/lib/stories/
  types.ts                  StoryFeed, Story, StorySegment (types partagés)
  feed.ts                   getStoriesFeed(locale) — lecture DB → StoryFeed compact
  seen.ts                   helpers localStorage (fg_stories_seen) — client
```

- `StoryViewer` est **code-splitté** : `const StoryViewer = dynamic(() => import('./StoryViewer'),
  { ssr:false, loading: () => null })`. Il n'entre dans le bundle qu'à la 1ʳᵉ ouverture → **0 JS
  player tant qu'aucune bulle n'est tapée**.
- Le player interne réutilise l'existant : soit `MediaVideoClient`
  (`src/lib/media/components/MediaVideoClient.tsx`, `strategy` de lazy-load), soit un `<video>`
  minimal calqué sur `SelfHostedVariant` (`VideoPlayer4Gestes.tsx`) — voir §3.

## 2. Modèle de données du feed

### Forme runtime (compacte, passée au client)
```ts
// src/lib/stories/types.ts
interface StorySegment {
  id: string;
  sources: { url: string; mime: 'video/webm' | 'video/mp4' }[]; // webm avant mp4
  poster: string;            // URL variant format='poster'
  durationMs: number;        // originalDurationMs
  caption?: string;          // localisé
  cta?: { label: string; target: string };  // ex. '#commander-femiglow'
}
interface Story { id: string; title: string; bubblePoster: string; segments: StorySegment[]; }
interface StoryFeed { stories: Story[]; }
```
Les URLs vidéo sont **de simples chaînes** : elles ne coûtent rien tant qu'aucun `<source>` n'est
monté. C'est ce qui rend le payload initial négligeable même avec 6 stories × 5 clips.

### Persistance — deux options

**Option A (recommandée, maintenable) : schéma dédié léger.**
```
media_story          id, slug(unique), title_i18n(jsonb), bubble_media_id(→media poster/image),
                     display_order, is_active, page_group('kit'), created_at
media_story_segment  id, story_id(→media_story), media_id(→media kind='video'),
                     display_order, caption_i18n(jsonb), cta_label_i18n(jsonb), cta_target,
                     is_active
```
`feed.ts` joint `media_story` + `media_story_segment` + `media`/`media_variants` (filtre
`is_active`, tri `display_order`), construit `StoryFeed`. Admin CRUD dédié (P2). Aligné au style
des tables média existantes (`src/lib/db/schema.ts`).

**Option B (MVP rapide, sans migration) : tag + convention.**
Tag `stories` sur les médias vidéo + un ordre par `media.slug` ou par un binding. **Attention** :
le filtre `tag` de `listMedia` **n'est pas implémenté** (`src/lib/db/queries/media.ts` ne gère que
`kind/status/isHero/q`) → il faut une **query custom** joignant `media_to_tags`. Le regroupement
en « stories » (une bulle = N clips) est alors porté par une convention de nommage/slug fragile.
→ **Acceptable pour prototyper**, mais on migre vers l'Option A dès que le feature est validé.

> Décision : **Option A** pour la cible, **Option B** tolérée pour un POC en P1 si on veut voir le
> composant vivant avant de figer le schéma.

### Où branche le composant de page
Le `StoriesVideoBound` appelle `getStoriesFeed(locale)` (RSC, cache `unstable_cache` tag
`'stories'` comme `get-media.ts`), et récupère les libellés via `getTranslations({ locale,
namespace: 'marketing.kit.stories' })`. Il passe `feed` + `strings` en props au client.

## 3. Stratégie de payload (le cœur de « ne pas surcharger »)

Calquée sur l'existant (`VideoPosterCover`, `MediaVideoClient`, `useMediaInView`) :

| Niveau | Ce qui charge | Ce qui NE charge pas |
|---|---|---|
| **Page** | posters des bulles (WebP ~10 kB) | aucun JS player, aucune vidéo, aucun poster de segment |
| **Rail visible** | décodage posters (différé via IntersectionObserver) | — |
| **1ʳᵉ ouverture** | bundle `StoryViewer` (dynamic import) + segment courant | segments non-adjacents |
| **Lecture** | segment courant (`<source>` montés) + **poster** du suivant | reste du feed |
| **Avance** | préchargement `preload="metadata"` du seul suivant | segments N+2… |

Points concrets :
- `next/dynamic(..., { ssr:false })` pour `StoryViewer`.
- Dans le viewer, **un seul `<video>` monté** à la fois (clé React = `segment.id`) ; le suivant
  n'a que son poster préchargé (`<link rel="preload" as="image">` ou `<img hidden>`).
- `preload="none"` par défaut, `"metadata"` pour le segment courant/suivant, jamais `"auto"` en
  masse.
- `prefers-reduced-motion` → pas d'autoplay/auto-advance.
- `preconnect`/`dns-prefetch` vers l'hôte média (self ou CDN) dans le `<head>` de `/kit`.

## 4. Service vidéo — le gap HTTP Range

Le handler `src/app/media-files/[...path]/route.ts` lit tout le fichier (`readFile`) et renvoie
**toujours `200` sans `Accept-Ranges`** (pas de `206`/`Content-Range`). Conséquences pour la
vidéo : pas de seek fiable, pas de streaming partiel, le fichier entier transite à chaque lecture.
`MEDIA_SIGNED_URL_SECRET` est déclaré mais **non appliqué** (URLs publiques).

**Stratégie** :
- **Clips courts & optimisés** (5–15 s, `-movflags +faststart`, `-crf 28`, déjà dans
  `optimize-video.ts`) → un `200` complet reste tolérable (~0,5–2 Mo/clip). MVP OK.
- **P2 — ajouter le support Range** au handler `/media-files` pour `video/*` : parser
  `Range:`, renvoyer `206` + `Content-Range` + `Accept-Ranges: bytes`. Améliore seek + TTFB.
- **Prod à l'échelle** : servir les vidéos via **CDN / Vercel Blob** (driver `vercelBlob` déjà
  prévu dans `MEDIA_STORAGE_DRIVER`) plutôt que le route handler Node.
- **Seed** : **aucune vidéo n'existe** aujourd'hui (`.media-storage` = images uniquement).
  P0 = uploader des vidéos via `/admin/media/upload` (déclenche ffmpeg → variants mp4/webm +
  poster) ou un script de seed.

## 5. Tracking

**Nouveaux events** à ajouter au catalogue (`src/lib/tracking/event-catalog.ts`) **et** aux
schémas Zod (`src/lib/tracking/schemas.ts`) :

| Event | Params clés | Sens |
|---|---|---|
| `story_open` | `story_id`, `entry:'bubble'` | ouverture du viewer |
| `story_view` | `story_id`, `segment_id`, `segment_index` | vue d'un segment |
| `story_complete` | `story_id` | story terminée |
| `story_next` / `story_prev` | `story_id`, `segment_index` | tap navigation |
| `story_pause` | `story_id`, `segment_id` | long-press |
| `story_close` | `story_id`, `segment_index`, `reason` | fermeture |
| `story_cta_click` | `story_id`, `segment_id`, `cta_target` | clic CTA |

Réutilisés tels quels : `video_progress`/`video_percent`, `video_complete`, `cta_impression`
(impression bulle), `add_to_cart`, `view_item`, `select_content`. Émission via
`useTracking().emit(event, params)` (`src/lib/tracking/use-tracking.ts`). `story_cta_click` sera
**normalisé vers `cta_click`** à l'ingestion (comme `pack_cta_click`, cf. `schemas.ts:55-59`) pour
alimenter le funnel CTA + le tag Google Ads.

> Après ajout au catalogue, prévoir (hors code app) le mapping GTM si on veut ces events côté
> providers — non bloquant pour la mesure interne `/api/track`.

## 6. Intégration page & registry

1. **Registry** : ajouter un seed `kit-stories-video` dans `src/lib/components/registry.ts`
   (`pageGroup:'kit'`, slots média `SLOT_VIDEO_POSTER`/`SLOT_VIDEO_SOURCE` par segment si Option
   slots, sinon champs éditoriaux pointant les stories). **Ne jamais renommer la clé** après seed
   prod (cf. avertissement registry.ts:10-15).
2. **Sync** : `pnpm --filter @femiglow/web sync:components` ou `POST
   /api/admin/components/sync-registry`.
3. **Page** : insérer `<StoriesVideoBound locale={locale}/>` dans `KitPageLayoutV2.tsx` à la
   position choisie (après `HeroProduitBound`), **derrière un flag** `STORIES_ENABLED`
   (`src/lib/feature-flags/…`, sur le modèle de `kit-layout.ts`). Miroir V1 si nécessaire.
4. **Preview admin** : ajouter `kit-stories-video` au map `MIGRATED_COMPONENTS`
   (`src/lib/components/render-by-key.tsx`) pour une vraie preview iframe (sinon placeholder).
5. **i18n** : namespace `marketing.kit.stories` dans `messages/{fr,ar,en}.json` (titres bulles,
   libellés CTA, aria). **RTL** géré via `getLocaleConfig(locale).direction` + variants `rtl:`.

## 7. Contrats & garde-fous
- `StoriesRail` masqué si `feed.stories.length === 0` (aucune régression si pas de vidéo).
- Feature flag OFF par défaut → composant inerte tant que non activé (déploiement sûr).
- Aucune dépendance nouvelle (scroll-snap CSS + portal React natif + `<video>` natif).
- Respect strict de la politique CSP existante (les vidéos self-hosted sont `'self'`, aucun host
  tiers requis ; si CDN, whitelister son host dans `media-src`/`connect-src`).
