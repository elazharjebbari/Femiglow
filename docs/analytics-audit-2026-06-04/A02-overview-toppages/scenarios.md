# Scénarios A02 — Vue d'ensemble · Top pages

Persona : **Karim**, opérateur, veut savoir quelle page attire le plus pour y concentrer ses tests A/B.
Horloge figée `NOW = 2026-06-03T12:00:00Z`, période 90 jours.

## Scénario A02-S1 — Top pages obstinément vide (reproduction, rouge avant fix)
Contexte: 90 jours de trafic mais l'app n'émet que `view_item` sur `/kit` (et ses sections), jamais de
`page_view`.
Étant donné un `memoryStore` semé avec `prod_realistic` (5 `view_item` sur `/kit`, 1 sur `/journal`)
Et la période « 90 derniers jours »
Quand Karim ouvre l'onglet « Vue d'ensemble » et regarde le bloc « Top pages »
Alors le tableau est entièrement vide (`topPages === []`) car `topPages()` ne compte que les `page_view`,
qui valent 0
Et Karim ne peut prioriser aucune page, alors que `/kit` a reçu 5 vues produit.

## Scénario A02-S2 — /kit remonte enfin en tête (spécification, vert après fix)
Contexte: le fix compte `view_item` (+ `page_route`) comme vue de page.
Étant donné le même dataset `prod_realistic`
Quand `getOverviewData` est appelé
Alors `topPages[0].pageRoute === '/kit'` avec `pageViews > 0`
Et le tableau est trié par `pageViews` décroissant (`/kit` avant `/journal`)
Et `sessions` ≤ `pageViews` pour chaque ligne.

## Scénario A02-S3 — Le mixte trompeur (edge)
Contexte: une page a un `page_view` historique, une autre n'a que des `view_item`.
Étant donné `mixed_pageview` : 1 `page_view` sur `/journal` + 5 `view_item` sur `/kit` + des `view_item`
sur `/maison`
Quand Karim regarde « Top pages » AVANT fix
Alors seul `/journal` apparaît, `/kit` et `/maison` (pourtant plus consultées) sont invisibles
Et [SPEC après-fix] les trois routes apparaissent, triées par volume réel de vues.

## Scénario A02-S4 — État vide légitime (edge, frontière)
Contexte: aucune donnée sur la période.
Étant donné un `memoryStore` vide
Quand `getOverviewData` est appelé
Alors `topPages === []` sans erreur, et l'UI affiche « Aucune page vue sur la période » (état vide
explicite, non confondu avec le bug).
