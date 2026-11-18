# 03 — Proposition retenue : la carte d'accusé qui se replie

## 1. Principe

Dire trois choses à la cliente, au moment où elle vient de donner son numéro :

1. **C'est enregistré.** « C'est noté, Salma. »
2. **Voici la suite.** « Nous vous appelons au 06 26 62 88 30 pour confirmer votre commande. »
3. **Voici pourquoi continuer.** « Avec votre ville, l'appel de confirmation est plus rapide. Vous payez à la réception. »

Celle qui quitte sait qu'elle sera appelée. Celle qui reste sait à quoi sert le champ suivant.

## 2. Parcours et états

| Moment | Accusé | Sous-titre | Reste de l'écran |
|---|---|---|---|
| Arrivée | Carte complète | « Avec votre ville, l'appel de confirmation est plus rapide. Vous payez à la réception. » | Champ ville, barre « Choisir ma ville » |
| Premier contact avec le champ ville (écran tactile) ou première lettre tapée | Une ligne : « Noté · on vous appelle au 06 26 62 88 30 » | « Vous payez à la réception. » | Le champ et les suggestions gardent la place |
| Ville choisie | Une ligne | Masqué, comme avant | Frais, délai, champ adresse |
| Adresse saisie | Une ligne | Masqué | Bouton grenat « Confirmer ma commande » |
| Retour sur la page après un départ | Carte complète sans ville, une ligne si la ville était déjà saisie | — | Étape 2 restaurée |
| Enregistrement en échec | Rien | Texte d'avant | Bandeau « Une information n'a pas pu être enregistrée » déjà existant |

Captures : [arrivée](captures/apres-arrivee.png), [ville en saisie](captures/apres-ville-en-saisie.png), [prête](captures/apres-prete.png), [arabe](captures/apres-arrivee-ar.png).

## 3. Règles

| Règle | Raison |
|---|---|
| La carte se replie et ne se redéploie jamais | La mise en page ne doit pas rebondir sous le doigt |
| Sur ordinateur, le focus seul ne replie pas | Pas de clavier à l'écran, donc pas de place à libérer |
| Le numéro est affiché en entier, au format `06 12 34 56 78` | Elle le relit. « Modifier » est juste au-dessus |
| Aucun délai chiffré dans la carte | Le délai d'appel dépend de l'équipe |
| Jamais « commande confirmée » | Faux avant le bouton grenat, et invite à partir |
| Aucun bouton « je donnerai mon adresse par téléphone » | Ne pas ouvrir une sortie vers le parcours livré à 42 % |
| Affichée seulement si la fiche est partie et si le numéro est lisible | Ne rien affirmer de faux |

## 4. Design

| Élément | Choix |
|---|---|
| Fond de la carte | Sauge clair (`--color-sauge-soft`), la couleur « tout va bien » du site |
| Pastille | Disque sauge foncé de 28 px, coche crème |
| Titre | 15 px, gras, encre |
| Phrase | 13,5 px, encre adoucie ; numéro en gras, chiffres à largeur fixe, jamais coupé |
| Ligne repliée | 13 px, sauge foncé, coche de 14 px |
| Animation | Entrée de 320 ms, une seule fois ; rien si l'appareil demande moins d'animations |
| Hauteur | Environ 100 px à l'arrivée, 20 px repliée |
| Arabe | Carte en miroir, numéro de gauche à droite (`<bdi dir="ltr">`) |

Le grenat reste réservé au bouton de confirmation et au prix promotionnel.

## 5. Pourquoi cela devrait marcher

| Mécanisme | Explication |
|---|---|
| Attente alignée sur la réalité | L'appel n'est plus une surprise : la cliente a lu qu'il viendrait et sur quel numéro |
| Engagement déjà pris | « C'est noté » confirme un premier pas ; on termine plus volontiers ce qu'on a commencé |
| Raison concrète | « L'appel est plus rapide » est un gain pour elle, pas pour le site |
| Relecture du numéro | Une erreur vue se corrige ; une erreur invisible donne une cliente injoignable |

Ce sont des hypothèses. La mesure tranchera.

## 6. Risques

| Risque | Gravité | Parade |
|---|---|---|
| Moins de commandes finies sur le site : « c'est noté » peut donner l'impression que tout est fait | Élevée. Une commande finie est livrée à 74 %, un rappel à 42 % | Texte « pour confirmer », sous-titre qui donne une raison, mesure par bras, retour en un réglage |
| La carte s'affiche avant la réponse du serveur | Faible. L'étape 2 s'ouvre sans attendre l'enregistrement ; si celui-ci échoue ensuite, la carte disparaît | Comportement voulu : pas d'attente ajoutée. Les échecs d'enregistrement sont rares et déjà signalés |
| Promesse d'appel non tenue | Moyenne | L'envoi au CRM est actif (5 minutes). Reste l'organisation de l'équipe : toutes ces fiches doivent être appelées |
| Arabe approximatif | Moyenne | Relecture native, voir [05-textes.md](05-textes.md) |
| Clavier réel plus haut que prévu | Faible | Carte repliée au premier contact ; essai sur vrai téléphone à faire |

## 7. Comment juger

| Indicateur | Où le lire | Bon signe |
|---|---|---|
| Part des fiches qui deviennent commandes sur le site | `bash bin/deployer-accuse.sh mesurer`, premier tableau | Stable ou en hausse par rapport aux jours d'avant |
| Étapes 2 terminées, avec et sans accusé | Même commande, second tableau (seulement si la part est entre 1 et 99) | Bras « avec accusé » au moins égal |
| Taux de décroché et de confirmation des rappels | Trello | En hausse |
| Numéros faux | Trello | En baisse |

Seuil d'alerte : si la part de commandes baisse de plus de 3 points sur 3 jours pleins à trafic comparable, couper (`step2AckSharePct` à 0) et revoir le texte.
