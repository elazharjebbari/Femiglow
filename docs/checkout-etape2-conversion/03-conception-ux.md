# 03 — Conception de l'expérience

Écrans correspondants : [maquettes/index.html](maquettes/index.html).

## 1. Principe directeur

À chaque instant, un seul geste à faire, et un seul bouton pour le faire.

## 2. Parcours

| État | Visible | Bouton | Geste suivant |
|---|---|---|---|
| **S0 Arrivée** | Progression, titre, ville | « Choisir ma ville » | Toucher le champ ou le bouton |
| **S1 Recherche** | Ville, 3 suggestions, clavier | Masqué derrière le clavier ou au-dessus | Choisir une ville |
| **S2 Ville choisie** | Ville, frais et délai, adresse | « Ajouter mon adresse » | Saisir l'adresse |
| **S3 Prêt** | Les deux champs validés, lien note, total | « Confirmer ma commande », grenat | Toucher le bouton |
| **S4 Envoi** | Tout, figé | « Enregistrement… » | Attendre |
| **S5 Erreur** | Message près du bon champ, ou bandeau réseau | Retour à l'état précédent | Corriger, réessayer |

La cliente passe ensuite à l'écran de remerciement existant.

## 3. Bloc « Mode de livraison »

**Décision : retirer le bloc, garder l'information.**

Supprimer aussi les frais créerait une surprise au moment de payer le livreur. Pour une commande à la livraison, c'est un risque de refus du colis.

| Avant | Après |
|---|---|
| Carte de 105 à 128 px, titre et phrase | Une ligne sous la ville : « Livraison en 24h · 19 MAD » |
| Visible avant la ville, avec un texte générique | Visible seulement une fois la ville connue |
| Le total est dans le récapitulatif, hors de vue | « Total à la réception » juste au-dessus du bouton |

## 4. Révélation de l'adresse

### Condition

Le champ s'ouvre dès qu'**une** de ces conditions est vraie :

1. Une ville est choisie dans la liste.
2. Le texte saisi correspond exactement à une ville.
3. **Le champ perd le focus avec au moins 2 caractères** (ville hors liste).
4. Un brouillon contient déjà une ville ou une adresse (reprise).

La condition 3 est essentielle : sans elle, une cliente d'un petit village serait bloquée, ce qui recréerait une fuite.

### Comportement

- Ouverture en fondu et hauteur, 240 ms, sans déplacer le champ ville.
- Après un choix dans la liste, le curseur passe dans l'adresse et le clavier reste ouvert. À vérifier sur iOS, qui n'autorise le focus que dans le geste de la cliente.
- **Une fois ouvert, le champ ne se referme plus**, même si la ville est modifiée. La saisie reste conservée.
- Avec `prefers-reduced-motion`, ouverture immédiate.
- Le lecteur d'écran annonce le nouveau champ.

### Liste de villes

- Clavier ouvert : 3 lignes de suggestions, sur une seule ligne chacune.
- Le nom suit la langue de la page ; l'autre langue reste recherchable.
- Le prix et le délai restent à droite, pour que le coût ne soit jamais caché.
- L'aide bilingue disparaît : un exemple dans le champ suffit.
- Villes les plus commandées en tête. Aujourd'hui : Casablanca, Marrakech, Tanger, Agadir, Kenitra. Rabat, deuxième ville des commandes, devrait remonter.

## 5. Budget de hauteur

Cible : **écran de 640 px, sans défilement**.

| Élément | S0 | S3 |
|---|---:|---:|
| En-tête du site | 50 | 50 |
| Marges | 12 | 12 |
| Progression | 28 | 28 |
| Titre et sous-titre | 62 | — |
| Ville | 76 | 76 |
| Ligne frais | — | 26 |
| Adresse | — | 80 |
| Lien note | — | 28 |
| Barre d'action | 128 | 194 |
| **Total** | **356** | **494** |

Marge restante à S3 : 146 px sur 640 px. Elle peut accueillir la ligne de code promo (24 px) ou la note ouverte.

Ouvrir la note au livreur peut faire dépasser l'écran ; c'est acceptable car c'est un choix de la cliente, et la barre reste visible.

**Clavier ouvert, écran de 667 px.** Il reste environ 410 px : en-tête 50, ville 76, adresse 80, barre compacte 64. Soit 270 px.

## 6. Ce qui sort de l'écran, et pourquoi

| Élément | Traitement | Justification |
|---|---|---|
| Barre « Je commande » | Masquée dès l'étape 2 | Faux CTA, prix erroné |
| Récapitulatif collant | Retiré de l'étape 2 sur mobile | Le total est dans la barre |
| Indicateur à 3 colonnes | Remplacé par une ligne fine | Gain de 60 px, progression plus claire |
| Badge « Aucun paiement » | Devient une ligne sous le bouton | L'assurance reste collée au CTA |
| Stock | Retiré de l'étape 2 | Déjà vu en amont ; évite le vide de chargement |
| Note au livreur | Derrière un lien | Facultatif, 161 px |
| Code de fidélité | Derrière le même type de lien | Facultatif |
| Bouton Retour | Lien discret dans la progression | Le CTA reste seul en bas |

**Limite assumée.** Kolenda conseille de rappeler le produit avant le prix (`Pricing.pdf` p. 70). La première version y renonce pour gagner de la hauteur. Si la marge de 146 px se confirme sur appareil réel, une miniature de 28 px peut rejoindre la ligne de total.

**Code promo.** Une remise appliquée reste visible sous le total : « Code GLOW99 : −90 MAD ». Une remise qui disparaîtrait ferait douter la cliente.

## 7. Bouton incomplet

Le bouton n'est jamais grisé.

| Situation au tap | Réaction |
|---|---|
| Ville vide | Curseur dans la ville, clavier ouvert |
| Adresse vide | Curseur dans l'adresse |
| Adresse trop courte | Curseur et message sous le champ |
| Tout est valide | Envoi |

L'événement `address_cta_tap_incomplete` mesure ces taps.

## 8. Validation et erreurs

- Message affiché à la sortie du champ ou au tap, jamais pendant la frappe.
- Coche sauge quand un champ est valide.
- Erreurs en bleu, avec message précis, jamais en grenat.
- La saisie n'est jamais effacée.
- En cas d'erreur réseau, le bouton redevient actionnable et la commande n'est pas perdue.

## 9. Mode panneau

`BottomSheet` partage le même `AddressStep`. La barre d'action s'y place en bas du panneau, avec le même contenu. Aucune évolution spécifique n'est prévue pour ce mode, inactif aujourd'hui.

## 10. Desktop

Le problème est mobile. Sur grand écran, la barre fixe n'existe pas : le total et le bouton suivent les champs, dans le flux. La largeur reste celle du formulaire.
