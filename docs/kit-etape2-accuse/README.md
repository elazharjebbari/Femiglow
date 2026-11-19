# Étape 2 de /kit — accusé « C'est noté, on vous appelle »

Dossier du 18/11/2026. Branche `feat/kit-etape2-accuse`, partie de `fix/kit-bugs-graves` (`532ceebd`), la branche servie en production.

## En bref

- **Le problème.** Une cliente qui donne son prénom et son numéro, puis quitte l'écran d'adresse, est appelée par l'équipe. Rien à l'étape 2 ne lui dit que son numéro est enregistré : l'appel la surprend.
- **La réponse.** À l'arrivée sur l'étape 2, une carte verte dit : « C'est noté, Salma. Nous vous appelons au 06 26 62 88 30 pour confirmer votre commande. » Le sous-titre donne la raison de continuer : avec la ville, l'appel est plus rapide.
- **Ce qui ne change pas.** La commande est toujours créée par le bouton grenat. Prix, frais, stock, achats envoyés à Meta, TikTok et Google : identiques.
- **Le garde-fou.** La carte ne s'affiche que si la fiche est bien partie au serveur et si le numéro est lisible. On ne dit pas « c'est noté » quand ce n'est pas vrai.
- **Le réglage.** Part de visiteuses dans l'admin (100 par défaut), coupe-circuit serveur, `?ack=off` pour comparer.

## Lire le dossier

| Fichier | Contenu |
|---|---|
| [01-audit.md](01-audit.md) | Fonctionnement réel du formulaire, écran actuel, constats |
| [02-propositions.md](02-propositions.md) | Cinq pistes, forces, faiblesses, pertinence, notes |
| [03-proposition-retenue.md](03-proposition-retenue.md) | Parcours, états, design, règles, risques |
| [04-developpement.md](04-developpement.md) | Fichiers, réglages, mesure, ce qui n'est pas touché |
| [05-textes.md](05-textes.md) | Textes en français, arabe et anglais |
| [06-tests.md](06-tests.md) | Tests écrits, résultats, ce qui reste à vérifier sur un vrai téléphone |
| [07-plan-action.md](07-plan-action.md) | Plan par étapes et état d'avancement |
| [08-runbook-agent.md](08-runbook-agent.md) | Procédure pas à pas pour un agent : mise en ligne, contrôle, retour arrière |
| [maquettes/index.html](maquettes/index.html) | Maquettes des cinq pistes et de la proposition retenue |
| `captures/` | Écran avant et après, en français et en arabe |

Maquettes en ligne : https://claude.ai/artifact/Fhb5jcZraXvtjyLVxTVQ2T

## Décisions à prendre

| # | Décision | Recommandation |
|---|---|---|
| 1 | Part de visiteuses à l'ouverture | 100 % comme demandé. Pour mesurer proprement, passer à 50 pendant 7 jours dans l'admin |
| 2 | Arabe | Faire relire les trois phrases de [05-textes.md](05-textes.md) par une personne native |
| 3 | Appel des fiches abandonnées | L'envoi au CRM est actif, 5 minutes après l'étape 1 (vérifié le 18/11). Confirmer que l'équipe appelle bien toutes ces fiches : c'est ce qui rend la promesse vraie |
| 4 | Scripts d'appel de l'équipe | Ouvrir l'appel par « vous avez laissé votre numéro sur FemiGlow », pour répondre à ce que la cliente a lu |

## Limites

- La base de production n'a pas pu être lue pendant ce travail (accès refusé à l'agent). Les chiffres cités viennent des mesures précédentes : 43 % de départs à l'étape 2 (31/10), 74 % de colis livrés pour les commandes finies contre 42 % pour les rappels (Trello, 05/11). `bash bin/deployer-accuse.sh mesurer` donne l'état actuel.
- Aucun essai sur un vrai téléphone : le clavier réel et les navigateurs intégrés d'Instagram et de Facebook ne sont pas couverts par les tests.
- L'effet sur les commandes n'est pas connu d'avance. Le risque principal est décrit dans [03-proposition-retenue.md](03-proposition-retenue.md) §6.
