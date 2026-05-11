# 15 — Performance et stratégie de chargement

Budget Web Vitals, stratégies de pagination, lazy load des images, cache serveur, plafond DOM. L'objectif : que le module compact et le drawer **n'aient aucun impact perceptible** sur les performances de la page `/kit`.

## 1. Budget Web Vitals (page `/kit`)

| Métrique | Cible actuelle | Cible après wall |
| --- | --- | --- |
| LCP | < 2,5 s | < 2,5 s (impact 0) |
| CLS | < 0,1 | < 0,1 (impact 0) |
| INP | < 200 ms | < 200 ms (impact 0) |
| FCP | < 1,8 s | < 1,8 s |
| TTFB | < 600 ms | < 600 ms |

L'ajout du module compact ne **doit pas dégrader** ces métriques. Audit Lighthouse en CI sur chaque PR.

## 2. Budget de poids

| Élément | Cible |
| --- | --- |
| CSS additionnel (module + drawer + wizard) | ≤ 30 ko gzip |
| JS additionnel (RitualsWall* components) | ≤ 50 ko gzip |
| Framer Motion (déjà chargé) | (réutilisé) |
| Radix Dialog (déjà chargé) | (réutilisé) |
| Vision ML faces (côté serveur) | N/A côté client |
| Thumbnails AVIF/WebP par carte | ≤ 15 ko |
| Photo full-res en lightbox | ≤ 200 ko (compression côté serveur) |

## 3. Stratégie de chargement par composant

### 3.1 Module compact `/kit`

- **Server component RSC** : `RitualsModuleBound.tsx` fetch côté serveur les 3 cards `featured` + `summary`.
- **Streaming** : Suspense boundary autour du module pour ne pas bloquer le rendu de la page.
- **Skeleton SSR-rendered** pendant la résolution de la promesse — pas de saut de mise en page.
- **Photos** : AVIF/WebP, `loading="eager"` pour la première carte au-dessus du pli (souvent), `loading="lazy"` pour les autres. `fetchPriority="high"` sur la première photo.
- **Pas de JS au mount** sauf un petit handler de click qui ouvre le drawer.

### 3.2 Drawer

- **Code splitting** : le composant `RitualsWallDrawer` est chargé en **dynamic import** au premier click sur le lien `Lire les 26 rituels →`. Tant que personne ne clique, **0 octet** ajouté au bundle initial de `/kit`.

```tsx
const RitualsWallDrawer = dynamic(
  () => import('@/components/sections/rituals/RitualsWallDrawer'),
  { ssr: false, loading: () => <DrawerSkeleton /> }
);
```

- **Fetch initial dans le drawer** : `summary` + 12 premières cartes via deux requêtes parallèles (`/api/rituals/summary` cache 5 min + `/api/rituals/list`).
- **Skeleton de 12 cartes** affiché pendant le fetch initial (< 400 ms p95).
- **Filtres** : changement de filtre = nouvelle requête. Pas de filtrage client-side (limitation : la liste peut être grande).

### 3.3 Wizard

- **Lazy load** : `RitualsWizard` n'est chargé que si l'initiée clique `Partager mon rituel →`.
- **Vision ML faces** : exécuté **uniquement** côté serveur post-upload. Aucune lib ML côté client.

### 3.4 Lightbox photo

- **Lazy load** : `RitualPhotoLightbox` chargé au premier clic sur une photo.
- **Full-res image** : fetch on demand au mount de la lightbox. `<img loading="eager">` une fois en DOM.
- **Préchargement adjacent** : à l'affichage de la photo N, précharge en `<link rel="preload">` les photos N-1 et N+1 si elles existent.

## 4. Pagination cursor-based

### 4.1 Format du cursor

```
cursor = base64url(JSON.stringify({
  publishedAt: "2026-05-08T14:32:00Z",
  id: "k7m3qp2x"
}))
```

Opaque, ne fait pas fuiter de logique métier.

### 4.2 Requête côté serveur

```sql
SELECT *
FROM ritual_testimonials
WHERE status = 'APPROVED'
  AND product_key = $1
  AND (
    $cursor IS NULL
    OR (published_at, id) < ($cursorPublishedAt, $cursorId)
  )
ORDER BY published_at DESC, id DESC
LIMIT 12;
```

Stable et rapide grâce à l'index `idx_ritual_published_at` partial sur `status = 'APPROVED'`.

### 4.3 Filtres combinés au cursor

Les filtres ajoutent des `WHERE` supplémentaires, sans casser la stabilité du cursor :

```sql
WHERE status = 'APPROVED'
  AND product_key = $1
  AND ($filter_with_photos = false OR EXISTS (
    SELECT 1 FROM ritual_testimonial_photos p
    WHERE p.testimonial_id = ritual_testimonials.id
    AND p.faces_status = 'OK'
  ))
  AND ($filter_tag IS NULL OR $filter_tag = ANY (ritual_tags))
  AND (... cursor)
```

## 5. Cache serveur

### 5.1 `/api/rituals/summary`

| Niveau | Stratégie |
| --- | --- |
| HTTP | `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600` |
| CDN | Vercel Edge Cache, invalidation manuelle sur publication |
| Application | Refresh matérialized view toutes les 5 min via CRON |
| ETag | Géré automatiquement par Next.js |

Coût attendu : 99 % des requêtes servies par le cache, < 5 ms.

### 5.2 `/api/rituals/list`

- **Pas de cache HTTP** : combinaison filtres × cursor trop variable. Servi à chaque appel.
- **Cache applicatif** : mise en cache côté React Query (ou SWR) avec clé `[productKey, filters, sort, cursor]`. Évite double fetch si l'utilisateur revient en arrière.
- **Index Postgres** : la requête doit s'exécuter sous 20 ms avec l'index partiel sur `(status, published_at DESC)`.

### 5.3 `/api/rituals/policy`

- **Cache HTTP** : `Cache-Control: public, max-age=3600, s-maxage=3600` (texte changeant rarement).
- **Invalidation** sur édition admin.

## 6. Images

### 6.1 Pipeline d'optimisation

À l'upload (`POST /api/rituals/submit`) :

1. **Réception** du fichier (max 5 Mo).
2. **Vérification mime + dimensions** + scan EXIF stripping (pas de localisation GPS exposée).
3. **Sharp** crée 3 variants :
   - `original` (max 1600 px côté long, qualité 85, format d'origine) → archive.
   - `display` (max 1200 px, AVIF qualité 70, fallback WebP 75).
   - `thumb` (240 px carré, AVIF 65, fallback WebP 70).
4. **Stockage** Vercel Blob (production) ou local `/public/uploads/rituals/` (dev).
5. **URLs** dans `ritual_testimonial_photos.url`, `.thumb_url`.

### 6.2 Affichage côté client

```html
<picture>
  <source srcset="/blob/path/photo.avif" type="image/avif" />
  <source srcset="/blob/path/photo.webp" type="image/webp" />
  <img
    src="/blob/path/photo.jpg"
    alt="Mains d'Amal, six semaines après le début du rituel"
    width="80" height="80"
    loading="lazy"
    decoding="async"
  />
</picture>
```

Dimensions explicites pour éviter le CLS. `loading="lazy"` pour toutes les photos sauf la première du module compact.

### 6.3 Focal point

```css
.ritual-card-photo img {
  object-fit: cover;
  object-position: var(--focal-x) var(--focal-y);
}
```

Avec `--focal-x: 50%; --focal-y: 30%;` calculé depuis `focal_x`, `focal_y` BDD.

## 7. Plafond DOM

### 7.1 Cartes simultanées

- **Mode liste drawer** : 12 + 12 + 12 + ... jusqu'à 48 cartes maximum simultanées dans le DOM.
- **Au-delà** : un message `Vous avez lu 48 voix. Voir les plus anciennes ↻` réinitialise la liste avec la suite (les 48 actuelles sont déchargées).
- **Effet** : pas plus de ~48 cartes dans le DOM à un instant donné. Avec ~120 LOC par carte (HTML + CSS classes + listeners), DOM léger.

### 7.2 Pas de virtualization au lancement

`react-virtual` ajoute de la complexité (gestion de la hauteur dynamique des cartes selon longueur citation et présence photo). Coût/bénéfice négatif à < 50 cartes. À envisager **Phase 2** si volume > 200.

## 8. Mesures CRON et asynchrones

### 8.1 Refresh agrégat matérialisé

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY ritual_aggregate;
```

- Fréquence : toutes les 5 minutes.
- Durée attendue : < 100 ms.
- Mode CONCURRENTLY : pas de lock sur les lectures.

### 8.2 E-mail J+45

- Fréquence : 1 fois par jour, 10h Maroc.
- Coût : 1 SELECT join `orders × admin_users` + N envois SMTP. Asynchrone via queue interne.

### 8.3 Vision ML faces recheck

- Sur soumission : job enqueued, exécuté < 5 sec après.
- Recheck stale : 1 fois par heure pour rattraper les jobs perdus.
- Coût par image : ~ 800 ms (modèle MediaPipe Face Detection).
- Sur Vercel Functions : limite 10 sec — largement suffisant pour 1 image. Pour 3 photos en parallèle, exécution séquentielle.

## 9. Mesures Lighthouse cibles

### 9.1 `/kit` (avec module compact)

| Métrique | Avant | Cible après |
| --- | --- | --- |
| Performance | 95 | ≥ 92 |
| Accessibility | 100 | 100 |
| Best Practices | 95 | 95 |
| SEO | 95 | 95 |

Délai LCP cible : pas plus de **+ 200 ms** vs sans module. Si dépassement : retirer le module compact et basculer sur lien autonome (graceful degradation).

### 9.2 `/admin/rituals`

Pas d'objectif Web Vitals public (interface admin). Cible interne : < 1 s pour ouvrir la queue avec 50 témoignages PENDING.

## 10. Monitoring en production

### 10.1 RUM (Real User Monitoring)

- **Vercel Analytics** existant : suit les Web Vitals par route.
- **Sentry Performance** : trace les soumissions wizard. Alerte si p95 > 2 s.

### 10.2 KPI techniques

| KPI | Cible | Alerte si |
| --- | --- | --- |
| `/api/rituals/list` p95 | < 200 ms | > 500 ms |
| `/api/rituals/summary` p95 | < 50 ms (cache) | > 200 ms |
| `/api/rituals/submit` p95 | < 800 ms | > 2 s |
| Vision ML face check p95 | < 2 s | > 5 s |
| Refresh matérialisée durée | < 100 ms | > 500 ms |
| Erreurs 5xx sur `/api/rituals/*` | < 0,1 % | > 1 % |

## 11. Tests de performance

### 11.1 Tests synthétiques

`apps/web/k6/rituals-load.js` :

```js
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 50,
  duration: '2m',
};

export default function () {
  const summary = http.get('https://femiglow-maroc.com/api/rituals/summary?product_key=pack-femiglow');
  check(summary, { 'summary 200': r => r.status === 200, 'summary < 200ms': r => r.timings.duration < 200 });

  const list = http.get('https://femiglow-maroc.com/api/rituals/list?product_key=pack-femiglow&limit=12');
  check(list, { 'list 200': r => r.status === 200, 'list < 300ms': r => r.timings.duration < 300 });

  sleep(1);
}
```

À lancer une fois par release sur l'environnement preview.

### 11.2 Tests E2E Playwright

`apps/web/e2e/rituals-perf.spec.ts` mesure le temps de :

- Ouverture du drawer (cible < 500 ms après click).
- Filtre change (cible < 400 ms).
- Load more (cible < 400 ms).
- Soumission wizard (cible < 1 s pour réponse 202).

## 12. Synthèse — règles d'or performance

1. **Module compact RSC streaming** — pas de blocage du rendu de `/kit`.
2. **Drawer en dynamic import** — pas un octet tant que personne ne clique.
3. **Cursor-based pagination** — stable et rapide.
4. **Cache 5 min sur `/api/rituals/summary`** — 99 % de hit.
5. **Images AVIF + WebP + JPEG** — moins de 15 ko par thumbnail.
6. **`loading="lazy"` partout** sauf au-dessus du pli.
7. **Plafond DOM 48 cartes** — pas de virtualization au lancement.
8. **Refresh matérialisée toutes les 5 min** — agrégat toujours frais.
9. **Vision ML côté serveur** — pas de ML dans le bundle client.
10. **Monitoring RUM + Sentry** — alerte si p95 dépasse les seuils.
