# Scénarios F16 — Parcours opérateur (Gherkin FR)

Persona : **Karim**, opérateur back-office FemiGlow, session admin déjà ouverte
(storageState `.auth/admin.json`).

## Scénario F16-S1 — Créer puis activer un geste d'accueil, vérifier l'effet vitrine (happy)

Contexte : Karim veut lancer un nouveau geste d'accueil et confirmer qu'il n'altère pas le
prix affiché côté cliente.

```
Étant donné que Karim est authentifié et arrive sur /admin/coupons
  Et que le conteneur "coupons-manager" est visible
Quand il saisit dans "Libellé" un libellé unique « Geste d'accueil E2E <horodatage> »
  Et qu'il clique sur « Créer (brouillon) »
Alors une ligne coupon-row apparaît avec ce libellé
  Et sa cellule de statut affiche « Brouillon »
Quand il clique sur « Activer » sur cette ligne
Alors la cellule de statut affiche « Actif »
  Et le bouton « Activer » disparaît de la ligne
Quand il ouvre /kit et fait défiler jusqu'au bloc prix
Alors la ligne de prix affiche « 199 » (parité prix conservée)
```

## Scénario F16-S2 — Consulter les codes de fidélité émis sans jamais voir un numéro en clair (edge PII)

Contexte : Karim doit vérifier qu'un code a bien été émis, mais l'interface ne doit jamais
exposer le téléphone d'une cliente en clair.

```
Étant donné que Karim est sur /admin/coupons
  Et que la section « Codes de fidélité émis » affiche le bouton « Charger »
Quand il clique sur « Charger »
Alors la table coupons-grants-table apparaît
  Et pour chaque ligne grant-row la cellule téléphone est masquée (forme « 06…78 »)
  Et aucune cellule téléphone ne contient 9 chiffres consécutifs
  Et le bouton bascule en « Rafraîchir »
```

## Scénario F16-S3 — Environnement fraîchement semé, aucun code encore émis (edge état vide)

Contexte : sur un environnement neuf, aucune commande n'a généré de grant.

```
Étant donné que Karim est sur /admin/coupons d'un environnement frais
Quand il clique sur « Charger » dans la section codes de fidélité
Alors la table affiche « Aucun code émis. »
  Et le test reste vert (assertion en « ou » : table avec lignes masquées OU message vide)
```

## Scénario F16-S4 — Charte maison sur la note d'accueil (edge charte)

Contexte : un `welcome_auto` actif fait apparaître la note d'accueil sur /kit.

```
Étant donné qu'un coupon welcome_auto est actif
Quand Karim ouvre /kit
Et que la note "coupon-welcome-note" est rendue
Alors son texte contient « geste d'accueil »
  Et ne contient ni « % », ni « ! », ni emoji, ni compte à rebours
```
