# Plan geolocalisation promotionnelle - slide header

Date: 2026-05-18  
Contexte: FemiGlow Next.js 14 sur VPS/LiteSpeed, service systemd `femiglow.service`, port interne `8011`.

## Objectif

Afficher en haut de l'ecran un bandeau qui se deroule avec un message contextualise:

> Promotion aujourd'hui le 18 mai 2026 dans la region de Casablanca.

La ville doit rester approximative, non bloquante, non critique pour le checkout, et ne doit pas casser le cache public des pages marketing.

## Etat actuel observe

- Le deploiement courant n'est pas un runtime Vercel: `bin/deploy.sh` build puis restart `femiglow.service`, smoke sur `127.0.0.1:8011`.
- Le domaine public repond avec `server: LiteSpeed`.
- La reponse publique ne montre pas de header Cloudflare visible comme `cf-ray`, donc Cloudflare ne semble pas encore etre devant le domaine au moment de l'audit.
- Le `Header` marketing est un composant client dans `apps/web/src/components/layout/Header.tsx`.
- Le layout marketing actuel injecte `Header` puis le contenu dans `apps/web/src/app/(marketing)/layout.tsx`.
- Le site utilise deja une logique CSP/middleware centralisee dans `apps/web/src/middleware.ts`.

## Comparaison des deux options

### Option A - Vercel geolocation

Stack:

- Next.js
- Vercel Hosting
- `@vercel/functions`
- `geolocation(request)`

Avantages:

- Integration tres simple si l'app est executee sur Vercel.
- Donnees accessibles directement depuis la request.
- Pas besoin d'ajouter Cloudflare uniquement pour ce besoin.

Limites dans l'ecosysteme actuel:

- Le projet tourne aujourd'hui sur VPS/LiteSpeed, pas sur Vercel.
- Utiliser `@vercel/functions` maintenant creerait une dependance morte ou inactive en production actuelle.
- Migrer l'hebergement juste pour un bandeau promotionnel n'est pas proportionne.

Conclusion:

Option propre pour une migration future vers Vercel, mais ce n'est pas le bon choix pour le serveur de staging/production actuel.

### Option B - Cloudflare visitor location headers

Stack:

- Next.js self-hosted
- Cloudflare devant le domaine
- Managed Transform `Add visitor location headers`
- Lecture des headers `cf-ipcity`, `cf-ipcountry`, `cf-region`, `cf-timezone`, etc.

Avantages:

- Compatible avec le VPS/LiteSpeed actuel.
- Ne depend pas d'un runtime proprietaire Vercel.
- Peut etre activee au niveau DNS/proxy sans changer le coeur de l'app.
- Cloudflare fournit les headers de ville, pays, region, latitude/longitude approximatives.

Limites:

- Cloudflare doit etre effectivement devant le domaine, avec l'enregistrement DNS proxied.
- La precision IP-ville est approximative et parfois absente.
- Les headers ne doivent jamais etre traites comme une localisation certaine.
- Il faut tester sur staging avant production, car Cloudflare documente que les Managed Transforms peuvent avoir des effets inattendus.

Conclusion:

Option recommandee pour FemiGlow maintenant.

## Decision recommandee

Mettre en place une architecture hybride:

1. Source principale actuelle: Cloudflare headers.
2. Source secondaire future: Vercel geolocation, derriere la meme interface.
3. Fallback robuste: `Maroc`, `votre region`, ou aucune ville si le header est absent.

Le code ne doit pas importer directement Cloudflare ou Vercel dans les composants UI. Il doit passer par un petit module de resolution:

```ts
resolveVisitorGeo(headers): VisitorGeo
```

Cela permet de changer d'hebergeur sans refaire le bandeau.

## Architecture proposee

### Backend

Creer une route dynamique:

```txt
GET /api/promo/location
```

Responsabilites:

- Lire les headers entrants.
- Detecter la source: `cloudflare`, `vercel`, `fallback`.
- Normaliser la ville, le pays et la date.
- Retourner un payload public, minimal, non sensible.
- Ajouter `Cache-Control: private, no-store`.

Payload recommande:

```json
{
  "enabled": true,
  "source": "cloudflare",
  "city": "Casablanca",
  "country": "MA",
  "dateLabel": "18 mai 2026",
  "message": "Promotion aujourd'hui le 18 mai 2026 dans la region de Casablanca."
}
```

Headers Cloudflare a lire:

- `cf-ipcity`
- `cf-ipcountry`
- `cf-region`
- `cf-region-code`
- `cf-timezone`
- `cf-iplatitude`
- `cf-iplongitude`

Headers Vercel a supporter plus tard:

- via `geolocation(request)` si deploiement Vercel
- ou headers equivalents `x-vercel-ip-city`, `x-vercel-ip-country`, etc. si deja presents

### Frontend

Creer un composant client:

```txt
apps/web/src/components/promo/GeoPromoSlideHeader.tsx
```

Responsabilites:

- Fetch `GET /api/promo/location` apres hydratation.
- Afficher le bandeau seulement si `enabled=true`.
- Animer l'entree verticalement depuis le haut.
- Respecter `prefers-reduced-motion`.
- Permettre une fermeture utilisateur avec persistance `sessionStorage`.
- Ne jamais bloquer le rendu de la page.

Point d'injection recommande:

```txt
apps/web/src/app/(marketing)/layout.tsx
```

Raison:

- Le message est marketing/promotionnel.
- Il ne doit pas perturber le tunnel checkout.
- Le layout marketing contient deja `Header`, donc c'est le point naturel.

Ne pas l'injecter dans `RootLayout` au premier lot: cela toucherait admin, checkout, legal, APIs, et augmenterait le risque de regression.

### UI/UX

Forme recommandee:

- Bandeau fin, au-dessus du header marketing.
- Hauteur stable: 36-44 px desktop, 44-52 px mobile.
- Fond contraste avec la charte existante: `encre` ou `sauge`, texte `creme`.
- Texte court, une seule ligne desktop, deux lignes maximum mobile.
- Bouton fermeture iconique, pas un gros bouton texte.
- Animation: `translateY(-100%) -> translateY(0)`, 280-360 ms.
- Delai: 400-700 ms apres chargement, pour eviter un effet brutal.
- Fallback message sans ville:

```txt
Promotion aujourd'hui le 18 mai 2026 dans votre region.
```

Regles UX:

- Pas de demande de permission navigateur.
- Pas de GPS.
- Pas de precision trop forte comme quartier/rue.
- Pas de "a Casablanca" si la ville est absente ou suspecte.
- Ne pas afficher sur `/admin`, `/panier`, `/commander`, `/merci` au premier lot.

### Design

Le site a une identite sobre: creme, encre, typographies locales, editorial premium. Le bandeau doit rester une note commerciale discrete, pas une alerte agressive.

Proposition visuelle:

- fond `#2C2A28` ou token `encre`
- texte `#FBF8F1` ou token `creme`
- accent discret en `sauge`
- hauteur compacte
- letter spacing leger uniquement sur micro-label, pas sur la phrase complete

Microcopy:

```txt
Promotion aujourd'hui le 18 mai 2026 dans la region de Casablanca
```

Variante sans ville:

```txt
Promotion aujourd'hui le 18 mai 2026 dans votre region
```

### Data

Pas de table DB necessaire au premier lot.

Donnees runtime:

```ts
type VisitorGeo = {
  source: 'cloudflare' | 'vercel' | 'fallback';
  city: string | null;
  country: string | null;
  region: string | null;
  timezone: string | null;
};
```

Donnees promotion:

```ts
type GeoPromoPayload = {
  enabled: boolean;
  source: VisitorGeo['source'];
  city: string | null;
  country: string | null;
  dateLabel: string;
  message: string;
};
```

Evolution phase 2:

- Ajouter un flag admin `geo_promo_banner_enabled`.
- Ajouter une configuration de message dans `tracking_settings` ou une table dediee `site_promo_banner`.
- Ajouter une fenetre de validite `startsAt` / `endsAt`.
- Ajouter une whitelist pays: `MA` par defaut.

### Backend route et cache

Ne pas lire les headers dans un Server Component de layout au premier lot.

Raison:

- Les pages publiques sont actuellement cachees (`x-nextjs-cache: HIT`, `s-maxage=1800` observe).
- Lire les headers dans le layout rendrait le rendu plus dynamique et risquerait de degrader le cache public.
- Une route API `no-store` appelee par le client isole le comportement geolocalise sans toucher au cache HTML.

### Securite et RGPD

- La geolocalisation IP est approximative.
- Ne pas stocker la ville en base au premier lot.
- Ne pas envoyer latitude/longitude au navigateur si elles ne sont pas affichees.
- Ne pas utiliser ce signal pour prendre une decision critique.
- Ajouter un fallback si le header manque.
- Nettoyer les caracteres de header avant affichage: longueur max, allowlist unicode raisonnable, suppression des controles.

## Plan de conception

1. Definir le contrat `VisitorGeo` et `GeoPromoPayload`.
2. Definir les sources supportees: Cloudflare maintenant, Vercel plus tard.
3. Definir les routes ou le bandeau s'affiche: marketing uniquement.
4. Definir les fallbacks: ville absente, pays non Maroc, bots, headers invalides.
5. Definir l'animation et la fermeture session.

## Plan de developpement

### Phase 1 - Backend

Fichiers:

- `apps/web/src/lib/geo/visitor-geo.ts`
- `apps/web/src/lib/geo/visitor-geo.test.ts`
- `apps/web/src/app/api/promo/location/route.ts`
- `apps/web/src/app/api/promo/location/route.test.ts`

Actions:

1. Creer le parseur headers Cloudflare.
2. Creer un parseur Vercel compatible future.
3. Normaliser les valeurs.
4. Ajouter le formatage de date en `fr-MA`.
5. Retourner `Cache-Control: private, no-store`.

### Phase 2 - Frontend

Fichiers:

- `apps/web/src/components/promo/GeoPromoSlideHeader.tsx`
- `apps/web/src/components/promo/GeoPromoSlideHeader.test.tsx`
- `apps/web/src/app/(marketing)/layout.tsx`

Actions:

1. Creer le composant client.
2. Fetcher `/api/promo/location`.
3. Gerer loading silencieux.
4. Gerer fermeture session.
5. Respecter reduced motion.
6. Integrer avant `Header`.

### Phase 3 - Observabilite

Option simple:

- Ajouter un event tracking client `geo_promo_viewed`.
- Ajouter un event `geo_promo_dismissed`.

Payload sans PII:

```json
{
  "source": "cloudflare",
  "hasCity": true,
  "country": "MA"
}
```

### Phase 4 - Infra staging

Tout doit se faire d'abord sur le serveur de staging actuel.

Actions Cloudflare:

1. Mettre le domaine staging derriere Cloudflare en mode proxied.
2. Activer `Rules > Transform Rules > Managed Transforms > Add visitor location headers`.
3. Verifier que l'origin recoit `cf-ipcity` et `cf-ipcountry`.
4. Tester avec `curl` sur staging.
5. Deployer le code sur staging.
6. Valider Playwright.
7. Seulement ensuite, reproduire en production.

## Tests

### Vitest backend

Cas a couvrir:

- `cf-ipcity=Casablanca`, `cf-ipcountry=MA` => message avec Casablanca.
- `cf-ipcity` absent, pays present => message fallback region.
- headers Cloudflare en lowercase/case-insensitive.
- ville trop longue => rejet/fallback.
- caracteres de controle => nettoyage.
- source Vercel future => parse compatible.
- date stable avec fake timers.

### Vitest frontend

Cas a couvrir:

- affiche le message retourne par API.
- ne rend rien si `enabled=false`.
- fermeture via bouton => sessionStorage.
- sessionStorage deja ferme => pas d'affichage.
- `prefers-reduced-motion` => pas de classe animation forte.
- erreur API => pas de crash.

### MSW

Utiliser MSW pour mocker:

```txt
GET /api/promo/location
```

Scenarios:

- Casablanca.
- fallback sans ville.
- disabled.
- erreur 500.

### Playwright

Specs:

```txt
e2e/geo-promo-slide-header.spec.ts
```

Scenarios:

1. Avec headers Cloudflare mockes, le bandeau apparait en haut de la home.
2. Le message contient la date exacte du jour.
3. Le message contient la ville approximative.
4. La fermeture masque le bandeau pendant la session.
5. Sur `/panier`, le bandeau n'apparait pas au premier lot.
6. Mobile 375 px: pas d'overlap avec header, panier, sommaire.

## Runbook staging

### 1. Activer Cloudflare sur staging

- DNS staging en mode proxied.
- SSL/TLS: Full ou Full strict.
- Managed Transform: `Add visitor location headers` active.

### 2. Verifier les headers recus par Next

Ajouter temporairement une route de debug protegee ou utiliser logs serveur pour verifier:

```txt
cf-ipcity
cf-ipcountry
cf-region
cf-timezone
```

Ne pas exposer publiquement cette route en production.

### 3. Deployer sur staging

```bash
cd /var/www/femiglow
sudo ./bin/deploy.sh
```

### 4. Tester manuellement

```bash
curl -I https://staging.femiglow-maroc.com
```

Puis ouvrir:

```txt
https://staging.femiglow-maroc.com/
```

Verifier:

- le bandeau apparait en haut;
- la date est celle du jour;
- la ville est plausible;
- le header reste utilisable;
- le panier et le sommaire ne sont pas recouverts.

### 5. Tester avec headers injectes localement

```bash
curl \
  -H "cf-ipcity: Casablanca" \
  -H "cf-ipcountry: MA" \
  http://127.0.0.1:8011/api/promo/location
```

### 6. Playwright staging

```bash
PLAYWRIGHT_BASE_URL=https://staging.femiglow-maroc.com \
pnpm exec playwright test e2e/geo-promo-slide-header.spec.ts --project=chromium --workers=1
```

### 7. Rollback

Rollback code:

```bash
cd /var/www/femiglow
git revert <commit>
sudo ./bin/deploy.sh
```

Rollback infra:

- Desactiver `Add visitor location headers`.
- Ou passer le flag applicatif `GEO_PROMO_BANNER_ENABLED=false` si ajoute en phase 2.

## Recommendation finale

Choisir Option B maintenant: Cloudflare devant le VPS/LiteSpeed, lecture des headers via une route API dynamique `no-store`, bandeau client dans le layout marketing.

Garder Option A uniquement comme compatibilite future via l'abstraction `resolveVisitorGeo`. Cela donne une solution robuste maintenant sans enfermer le code dans Cloudflare ni Vercel.
