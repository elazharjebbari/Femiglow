# UX Specification

## Intention UX

L’interface doit ressembler à un atelier éditorial calme, pas à un panneau de contrôle IA agressif. L’utilisateur doit sentir qu’il prépare une publication de maison de soin, pas qu’il pousse du contenu en masse.

## Navigation

Tabs recommandés :

1. Créer
2. Idées
3. Brouillons
4. Calendrier
5. Publiés
6. Réglages

## Wizard “Créer”

Étapes :

1. Intention
2. Source
3. Format
4. Brief
5. Génération
6. Review
7. Programmation

### Étape 1 — Intention

Contrôles :

- pilier éditorial ;
- objectif ;
- campagne ;
- canal ;
- format ;
- niveau de conversion souhaité.

### Étape 2 — Source

Sources :

- produit ;
- média ;
- article journal ;
- témoignage ;
- idée libre ;
- campagne saisonnière.

### Étape 3 — Format

Formats :

- Instagram post 4:5 ;
- story 9:16 ;
- reel script court ;
- carousel 5 à 7 slides ;
- Facebook post.

### Étape 4 — Brief

Le brief est éditable avant génération. C’est important : la fondatrice doit pouvoir corriger la stratégie avant que l’IA ne produise.

### Étape 5 — Génération

Afficher 3 variantes maximum :

- sobre ;
- sensorielle ;
- conversion douce.

### Étape 6 — Review

Panneau gauche : contenu.
Panneau centre : preview.
Panneau droit : score, violations, actions.

### Étape 7 — Programmation

Choisir :

- compte Postiz ;
- date/heure UTC convertie en heure locale ;
- tags ;
- UTM ;
- mode : draft Postiz ou schedule.

## Wireframe texte

```txt
+---------------------------------------------------------------+
| FemiGlow Admin / Content Studio                               |
+-------------------+-------------------------------------------+
| Créer             | Intention                                 |
| Idées             | [Pilier] [Objectif] [Format] [Canal]      |
| Brouillons        |                                           |
| Calendrier        | Source                                    |
| Publiés           | [Produit] [Media] [Journal] [Libre]       |
| Réglages          |                                           |
|                   | Brief                                     |
|                   | [Angle éditorial........................] |
|                   | [Preuve.................................] |
|                   |                                           |
|                   | [Générer 3 propositions]                 |
+-------------------+-------------------------------------------+
```

## Style UI

- Reprendre admin existant mais l’adoucir : fond `stone-50`, surfaces blanches, accents sauge.
- Pas de gradient IA.
- Pas d’icônes futuristes.
- Labels simples : “Proposer”, “Revoir”, “Approuver”, “Programmer”.
- Score de marque en langage naturel, pas seulement chiffres.

