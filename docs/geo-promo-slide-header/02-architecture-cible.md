# Architecture cible

## Vue d'ensemble

```text
Navigateur
  -> page /kit Next.js
  -> GeoPromoSlideHeader client
  -> GET /api/promo/location
  -> visitor geo resolver
  -> Cloudflare headers ou fallback
  -> configuration admin Components CMS
  -> rendu message + CTA
```

## Choix geolocalisation

### Option A: Vercel

Stack:

- Next.js
- Vercel Hosting
- `@vercel/functions`
- helper `geolocation(request)`

Avantages:

- Integration tres simple si l'application est hebergee sur Vercel.
- API claire.
- Moins de configuration infrastructure.

Limites dans l'ecosysteme actuel:

- Le site est observe comme heberge hors Vercel, sur VPS/LiteSpeed.
- Changer l'hebergement juste pour ce besoin est disproportionne.
- Le chantier actuel demande le serveur de staging existant.

### Option B: Cloudflare

Stack:

- Next.js
- Cloudflare devant le domaine staging
- Managed Transform `Add visitor location headers`
- Lecture des headers Cloudflare dans Next.js

Avantages:

- Compatible VPS/LiteSpeed.
- Flexible et reversible.
- Ne force pas de migration hosting.
- Peut s'activer d'abord sur staging.

Limites:

- Necessite que le trafic passe vraiment par Cloudflare.
- Les headers doivent etre traites comme approximatifs.
- Il faut verifier le comportement cache/proxy.

### Decision

Retenir Cloudflare en phase 1, avec une abstraction `resolveVisitorGeo(request)` capable de supporter plus tard:

- Cloudflare headers.
- Vercel `geolocation(request)`.
- Fallback manuel.
- Mode test par headers controles.

## Emplacement dans Next.js

### A eviter

Ne pas lire les headers geo directement dans le layout marketing server-side. Cela risquerait de:

- rendre les pages statiques dynamiques;
- compliquer le cache;
- exposer un risque de ville incorrecte entre visiteurs si un cache partage est mal configure.

### Recommande

- Le layout marketing injecte un composant public avec config non personnelle.
- Le composant client appelle `/api/promo/location` apres hydration.
- L'API renvoie les donnees localisees avec `Cache-Control: private, no-store`.
- Le composant affiche le message seulement quand la config est active et que la route courante est exactement `/kit`.

## Integration layout

Phase 1:

- Injecter dans le layout/page `/kit` ou dans un slot conditionnel qui ne rend rien hors `/kit`.
- Exclure toutes les autres pages marketing, commerce, checkout, admin et API.
- Respecter le comportement existant du chat et du header sticky.

Exemple cible:

```tsx
<>
  <GeoPromoSlideHeaderSlot routeScope="/kit" />
  <Header />
  <main id="main" tabIndex={-1}>{children}</main>
  <Footer />
</>
```

`GeoPromoSlideHeaderSlot` doit rester un wrapper propre, capable de ne rien rendre si le composant admin est desactive.

## Modules proposes

- `apps/web/src/lib/promo-slide-header/geo.ts`
- `apps/web/src/lib/promo-slide-header/template.ts`
- `apps/web/src/lib/promo-slide-header/config.ts`
- `apps/web/src/app/api/promo/location/route.ts`
- `apps/web/src/components/promo/GeoPromoSlideHeader.tsx`
- `apps/web/src/components/promo/GeoPromoSlideHeaderSlot.tsx`
- `apps/web/src/components/promo/geo-promo-slide-header.css` si le systeme CSS local le justifie

## Configuration technique admin-first

Toute configuration produit doit etre pilotee depuis l'interface admin, pas depuis des variables d'environnement.

Sources autorisees:

- composant admin `global-promo-slide-header`;
- champs publies du Components CMS;
- valeurs system-driven du kit pour la reduction;
- etat `enabled` admin;
- routes admin `routesInclude` / `routesExclude`;
- styles admin valides.

Comportement:

- si `enabled=false` dans l'admin, l'API renvoie disabled et le slot ne rend rien;
- si la config admin est invalide, l'API tombe sur disabled ou sur les defaults admin seedes;
- aucun deploy ni changement `.env` ne doit etre necessaire pour activer, desactiver, changer le message, les tags, le CTA, le theme ou le scope `/kit`.

Exception:

- les secrets et parametres purement infrastructure restent hors admin si le projet en possede deja, mais cette fonctionnalite ne doit pas introduire de variable d'environnement produit.

## Observabilite

Journaliser cote serveur uniquement les anomalies non personnelles:

- header geo absent;
- valeur invalide;
- config admin invalide;
- template impossible a rendre.

Ne jamais logger l'IP visiteur.
