# 02 — Cinq pistes

Maquettes : [maquettes/index.html](maquettes/index.html) ou https://claude.ai/artifact/Fhb5jcZraXvtjyLVxTVQ2T

Chaque piste est notée de 1 à 5 sur cinq critères. Ce sont des jugements argumentés, pas des mesures.

| Critère | Question |
|---|---|
| Clarté | La cliente comprend-elle que son numéro est enregistré et qu'elle sera appelée ? |
| Commandes finies | La piste pousse-t-elle à terminer sur le site (74 % livrés) plutôt qu'à attendre l'appel (42 %) ? |
| Exactitude | Ce qui est affiché est-il vrai dans tous les cas ? |
| Coût et risque | Combien de code, et que peut-il casser ? |
| Petit écran | Le champ ville reste-t-il visible, clavier ouvert, sur 360 × 640 ? |

## Piste 1 — La ligne d'accusé

La phrase de progression devient « Bien reçu, Salma · on vous appelle ». Rien d'autre ne bouge.

| Forces | Faiblesses |
|---|---|
| Aucune hauteur ajoutée | Texte de 13 px en haut, tronqué sur 360 px : facile à manquer |
| Une demi-journée de travail | Pas de numéro, donc pas de relecture |
| Aucun risque sur le clavier | Ne dit pas à quoi sert la ville |

**Pertinence :** utile comme état replié, trop discrète seule. **Reprise en partie.**

## Piste 2 — La carte d'accusé

Une carte verte avec une coche : « C'est noté, Salma. Nous vous appelons au 06 26 62 88 30 pour confirmer votre commande. » Le sous-titre explique le gain de la ville.

| Forces | Faiblesses |
|---|---|
| Lue en premier, dans la couleur « tout va bien » du site | Environ 80 px de plus à l'arrivée |
| Numéro relu par la cliente | « C'est noté » peut laisser croire que tout est fini |
| Commande toujours créée par le bouton : rien ne change en aval | |
| Occupe une place aujourd'hui vide | |

**Pertinence :** répond exactement à la demande, sans toucher au moteur de commande. **Base retenue.**

## Piste 3 — Le suivi en trois temps

Un fil comme un suivi de colis : demande reçue, appel de confirmation, livraison.

| Forces | Faiblesses |
|---|---|
| Explique toute la suite, pas seulement l'appel | Environ 130 px : le champ descend sous le milieu de l'écran |
| Le premier point déjà coché pousse à continuer | Beaucoup à lire avant d'agir |
| | Miroir arabe plus délicat |

**Pertinence :** bonne idée, mieux placée sur l'écran de remerciement. **Gardée pour plus tard.**

## Piste 4 — La commande créée dès l'étape 1

Le numéro suffit à créer la commande. L'étape 2 devient « Complétez la livraison ».

| Forces | Faiblesses |
|---|---|
| « Commande enregistrée » devient exact | Commande sans ville : ni frais ni total |
| Plus d'abandon entre les deux étapes | Stock retiré pour des demandes non qualifiées |
| | Les achats envoyés aux régies changent de sens |
| | Le CRM ne distingue plus commande et panier abandonné |
| | Refonte du moteur de commande |

**Pertinence :** change le métier, pas seulement l'écran. **Écartée**, à étudier à part si le taux de livraison des rappels remonte.

## Piste 5 — L'écran de choix

Un écran entier après l'étape 1 : « C'est noté », puis deux boutons, « Ajouter mon adresse » ou « Je la donnerai par téléphone ».

| Forces | Faiblesses |
|---|---|
| Impossible à manquer | Un tap de plus avant la ville |
| La cliente choisit en connaissance de cause | Offre une sortie vers le parcours le moins rentable |
| | Nouvel état « par téléphone » à gérer partout (CRM, mesure, remerciement) |

**Pertinence :** clair, mais pousse vers les rappels à 42 %. **Écartée.**

## Comparaison

| Piste | Clarté | Commandes finies | Exactitude | Coût et risque | Petit écran | Total / 25 |
|---|---|---|---|---|---|---|
| 1. Ligne d'accusé | 2 | 4 | 5 | 5 | 5 | 21 |
| 2. Carte d'accusé | 5 | 4 | 5 | 4 | 4 | 22 |
| 3. Suivi en trois temps | 4 | 3 | 5 | 3 | 2 | 17 |
| 4. Commande dès l'étape 1 | 5 | 2 | 4 | 1 | 4 | 16 |
| 5. Écran de choix | 5 | 1 | 5 | 2 | 4 | 17 |
| **Retenue : carte qui se replie** | 5 | 4 | 5 | 4 | 5 | **23** |

## Ce que la proposition retenue prend à chacune

| Piste | Élément repris |
|---|---|
| 1 | La ligne courte, comme état replié dès que la saisie commence |
| 2 | La carte, le numéro relu, le sous-titre qui donne la raison |
| 3 | L'idée de dire ce qui se passe ensuite (« pour confirmer votre commande ») |
| 4 | Rien : la commande reste créée par le bouton |
| 5 | Rien : aucune sortie proposée, l'adresse reste simplement facultative |
