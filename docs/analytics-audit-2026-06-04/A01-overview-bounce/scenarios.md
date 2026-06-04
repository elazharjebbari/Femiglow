# Scénarios A01 — Vue d'ensemble · Taux de rebond + consentement

Persona : **Karim**, opérateur FemiGlow, regarde l'onglet « Vue d'ensemble » pour juger la qualité du
trafic avant d'augmenter le budget pub. Horloge figée : `NOW = 2026-06-03T12:00:00Z`, période 90 jours.

## Scénario A01-S1 — Le rebond reste désespérément vide (reproduction, rouge avant fix)
Contexte: la base contient 30 jours de trafic réaliste (339 `view_item`, 97 `begin_checkout`, 13
`purchase`…) mais **aucun** `page_view` — l'app émet `view_item` sur /kit, jamais un page_view générique.
Étant donné un `memoryStore` semé avec la fixture `prod_realistic`
Et la période sélectionnée « 90 derniers jours », device « tous »
Quand Karim ouvre l'onglet « Vue d'ensemble »
Alors la carte « Taux de rebond » affiche « — » (la fonction `bounceRate` renvoie `null` car aucune
session n'a de `page_view`)
Et la carte « Pages vues » affiche 0 alors que 339 produits ont été consultés
Et Karim conclut à tort que l'analytics est cassé (il l'est, mais pas là où il croit).

## Scénario A01-S2 — Après fix : un rebond plausible dérivé de view_item (spécification, vert après fix)
Contexte: le fix reconnaît `view_item` (+ `page_route`) comme « page vue ».
Étant donné le même `memoryStore` semé avec `prod_realistic`
Et 3 sessions : s1 voit une seule fois /kit, s2 voit /kit puis /kit#offre (2 routes), s3 voit une seule
fois /kit
Quand `getOverviewData` est appelé
Alors le taux de rebond vaut 2/3 (s1 et s3 ont vu une seule page, s2 deux)
Et la carte affiche « 67 % » au format FR
Et la comparaison vs période précédente affiche un delta cohérent (pas `null` si la période -1 a des
données).

## Scénario A01-S3 — Incohérence de consentement entre onglets (edge, AN-07)
Contexte: un visiteur a refusé l'analytics (`analytics_storage='denied'`) mais ses events sont stockés.
Étant donné un dataset `mixed_consent` : 2 sessions « granted » + 1 session « denied »
Quand Karim compare le nombre de sessions de « Vue d'ensemble » (3) à celui implicite de l'onglet
Checkout (2, filtré `granted`)
Alors les deux onglets affichent des totaux différents sur le même trafic
Et la décision est faussée car l'overview gonfle le dénominateur avec du trafic non consenti
Et [SPEC après-fix] overview filtre lui aussi `granted` → 2 sessions, chiffres réconciliés.

## Scénario A01-S4 — Vrai état vide vs faux zéro (edge, frontière)
Contexte: aucune donnée sur la période.
Étant donné un `memoryStore` vide
Quand `getOverviewData` est appelé
Alors `bounceRate.current` vaut `null` (pas `0`) et l'UI affiche « — »
Et le delta reste `null` (pas de division par zéro).
