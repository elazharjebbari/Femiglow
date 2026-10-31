# 08 — Pourquoi cela devrait marcher

Aucun chiffre de gain n'est promis ici : seul le test A/B le dira. Cette page explique pourquoi chaque changement est raisonnable, sur quoi il repose, et comment il pourrait échouer.

## 1. Logique d'ensemble

Pour commander, une cliente doit voir ce qu'il reste à faire, juger que l'effort est faible, comprendre le coût et trouver le bouton. L'écran actuel gêne ces quatre points. La refonte les traite un par un.

| Frein constaté | Effet probable | Réponse |
|---|---|---|
| Écran long, 6 blocs | L'effort paraît élevé | Un champ à l'arrivée |
| CTA hors écran | Elle ne voit pas la fin | Barre fixe |
| Faux bouton | Elle clique, rien ne se passe | Barre retirée |
| CTA grisé | Le formulaire paraît bloqué | Bouton qui guide |
| Frais tardifs | Déception au dernier moment | Total clair, mesure, stratégie à décider |
| Messages en français pour des arabophones | Blocage possible | Erreurs traduites |

## 2. Justification par décision

| Décision | Raison | Preuve | Risque |
|---|---|---|---|
| Masquer le faux CTA et le double prix | Corrige un bug. Un bouton qui ne fait pas ce qu'il annonce nuit, quel que soit le contexte | **Forte**, constatée ici | Quasi nul |
| Traduire les erreurs | Une erreur illisible bloque | **Forte**, constatée ici | Nul |
| CTA toujours visible | On ne peut pas toucher ce qu'on ne voit pas ; bas d'écran conseillé (`Copywriting.pdf` p. 22) | **Moyenne à forte** | Clavier iOS |
| Adresse après la ville | Réduit le processus visible (`Copywriting.pdf` p. 59), activation au bon moment (`UX.pdf` p. 24) | **Moyenne** | Écran changeant, villes hors liste |
| Note et code repliés | Le facultatif derrière un lien (Baymard, Lu) | **Forte** | Moins de repères pour le livreur |
| Bloc livraison remplacé par une ligne | Bloc compact (`Pricing.pdf` p. 25) | **Moyenne** | Frais moins remarqués, d'où le total |
| Progression avec prénom | Effet de gradient d'objectif (`Copywriting.pdf` p. 41, 25, 44) | **Moyenne** | Prénom mal saisi |
| Assurance collée au CTA | `Copywriting.pdf` p. 17 | **Moyenne** en théorie, **faible** en paiement à la livraison | Faible |
| Texte « ma commande » | `Copywriting.pdf` p. 23 | **Faible à moyenne**, jamais testée en arabe | Faible |
| Grenat | `Color.pdf` p. 4, 10 ; `Attention.pdf` p. 13 | **Moyenne** : c'est une déduction | Moins premium que le noir |
| Icône de colis | Compréhension plus rapide | **Aucune preuve directe** | Faible |
| Micro-animation | `Attention.pdf` p. 17 | **Moyenne** pour l'attention, **aucune** pour la conversion | Agacement, limité par le plafond de 3 |

## 3. Ce qui compte le plus

Par ordre d'impact attendu, selon notre jugement :

1. Faux CTA et double prix : corrections sûres.
2. CTA visible et réduction de l'écran : levier principal.
3. Frais de livraison : peut-être le plus fort, encore inconnu.
4. Couleur, icône, animation : effet secondaire, mais elles renforcent la clarté.

Le bouton est ce qu'on voit, mais il ne porte probablement pas l'essentiel du gain. Une belle animation sur un bouton hors écran ne servirait à rien.

## 4. Hypothèses à tester

| # | Hypothèse | Mesure | Si elle est fausse |
|---|---|---|---|
| H1 | Le CTA hors écran cause une part importante des abandons | `address_cta_visible`, abandon par phase | Chercher une autre cause |
| H2 | Les frais font partir des clientes après le choix de la ville | Abandon par niveau de frais | Garder les frais actuels |
| H3 | La révélation progressive réduit l'abandon avant la ville | `address_city_focus` | Afficher les deux champs |
| H4 | Le grenat ne nuit pas à la perception de la marque | Test visuel, avis clientes | Revenir à l'encre |
| H5 | Une adresse moins contrainte ne dégrade pas la livraison | Taux de livraison | Remettre un guide de saisie |

## 5. Scénarios d'échec

| Scénario | Signal | Réponse |
|---|---|---|
| La barre cache un champ sur iOS | Focus sous la barre, appareils réels | Bloquer la mise en ligne |
| Bug dans le navigateur Instagram | Taux par `user-agent` | Couper la V2 pour ce navigateur |
| Plus de commandes, mais plus de refus | Livraison, rappels | Revoir les champs |
| Les frais deviennent la cause n°1 | Requête 07 §7 | Décision commerciale |
| Aucune différence | Intervalle de confiance | Le problème est ailleurs, sans doute le prix ou la confiance |
| Arabe mal perçu | Passage AR inférieur au FR | Relecture, darija |

## 6. Ordre de grandeur

C'est une illustration, pas une promesse.

| Passage étape 2 | Commandes pour 150 leads par semaine | Gain par semaine |
|---|---:|---:|
| 57 % (actuel) | 86 | — |
| 62 % | 93 | +7 |
| 67 % | 100 | +14 |
| 72 % | 108 | +22 |

Le volume de 150 leads par semaine est celui d'une seule semaine.

## 7. La question des frais

Sur un panier à 99 MAD, 35 MAD pèsent 35 %. Le catalogue va jusqu'à 45 MAD. Cela peut expliquer une partie importante de l'abandon, et aucune mise en page ne le corrigera.

| Option | Pour | Contre |
|---|---|---|
| Garder, en le montrant plus tôt | Pas de coût, pas de surprise | Peut réduire l'intérêt plus haut |
| Livraison offerte dès un certain panier | Message simple | Coût direct |
| Prix produit plus haut, livraison incluse | Pas de frais à l'étape 2, drapeau `freeShipping` existant | Change l'offre et le prix d'appel |
| Frais lissés à un tarif unique | Simple à comprendre | Complexe pour les villes coûteuses |

**Recommandation :** ne rien décider avant une semaine de données. Si l'abandon croît nettement avec les frais, tester une option en A/B séparé. Il ne faut pas mélanger ce test avec celui de la V2.

## 8. Ce que ce dossier ne prouve pas

- Que les principes occidentaux s'appliquent à une cliente marocaine en paiement à la livraison.
- Qu'une interface plus simple se traduit en colis livrés.
- Que les chiffres de Baymard, issus de paniers plus élevés, se transposent.
- Que le comportement des navigateurs intégrés est conforme aux tests sur Safari et Chrome.
