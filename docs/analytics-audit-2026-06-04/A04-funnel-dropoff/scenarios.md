# Scénarios — A04 Funnel drop-off

Persona opérateur : **Karim** (voit « 100% de drop-off » et croit que son funnel est cassé… ce qu'il est,
mais pas pour la raison affichée).
Persona QA : **Sara**.

## Scénario A04-S1 — Drop-off 100% entre View et Engage, puis plus rien (reproduction AN-02, GREEN now)
Contexte: dataset prod-like — `view = 1`, et toutes les étapes aval = 0 (cumul strict, cf. A03).
Étant donné `stepCounts = { view:1, engage:0, cta:0, checkout:0, purchase:0 }`
Et que `dropoffToNext = (next!==null && cur>0) ? 1 - next/cur : null` (funnel.ts L219-220)
Quand Karim lit la colonne drop-off
Alors `view → engage = 1 - 0/1 = 1.0` soit **100%** (artefact : pas une vraie chute, l'étape engage
n'est tout simplement jamais instrumentée — `scroll_depth_50`/`cta_impression` = 0 en base)
Et `engage → cta = null` (car `cur = 0`), idem `cta → checkout` et `checkout → purchase`
Et `purchase = null` (dernière étape).
Donc Karim voit « 100% puis — — — » : symptôme exact rapporté en prod (README §0.3).

## Scénario A04-S2 — Le 100% n'est pas un signal métier (edge)
Contexte: il existe pourtant 97 `begin_checkout` et 13 `purchase` réels en base.
Étant donné que ces conversions sont bloquées en amont (cumul strict) et n'atteignent jamais leurs étapes
Quand Karim interprète « 100% de chute view→engage »
Alors il conclut à tort que personne ne s'engage, alors que des dizaines de sessions ont acheté.
Le drop-off est donc **non actionnable** tant que A03 n'est pas corrigé.

## Scénario A04-S3 — Pas de débordement négatif aujourd'hui (edge protection)
Contexte: le cumul strict garantit `next ≤ cur` (monotone par construction du `&&`).
Étant donné n'importe quel dataset
Quand on lit tous les `dropoffToNext`
Alors aucune valeur non-`null` n'est < 0 ni > 1 (la garde `cur > 0` + monotonie l'assurent).
Note QA : après refonte du modèle (A03), re-vérifier cet invariant car un comptage par OR
indépendant pourrait casser la monotonie ⇒ besoin d'un clamp explicite.

## Scénario A04-S4 — Après le fix, le drop-off redevient lisible (spécification, RED→GREEN)
Contexte: fix AN-02 — modèle par max-rank/OR, conversions reconnues.
Étant donné le dataset prod-like (A converti, B panier, C lead)
Quand Karim rouvre la vue drop-off
Alors aucun `dropoffToNext === 1.0` artificiel n'apparaît là où des conversions existent en aval
Et chaque drop-off non-`null` est dans `[0,1]` et monotone
Et une étape réellement non instrumentée s'affiche « non mesurée » (null/flag), pas « 100% ».
