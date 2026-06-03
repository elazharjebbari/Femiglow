# N07 — Scénarios (Gherkin FR)

Persona : **Karim**, opérateur, édite la navigation admin dans `/admin/settings` (onglet Navigation).
Aucun réseau ici (la sauvegarde est N08) : on observe l'état local de l'éditeur.

## Scénario N07-S1 — Karim réordonne et ajoute un onglet (happy)
Contexte: l'éditeur affiche 3 items (Tableau de bord, Coupons, Leads).
Étant donné que la ligne « Tableau de bord » a son bouton « Monter » désactivé
Quand Karim clique « Descendre » sur « Tableau de bord »
Alors « Coupons » remonte en première position et les numéros sont réindexés 1,2,3
Quand il clique « + Ajouter un item »
Alors une 4ᵉ ligne « Nouvel item » apparaît et le compteur affiche « 4 items »
Et le bouton Enregistrer devient actif (état modifié).

## Scénario N07-S2 — Aller-retour neutre (edge dirty)
Contexte: l'éditeur est à l'état initial.
Étant donné que Karim clique « + Ajouter un item »
Quand il clique aussitôt « Suppr. » sur cette nouvelle ligne
Alors le tableau redevient identique à l'état initial
Et le bouton Enregistrer redevient inactif (non modifié).

## Scénario N07-S3 — Clé dupliquée bloquée côté client (edge validation)
Contexte: Karim renomme par erreur la clé de « Leads » en « dashboard ».
Étant donné deux lignes partageant la clé « dashboard »
Quand il clique « Enregistrer »
Alors aucun appel réseau n'est émis
Et un message « 1 erreur(s) à corriger. » s'affiche
Et la liste récapitulative contient « Clé "dashboard" dupliquée. ».

## Scénario N07-S4 — href mal formé signalé par ligne (edge champ)
Contexte: Karim saisit « admin/promos » (sans `/` initial) dans Href de « Coupons ».
Étant donné cette saisie
Quand il clique « Enregistrer »
Alors la cellule Href de la ligne « Coupons » passe en `aria-invalid="true"` avec un anneau rouge
Et le message « href doit commencer par /. » s'affiche sous le champ
Et aucune sauvegarde réseau n'est tentée.

## Scénario N07-S5 — Suppression au milieu (edge renumérotation)
Contexte: 3 items numérotés 1,2,3.
Étant donné que Karim clique « Suppr. » sur la 2ᵉ ligne (« Coupons »)
Quand la ligne disparaît
Alors il reste 2 lignes numérotées 1,2 (positions internes 0,1, contiguës)
Et le compteur affiche « 2 items ».
