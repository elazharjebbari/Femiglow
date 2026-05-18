# Principes Kolenda et strategie conversion

Source interne consultee: `docs/audit/03-kolenda-bonnes-pratiques.md`, synthese appliquee aux documents Kolenda du dossier `docs/kolenda`.

## Ligne directrice

Le sticky header doit etre un signal de pertinence, pas un signal de liquidation. Il doit arreter l'oeil parce qu'il semble personnel, actuel et bien compose. Il ne doit pas imiter les codes de marketplace: rouge, compteur, clignotement, texte en capitales, urgence artificielle.

## Attention

Regles a appliquer:

- Un seul signal fort par ecran: le slide header ne doit pas concurrencer un hero, une modale ou un badge produit.
- Mouvement bref uniquement a l'apparition: 180 a 260 ms, sans boucle.
- Pertinence personnelle: ville approximative, region ou Maroc selon disponibilite, en format court.
- Pertinence du but: relier le message au rituel, au kit ou a la livraison.

Application:

- Apparition verticale depuis le haut au premier affichage.
- Pas de pulsation.
- Pas de marquee.
- Pas de compteur.
- Pas de repetition agressive apres fermeture.

## Couleur

Regles a appliquer:

- Base encre/sauge/creme coherente avec FemiGlow.
- Accent unique pour le CTA.
- Pas de rouge ou orange promotionnel.
- Contraste WCAG AA minimum, AAA vise pour le texte principal.

Proposition visuelle:

- Fond principal: encre profonde ou sauge tres sombre.
- Texte: creme chaud.
- Accent: sauge clair ou filet lumineux controle.
- CTA: bouton creme/encre ou lien souligne selon densite du header.

## Copywriting

Regles a appliquer:

- Present, phrase tres courte, concrete.
- Pas de superlatifs faibles.
- Pas d'exclamation.
- CTA avec verbe + objet.

Messages recommandes:

- Avec ville: `Offre du {dateShort} - {city}`
- Sans ville: `Offre du {dateShort} - Maroc`
- Variante douce: `{city} - livraison offerte`
- CTA primaire: `Commander`
- CTA alternatif: `Je commande`

Tags recommandes:

- `Livraison gratuite`
- `Paiement a la livraison`
- `Verifiez avant de payer`
- `Livraison partout au Maroc`
- `-{discountPct}%` uniquement si la promotion kit est active dans la source de prix.

Messages a eviter:

- `PROMO FLASH AUJOURD'HUI !!!`
- `Dernieres heures a Casablanca`
- `-50% seulement maintenant`
- `Cliquez vite`
- Phrase longue qui repete tout le discours produit dans le sticky.

## Ecommerce

Le bandeau doit reduire l'effort de decision. Il ne doit pas ajouter une couche de complexite.

Regles:

- Un seul CTA.
- Tags courts et scannables, pas des paragraphes.
- Pas de second lien concurrent sauf fermeture.
- Route CTA stable: ancre commande de `/kit`, par exemple `#commander-femiglow`.
- Affichage uniquement sur `/kit`.

## Luxury

La force visuelle doit venir de la distance et du controle:

- Typographie nette.
- Espacement propre.
- Motion rare.
- Message sobre.
- Aucune preuve sociale de masse.

## UX

Contraintes:

- Hauteur tactile minimale de 44 px.
- Bouton fermeture accessible avec libelle.
- Respect de `prefers-reduced-motion`.
- Aucun chevauchement avec le header principal.
- Dismiss reversible par session ou duree admin, sans modale.

## Hypothese conversion

Le levier principal est la pertinence contextuelle plus la reassurance transactionnelle. La cliente doit comprendre en moins d'une seconde: offre active aujourd'hui, disponible pres de chez elle, livraison offerte, paiement a la livraison, verification avant paiement, reduction active si elle existe. Cette personnalisation doit augmenter le taux de passage vers le formulaire de commande de `/kit` sans degrader la confiance premium.

Mesures recommandees:

- Impression du bandeau.
- Clic CTA.
- Fermeture.
- Page source.
- Ville ou fallback utilise, sans stocker d'adresse IP.
- Conversion post-clic.
