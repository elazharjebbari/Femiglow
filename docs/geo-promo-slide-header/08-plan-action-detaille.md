# Plan d'action detaille

Perimetre obligatoire:

```bash
cd /var/www/femiglow-leads-webhook-multi-step
```

Toutes les etapes ci-dessous sont a executer sur le worktree webhook et a valider sur le serveur de staging actuel.

## Etape 1 - Audit rapide du code existant

- Lire `apps/web/src/app/(marketing)/kit/page.tsx` et `apps/web/src/app/(marketing)/kit/layout.tsx`.
- Lire `apps/web/src/components/layout/Header.tsx`.
- Lire les helpers Components CMS.
- Lire les patterns admin Components CMS pour eviter toute configuration produit via `.env`.
- Lire les conventions MSW, Vitest et Playwright.

Sortie:

- liste finale des fichiers touches;
- confirmation du point d'injection;
- confirmation du chemin admin.

Tests:

- aucun test requis, etape de lecture.

## Etape 2 - Configuration admin et contrats

- Ajouter ou etendre la config admin `global-promo-slide-header`.
- Definir le contrat TypeScript de config publique.
- Definir le contrat de reponse API.
- Fixer le scope public a `/kit` uniquement.
- Interdire les variables d'environnement pour l'activation, le contenu, les tags, le CTA, le theme et les styles.

Tests:

- test config admin `enabled=true/false`;
- test response disabled.

## Etape 3 - Resolver geo

- Implementer parser Cloudflare.
- Implementer abstraction future Vercel.
- Implementer sanitization.
- Implementer fallback.
- Brancher le calcul reduction kit depuis `computePromo()`.

Tests:

- Vitest `geo.test.ts`;
- cas headers absents;
- cas valeurs invalides.

## Etape 4 - Renderer de message

- Implementer templates autorises.
- Implementer format date.
- Implementer fallback sans ville.
- Imposer des templates courts, avec `dateShort`.

Tests:

- Vitest `template.test.ts`;
- variable inconnue;
- ville longue;
- date Casablanca.

## Etape 5 - API route

- Implementer `GET /api/promo/location`.
- Brancher config admin.
- Brancher tags system-driven.
- Ajouter headers cache.
- Ajouter gestion erreurs.

Tests:

- Vitest route;
- curl local avec headers simules;
- MSW pour frontend.

## Etape 6 - Admin component

- Creer ou etendre le composant `global-promo-slide-header`.
- Ajouter champs contenu, CTA, style, visibility, dismissal.
- Ajouter tags, icones et ordre configurable.
- Ajouter valeurs par defaut.
- Ajouter validations.
- Ajouter preview.

Tests:

- test resolver config;
- test validation;
- test preview si suite admin existante.

## Etape 7 - Frontend public

- Implementer `GeoPromoSlideHeader`.
- Implementer slot layout.
- Ajouter styles responsive.
- Ajouter reduced motion.
- Ajouter dismissal.
- Ajouter icones `lucide-react`.
- Ajouter tracking.

Tests:

- Vitest composant;
- MSW success/fallback/disabled/error.

## Etape 8 - Playwright

- Ajouter spec desktop/mobile.
- Tester affichage uniquement sur `/kit`.
- Tester non-affichage checkout et homepage.
- Tester fermeture.
- Tester tags et reduction dynamique.
- Tester ville longue.
- Tester reduced motion.

Tests:

- Playwright chromium.
- Captures si disponible.

## Etape 9 - Build et staging

- Lancer typecheck.
- Lancer build.
- Deployer ou redemarrer staging selon process existant.
- Activer Cloudflare headers sur staging.
- Tester URL publique staging.

Tests:

- smoke homepage;
- smoke `/kit`;
- smoke checkout sans bandeau;
- curl `/api/promo/location`.

## Etape 10 - Rollback

- Documenter rollback par desactivation admin.
- Documenter desactivation admin.
- Documenter desactivation Cloudflare Managed Transform si necessaire.

Definition of done:

- rollback executable sans migration destructive.
