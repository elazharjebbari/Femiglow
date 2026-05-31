# Frontend, UI, UX et design system

## Role du composant

`GeoPromoSlideHeader` est un signal de contexte et d'action sur `/kit` uniquement. Il doit repondre en une ligne compacte a:

- pourquoi maintenant;
- pourquoi c'est pertinent pour moi;
- quelle action je peux faire.

## Structure visuelle

Desktop:

```text
[Sparkles] Offre du 18 mai - Casablanca  [BadgePercent -25%] [Truck Livraison gratuite] [HandCoins Paiement livraison] [ShieldCheck Verifiez avant de payer] [MapPinned Maroc] [Commander] [X]
```

Mobile:

```text
[Sparkles] Offre du 18 mai - Casablanca  [Commander] [X]
[BadgePercent -25%] [Truck Gratuit] [HandCoins A la livraison] [ShieldCheck A verifier]
```

La phrase longue est interdite dans le sticky. Les informations secondaires vivent dans des tags courts.

## Iconographie

Utiliser `lucide-react` si la librairie est deja disponible dans le projet. Icones recommandees:

- `Sparkles`: signal premium discret du message principal.
- `BadgePercent`: reduction dynamique `-X%`.
- `Truck`: livraison gratuite.
- `HandCoins`: paiement a la livraison.
- `ShieldCheck`: verification avant paiement.
- `MapPinned`: livraison partout au Maroc.
- `X`: fermeture.

Regles de style:

- taille 14 a 16 px;
- stroke 1.75 ou 2 selon rendu avec la fonte;
- alignement optique sur baseline du texte;
- icone dans un tag seulement si elle reduit l'effort de scan;
- pas d'icones multicolores;
- pas d'emoji;
- pas d'icone alarme, timer ou sirene.

## Comportement sticky

Options possibles:

1. Bandeau sticky au-dessus du header principal.
2. Bandeau integre dans le header principal.

Decision:

- Phase 1: bandeau distinct au-dessus du header, rendu uniquement sur `/kit`.
- Raison: meilleure separation des responsabilites, rollback simple, mesure analytics claire.

Contraintes:

- `z-index` inferieur ou compatible avec le header existant.
- Pas de chevauchement avec cart button, navigation, sommaire ou chat.
- Hauteur stable pour eviter les sauts de layout.
- Fermeture qui reduit proprement l'espace occupe.

## Motion

Animation recommandee:

- entree: translateY de -100% a 0;
- duree: 180 a 260 ms;
- easing: sobre, non rebondissant;
- sortie: fade/height collapse court;
- reduced motion: aucun mouvement, affichage instantane.

Interdit:

- clignotement;
- marquee;
- pulse infini;
- shaker CTA;
- compteur.

## Design tokens

Tokens a utiliser ou creer selon le design system existant:

- `--promo-header-bg`
- `--promo-header-fg`
- `--promo-header-accent`
- `--promo-header-cta-bg`
- `--promo-header-cta-fg`
- `--promo-header-height`
- `--promo-header-tag-bg`
- `--promo-header-tag-fg`

Les tokens doivent mapper vers la palette FemiGlow, pas introduire une nouvelle famille chromatique.

## Typographie

- Texte principal: 13 a 14 px selon viewport.
- Tags: 11 a 12 px, libelles courts.
- CTA: poids medium, pas de capitales agressives.
- Letter spacing: 0.
- Line-height confortable sur mobile.

## Accessibilite

Obligatoire:

- `role="region"` avec `aria-label`.
- Bouton fermer avec libelle explicite.
- CTA focus-visible.
- Navigation clavier.
- Respect contrastes.
- Reduced motion.

## Contenu

Bon:

- `Offre du 18 mai - Casablanca`
- `Casablanca - livraison offerte`
- `Commander`
- `-25%`
- `Livraison gratuite`

Acceptable:

- `Offre du 18 mai - Maroc`
- `Paiement a la livraison`

Mauvais:

- `PROMO AUJOURD'HUI !!!`
- `Derniere chance`
- `Plus que 2 heures`
- `Aujourd'hui le 18 mai 2026, une attention FemiGlow accompagne votre rituel dans la region de Casablanca.`

## Analytics frontend

Evenements proposes:

- `geo_promo_header_impression`
- `geo_promo_header_click`
- `geo_promo_header_dismiss`

Payload minimal:

```json
{
  "campaignKey": "geo_promo_default",
  "route": "/kit",
  "geoMode": "city",
  "theme": "ink",
  "discountPct": 25
}
```

Ne pas envoyer:

- IP;
- latitude;
- longitude;
- header brut Cloudflare.
