# Plan de developpement

Tous les travaux doivent etre faits depuis:

```bash
cd /var/www/femiglow-leads-webhook-multi-step
```

## Phase 0 - Cadrage technique

1. Verifier l'etat du worktree.
2. Identifier le layout/page `/kit` et les layouts a exclure.
3. Identifier les helpers Components CMS disponibles.
4. Verifier le systeme de tests existant.
5. Confirmer que staging passe par Cloudflare ou documenter l'absence de headers.

Sortie attendue:

- decision finale Cloudflare/Vercel confirmee;
- liste des fichiers a modifier;
- chemin admin et composant de configuration identifies.

## Phase 1 - Backend geolocalisation

Fichiers probables:

- `apps/web/src/lib/promo-slide-header/geo.ts`
- `apps/web/src/lib/promo-slide-header/template.ts`
- `apps/web/src/lib/promo-slide-header/config.ts`
- `apps/web/src/app/api/promo/location/route.ts`

Taches:

1. Implementer le parser Cloudflare.
2. Implementer les fallbacks.
3. Brancher le calcul reduction depuis `getKitProductCached()` + `computePromo()`.
4. Implementer le renderer de template court.
5. Ajouter `Cache-Control: private, no-store`.
6. Ajouter tests unitaires.

Definition of done:

- valeurs invalides rejetees;
- templates inconnus proteges;
- reduction absente si promo inactive;
- pas de stockage IP;
- route stable en absence de headers.

## Phase 2 - Admin et Components CMS

Fichiers probables:

- schemas ou definitions de fields Components CMS;
- seed/config de composant;
- admin preview si necessaire.

Taches:

1. Creer la cle `global-promo-slide-header`.
2. Ajouter les champs config.
3. Ajouter tags de reassurance et ordre configurable.
4. Ajouter valeurs par defaut.
5. Ajouter validations.
6. Ajouter preview desktop/mobile/fallback.

Definition of done:

- un admin peut modifier contenu court, CTA, theme, tags et comportement;
- l'activation est reversible;
- le composant a un etat par defaut non dangereux.

## Phase 3 - Frontend public

Fichiers probables:

- `apps/web/src/components/promo/GeoPromoSlideHeader.tsx`
- `apps/web/src/components/promo/GeoPromoSlideHeaderSlot.tsx`
- `apps/web/src/app/(marketing)/kit/page.tsx` ou `apps/web/src/app/(marketing)/kit/layout.tsx`

Taches:

1. Integrer le slot sur `/kit` uniquement.
2. Fetcher `/api/promo/location`.
3. Gerer loading silencieux, error silencieux et disabled.
4. Gerer dismissal.
5. Respecter reduced motion.
6. Rendre les tags avec icones `lucide-react`.
7. Ajouter tracking.

Definition of done:

- aucun affichage casse si l'API echoue;
- pas de duplication si le composant remonte;
- aucun rendu hors `/kit`;
- pas de chevauchement sur mobile et desktop.

## Phase 4 - Tests et verification

1. Vitest backend.
2. Vitest frontend composant.
3. MSW pour la route API.
4. Playwright desktop/mobile.
5. Build.
6. Verification staging.

## Phase 5 - Stabilisation staging

1. Activer Cloudflare visitor location headers sur staging.
2. Redemarrer le service staging si necessaire.
3. Tester avec headers reels et headers simules.
4. Verifier analytics.
5. Verifier rollback par desactivation admin.
