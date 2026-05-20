# Synthese executive

## Probleme a resoudre

FemiGlow veut afficher sur `/kit` uniquement un header promotionnel sticky, elegant et contextualise, capable de dire en quelques mots qu'une offre est active aujourd'hui dans la region approximative de la cliente. Le bandeau doit etre administrable: contenu par defaut, contenu dynamique, tags de reassurance, CTA, theme visuel, regles d'affichage, comportement de fermeture et preview.

L'objectif principal est la conversion. L'objectif secondaire est la maintenabilite: le composant ne doit pas devenir un hack visuel dans le layout, ni une logique de geolocalisation dispersee dans plusieurs fichiers.

## Recommandation

Construire un systeme en trois couches:

1. `GeoPromoSlideHeader` cote frontend: composant client sticky limite a `/kit`, dismissible, accessible, anime seulement a l'entree.
2. `GET /api/promo/location` cote backend: route privee qui lit les headers de localisation, nettoie les valeurs, applique un fallback et renvoie une reponse stable.
3. Configuration admin via Components CMS: cle `global-promo-slide-header`, champs valides, preview desktop/mobile et valeurs par defaut seedables.

## Pourquoi cette approche

- Elle respecte le contexte actuel VPS/LiteSpeed: Cloudflare est plus adapte que Vercel tant que l'hebergement n'est pas Vercel.
- Elle evite de transformer le layout marketing en rendu dynamique par visiteur.
- Elle isole les risques de cache: la ville approximative est resolue dans une API `private, no-store`.
- Elle permet un fallback robuste si les headers geo sont absents.
- Elle garde le composant admin-compatible avec l'ecosysteme existant.

## Hors scope phase 1

- A/B testing multivariant complet.
- Personnalisation individuelle par compte client.
- Geolocalisation navigateur HTML5.
- Promotion agressive avec compte a rebours.
- Affichage hors `/kit` tant que l'impact UX n'est pas mesure.

## Critere de succes

La fonctionnalite est consideree prete pour staging quand:

- Le bandeau apparait uniquement sur `/kit`.
- Le message principal reste court et affiche une date courte plus une ville ou region fallback.
- Les tags affichent livraison gratuite, paiement a la livraison, verification avant paiement, livraison partout au Maroc et reduction dynamique `-X%` si une promotion kit est active.
- La fermeture est persistante selon la regle admin.
- Le header principal, le panier, le chat et le contenu ne se chevauchent pas.
- Les tests Vitest, MSW et Playwright cibles passent.
- Le runbook staging a ete execute depuis `/var/www/femiglow-leads-webhook-multi-step`.
