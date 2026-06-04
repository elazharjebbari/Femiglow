# A04 — Funnel drop-off (artefact « 100% » entre chaque étape)

## Rôle & surface
Sous-vue de l'onglet **Funnel** : les taux de chute entre étapes adjacentes. Source :
`apps/web/src/lib/analytics/queries/funnel.ts`, champ `FunnelStep.dropoffToNext` calculé L219-220 :
```
dropoffToNext: next !== null && cur > 0 ? 1 - next / cur : null
```
Affichage : `components/admin/analytics/funnel/FunnelDropOff.tsx`. Pour l'opérateur : « quel %
des sessions de l'étape N ne passent pas à l'étape N+1 ».

## Fonctionnement optimal (ce qui DOIT se passer)
`dropoffToNext` mesure une **chute réelle** : sur l'étape `view` avec `cur` sessions et `engage` avec
`next` sessions, `dropoff = 1 - next/cur ∈ [0,1]`. Un drop-off de 100% (`1.0`) ne doit survenir que si
**réellement** aucune session de l'étape N n'atteint N+1 — pas comme artefact d'une étape downstream
structurellement vide. Quand l'étape N+1 n'est **pas instrumentée** (event absent), l'UI doit le
signaler (« étape non mesurée ») plutôt qu'afficher un drop-off de 100% trompeur. Sémantique attendue :
`dropoff ∈ [0,1]` clampé, `null` quand `cur=0` (déjà le cas), et idéalement `null`/flag quand l'étape
aval est non instrumentée.

## Contrat I/O
- Entrée : identique à A03 (`getFunnelOverview`).
- Sortie : pour chaque `FunnelStep`, `dropoffToNext ∈ [0,1] | null`.
  - `null` ssi `next === null` (dernière étape `purchase`) **ou** `cur === 0`.
  - sinon `1 - next/cur`.
- `progressionFromPrevious = prev>0 ? cur/prev : null` (lecture inverse, L217-218).

## Cas limites & non-happy-path — l'artefact (preuves DB)
- Conséquence directe de A03/AN-02 : à cause du cumul strict, `engage = cta = checkout = purchase = 0`
  alors que `view = N > 0`.
- Sur l'étape `view` : `cur = N > 0`, `next = stepCounts.engage = 0` ⇒ `dropoffToNext = 1 - 0/N =
  **1.0** (100%)`. **Artefact** : 100% de chute affiché entre view→engage, alors que la cause n'est pas
  une vraie chute mais une **étape aval vide par construction** (events engage jamais émis, DB=0).
- Sur les étapes `engage/cta/checkout` : `cur = 0` ⇒ branche `cur > 0` fausse ⇒ `dropoffToNext = null`
  (pas 100%, mais `null`). Donc le tableau de drop-off affiche : `view→engage = 100%`, puis
  `engage→cta = null`, `cta→checkout = null`, `checkout→purchase = null`. L'opérateur lit « 100% puis
  rien » — incompréhensible (symptôme rapporté §0.3 du README).
- `purchase` : `next = null` ⇒ `dropoffToNext = null` (correct, dernière étape).
- Pas de clamp explicite : si une régression de modèle rendait `next > cur` (ex. comptage non monotone),
  `1 - next/cur` deviendrait **négatif** — non borné. À couvrir (invariant `dropoff ∈ [0,1]`).

## Direction de fix (cf. findings-register AN-02)
Le drop-off est **dérivé** : il redevient correct une fois le modèle de funnel corrigé (A03). En plus :
clamp `dropoff` dans `[0,1]` ; distinguer « 0 par vraie chute » de « N+1 non instrumentée » (flag /
`null` dédié) pour ne pas afficher un 100% trompeur.

## Invariants couverts
- INV (borne) : `dropoffToNext ∈ [0,1] ∪ {null}`.
- INV (null sémantique) : `null` pour la dernière étape et pour `cur=0`.
- INV (monotonie) : `next ≤ cur` ⇒ `dropoff ≥ 0` (sera garanti par le fix A03).
- Lacune : **AN-02** (artefact 100% par étape aval vide).

## Critères d'acceptation (observables)
- `[reproduction]` Dataset prod-like (view>0, downstream=0) ⇒ `steps.view.dropoffToNext === 1.0`.
- `[reproduction]` `steps.engage.dropoffToNext === null` et `steps.cta.dropoffToNext === null`
  (car `cur=0`).
- `[reproduction]` `steps.purchase.dropoffToNext === null` (dernière étape).
- `[SPEC après-fix]` Avec funnel corrigé, `view→…→purchase` ⇒ chaque `dropoffToNext ∈ [0,1]`, aucun
  `1.0` artificiel ; monotonie ⇒ jamais négatif.
- `[SPEC après-fix]` Étape aval non instrumentée ⇒ `dropoffToNext === null` (ou flag), pas `1.0`.

## Points à vérifier — tous points de vue
- **Backend** : formule L219-220 ; clamp `[0,1]` ; sémantique `null` vs `1.0` ; dépendance au modèle A03.
- **Frontend** : `FunnelDropOff.tsx` rend `1.0` comme « 100% » vs `null` comme « — / non mesuré ».
- **UI/UX** : ne pas afficher un 100% rouge alarmant quand l'étape aval est juste non instrumentée.
- **Data** : `next`/`cur` issus de `stepCounts` (dépend du cumul A03).
- **A11y / i18n** : pourcentages formatés FR ; `aria` distinguant « 100% » de « non mesuré ».
