# F03 — Stats d'incrémentalité (uplift) à la demande

## Rôle & surface
Permettre à l'opérateur d'évaluer l'effet d'un coupon en chargeant ses **stats d'incrémentalité**
(uplift traitement vs holdout) directement depuis la ligne du tableau. Surface : bouton « Stats » de
chaque `coupon-row-{id}` dans `<CouponsManager/>`. Fichier cible :
`apps/web/src/components/admin/coupons/CouponsManager.tsx`.
Fichier de test : `src/components/admin/coupons/CouponsManager.stats.test.tsx`.

## Fonctionnement optimal (ce qui DOIT se passer)
Le bouton « Stats » est **toujours** présent (quel que soit le statut). Geste nominal : Karim clique
« Stats » sur une ligne. Le composant :
1. `GET /api/admin/coupons/{id}/stats` (pas de `busy`, pas d'effacement d'erreur — chargement léger) ;
2. sur `res.ok`, stocke `stats[id]` et rend un `span` testid `coupon-stats-{id}` à côté des actions.

Texte rendu (format exact) :
- `upliftAbsolute` non nul → `uplift: {(upliftAbsolute*100).toFixed(1)} pts`. Ex. `0.05` → `uplift: 5.0 pts`.
- `upliftAbsolute === null` → `uplift: —`.
- si `noControl === true`, le suffixe ` (pas de contrôle)` est ajouté.

Le `span` n'apparaît **que** après un chargement réussi (avant clic : pas de `coupon-stats-{id}`).
Recharger met à jour `stats[id]` (merge par id) ; les stats des autres lignes sont indépendantes.

## Contrat I/O
- `GET /api/admin/coupons/{id}/stats`, `credentials:'include'` → `{ couponId, stats: CouponStats }`.
- `CouponStats` : `{ exposed, converted, conversionRate, upliftAbsolute, upliftRelative, noControl, lowSample }`.
- Aucune mutation. En cas d'échec (`!res.ok` ou throw), **rien n'est stocké** : pas de `span`, et
  contrairement à create/transition, **aucun `setError`** n'est déclenché (le handler ne gère pas
  l'échec) → l'UI reste silencieuse (oracle : absence du span, pas de role=alert).

## Cas limites & non-happy-path
- **upliftAbsolute null** → `coupon-stats-{id}` affiche `uplift: —`.
- **noControl true** → suffixe ` (pas de contrôle)` ; combiné avec uplift null → `uplift: — (pas de contrôle)`.
- **Arrondi** : `0.123` → `12.3 pts` ; `0.05` → `5.0 pts` (toujours 1 décimale, `toFixed(1)`).
- **Uplift négatif** : `-0.02` → `uplift: -2.0 pts` (le coupon a dégradé la conversion).
- **403 / 500 / 'network'** : aucun span ne s'affiche, l'UI reste inchangée, **pas** de role=alert
  (chemin sans gestion d'erreur explicite côté composant — comportement à constater, pas un bug à
  masquer dans le test).
- **lowSample true** : non rendu dans l'UI actuelle (donnée présente mais non affichée) — à documenter,
  pas d'oracle UI.
- Charte : le `pts` est une unité absolue de points de conversion, **pas** un `%` ; le texte ne doit
  contenir ni `%` ni `!` ni emoji.

## Invariants couverts
- Aucun INV maître dédié (feature P1). Couvre la lacune d'audit « CouponsManager 0 test » sur le
  chemin stats + le format d'affichage de l'uplift (cohérent avec `stats.test.ts` du moteur).

## Critères d'acceptation (observables)
- Avant clic : `queryByTestId('coupon-stats-{id}')` est null.
- Après clic OK (uplift 0.05) : `coupon-stats-{id}` textContent === `uplift: 5.0 pts`.
- upliftAbsolute null : textContent === `uplift: —`.
- noControl true : textContent se termine par ` (pas de contrôle)`.
- Échec réseau/HTTP : `coupon-stats-{id}` toujours absent, aucun `role="alert"`.
- Le texte ne matche pas `/[%!]|🎉|⏰/`.

## Points à vérifier — tous points de vue
- Backend : agrégation uplift (route stats) — testée en contrat ailleurs (F06).
- Frontend : merge par id, indépendance entre lignes, span conditionnel.
- UI/UX/design : `pts` lisible, terracotta NON appliqué (pas une ligne d'économie cliente).
- Data : `*100` puis `toFixed(1)` ; null → `—` ; suffixe contrôle.
- A11y : information textuelle simple (pas de role=alert attendu sur ce chemin).
- i18n : libellé `uplift`/`pts`/`(pas de contrôle)` FR ; AR hors scope ici.
