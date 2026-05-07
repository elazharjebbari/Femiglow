# 2. Suivre les leads

Un **lead** est une personne qui a manifesté de l'intérêt pour FemiGlow
sans (encore) acheter : inscription newsletter, formulaire de contact,
demande sur Instagram, etc.

## La page liste

`/admin/leads` affiche tous les leads, du plus récent au plus ancien.

Tu peux :

- **Filtrer par statut** : `Nouveau`, `Contacté`, `Qualifié`, `Converti`,
  `Perdu`, `Archivé`.
- **Filtrer par date** : du jj/mm/aaaa au jj/mm/aaaa.
- **Chercher** dans email, nom, téléphone (champ unique en haut).
- **Paginer** (25 leads par page par défaut).

## Le cycle de vie d'un lead

```
Nouveau → Contacté → Qualifié → Converti
                              ↘ Perdu
                              ↘ Archivé
```

- **Nouveau** : tu n'as pas encore parlé avec elle.
- **Contacté** : tu lui as écrit ou répondu.
- **Qualifié** : la conversation est sérieuse, l'envie est là.
- **Converti** : elle a acheté un kit (auto-rempli quand le webhook
  Stripe arrive en Phase 2 — pour l'instant à la main).
- **Perdu** : elle a explicitement dit non.
- **Archivé** : on n'a plus rien à faire ensemble (silence prolongé,
  doublon, etc.).

Les transitions invalides (par exemple « Converti → Nouveau ») sont
bloquées par la console.

## La page détail

Clique sur n'importe quelle ligne pour ouvrir `/admin/leads/{id}`. Tu y
trouves :

- les coordonnées du lead,
- l'historique des changements de statut et notes (timeline),
- le bouton **Changer le statut**,
- le formulaire **Ajouter une note interne** (visible uniquement par
  toi et l'équipe — jamais par la cliente).

## Capture écran (à venir)

> ![Liste leads](./screenshots/02-leads-list.png)
> ![Détail lead](./screenshots/02-leads-detail.png)
